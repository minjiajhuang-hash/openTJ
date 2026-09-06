import {
  AccountStatus,
  CourseRole,
  PlatformRole,
  type Course,
  type CourseMembership,
  type User,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import {
  POLICY_VERSION,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  getRequiredEnv,
  isDemoAuthEnabled,
} from "./env";
import { AppError } from "./http";

export type PublicUser = Pick<
  User,
  "id" | "username" | "displayName" | "isStudent" | "isTeacher" | "accountStatus"
>;

export type CourseAccess = {
  user: PublicUser;
  course: Course;
  membership: CourseMembership | null;
  isAdmin: boolean;
  canModerate: boolean;
};

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

export function sessionTokenFromRequest(request: Request | NextRequest): string | null {
  return parseCookie(request.headers.get("cookie"), SESSION_COOKIE);
}

function privacyHash(value: string | null): string | null {
  if (!value) return null;
  const secret = process.env.SESSION_SECRET?.trim() || "local-development-only";
  return sha256(`${secret}:${value}`);
}

export async function createSession(
  userId: string,
  request?: Request,
): Promise<{ token: string; expiresAt: Date }> {
  if (process.env.NODE_ENV === "production") getRequiredEnv("SESSION_SECRET");
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      userAgentHash: privacyHash(request?.headers.get("user-agent") ?? null),
      ipHash: privacyHash(
        request?.headers.get("cf-connecting-ip") ??
          request?.headers.get("x-real-ip") ??
          request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null,
      ),
    },
  });
  return { token, expiresAt };
}

export async function destroySession(request: Request | NextRequest): Promise<void> {
  const token = sessionTokenFromRequest(request);
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
}

export async function getCurrentUser(request: Request | NextRequest): Promise<PublicUser | null> {
  const token = sessionTokenFromRequest(request);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const now = new Date();
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= now) {
    if (session) await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.updateMany({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  const { id, username, displayName, isStudent, isTeacher, accountStatus } = session.user;
  return { id, username, displayName, isStudent, isTeacher, accountStatus };
}

export async function requireUser(request: Request | NextRequest): Promise<PublicUser> {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  if (user.accountStatus !== AccountStatus.ACTIVE) {
    throw new AppError(403, "ACCOUNT_RESTRICTED", "This account is not permitted to use openTJ.");
  }
  return user;
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  return Boolean(
    await db.roleGrant.findUnique({
      where: { userId_role: { userId, role: PlatformRole.PLATFORM_ADMIN } },
      select: { id: true },
    }),
  );
}

export async function requirePlatformAdmin(request: Request | NextRequest): Promise<PublicUser> {
  const user = await requireUser(request);
  if (!(await isPlatformAdmin(user.id))) {
    throw new AppError(403, "ADMIN_REQUIRED", "Platform administrator access is required.");
  }
  return user;
}

export async function requireCourseAccess(
  request: Request | NextRequest,
  slug: string,
  options: { moderate?: boolean } = {},
): Promise<CourseAccess> {
  const user = await requireUser(request);
  const course = await db.course.findUnique({ where: { slug } });
  if (!course || course.archivedAt) throw new AppError(404, "COURSE_NOT_FOUND", "Course not found.");
  const [membership, admin] = await Promise.all([
    db.courseMembership.findUnique({ where: { courseId_userId: { courseId: course.id, userId: user.id } } }),
    isPlatformAdmin(user.id),
  ]);
  if (!membership && !admin) {
    throw new AppError(403, "COURSE_MEMBERSHIP_REQUIRED", "Join this course to view its material.");
  }
  const canModerate = admin || membership?.role === CourseRole.STAFF;
  if (options.moderate && !canModerate) {
    throw new AppError(403, "COURSE_STAFF_REQUIRED", "Course staff access is required.");
  }
  return { user, course, membership, isAdmin: admin, canModerate };
}

export async function canModerateCourse(userId: string, courseId: string): Promise<boolean> {
  const [admin, membership] = await Promise.all([
    isPlatformAdmin(userId),
    db.courseMembership.findUnique({ where: { courseId_userId: { courseId, userId } } }),
  ]);
  return admin || membership?.role === CourseRole.STAFF;
}

export async function requirePolicyAccepted(userId: string): Promise<void> {
  const accepted = await db.policyAcceptance.findUnique({
    where: { userId_version: { userId, version: POLICY_VERSION } },
    select: { id: true },
  });
  if (!accepted) {
    throw new AppError(403, "POLICY_ACCEPTANCE_REQUIRED", "Accept the current contribution policy before posting.");
  }
}

export async function assertCanChangeContent(
  userId: string,
  item: { authorId: string; courseId: string; locked: boolean },
): Promise<void> {
  const moderator = await canModerateCourse(userId, item.courseId);
  if (item.locked && !moderator) throw new AppError(423, "CONTENT_LOCKED", "This contribution is locked.");
  if (item.authorId !== userId && !moderator) {
    throw new AppError(403, "CONTENT_OWNER_REQUIRED", "Only the author or course staff may change this contribution.");
  }
}

export const demoPersonaUsernames = {
  student: "demo.student",
  nonmember: "demo.nonmember",
  teacher: "demo.teacher",
  unassignedTeacher: "demo.unassigned",
  admin: "demo.admin",
  suspended: "demo.suspended",
} as const;

export async function getDemoPersona(persona: keyof typeof demoPersonaUsernames): Promise<PublicUser> {
  if (!isDemoAuthEnabled()) {
    throw new AppError(404, "NOT_FOUND", "Demo authentication is unavailable.");
  }
  const user = await db.user.findUnique({ where: { username: demoPersonaUsernames[persona] } });
  if (!user) throw new AppError(503, "DEMO_NOT_SEEDED", "Run the database seed before using demo authentication.");
  const { id, username, displayName, isStudent, isTeacher, accountStatus } = user;
  return { id, username, displayName, isStudent, isTeacher, accountStatus };
}
