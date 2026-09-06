import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isPlatformAdmin, requireCourseAccess, requireUser, type CourseAccess } from "./auth";
import { contentInclude, serializeContent, serializeManyContent, visibleWhere } from "./content";
import { questionFlags } from "./question-flags";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import { AppError } from "./http";

export async function listCourses(request: Request) {
  const user = await requireUser(request);
  const isAdmin = await isPlatformAdmin(user.id);
  const courses = await db.course.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, take: 200,
    include: { memberships: { where: { userId: user.id } }, _count: { select: { memberships: true } } } });
  return { isAdmin, courses: courses.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, joined: isAdmin || Boolean(c.memberships.length), role: c.memberships[0]?.role ?? (isAdmin ? "STAFF" : null), memberCount: c._count.memberships })) };
}

export async function courseSnapshot(access: CourseAccess) {
  const kinds = ["ASSESSMENT", "CALENDAR_EVENT", "NOTE", "ADVICE", "QUESTION"] as const;
  const groups = await Promise.all(kinds.map((kind) => db.contentItem.findMany({ where: { ...visibleWhere(access), kind }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101, include: contentInclude })));
  const items = groups.flatMap((group) => group.slice(0, 100));
  const flags = await questionFlags(items.flatMap((item) => item.question?.revisions.map((r) => r.id) ?? []));
  const records = items.filter((item) => {
    // Parent visibility is authoritative without overwriting independent child moderation state.
    if (item.calendarEvent?.assessment && item.calendarEvent.assessment.contentItem.visibility !== "PUBLISHED") return access.canModerate || item.authorId === access.user.id;
    if (item.question && !item.question.bank.active) return access.canModerate || item.authorId === access.user.id;
    return true;
  }).map((item) => {
    const value = serializeContent(item, access);
    if (item.question) Object.assign(value, { graded: flags.get(item.question.revisions[0]?.id ?? "") ?? false, parentHidden: !item.question.bank.active });
    if (item.calendarEvent?.assessment) Object.assign(value, { parentHidden: item.calendarEvent.assessment.contentItem.visibility !== "PUBLISHED" });
    return { kind: item.kind, value };
  });
  const [banks, memberCount, notices] = await Promise.all([
    db.questionBank.findMany({ where: { courseId: access.course.id, active: true, assessment: { contentItem: { visibility: "PUBLISHED" } } }, orderBy: { title: "asc" }, take: 200, select: { id: true, title: true, assessmentId: true } }),
    db.courseMembership.count({ where: { courseId: access.course.id } }),
    db.moderationAction.findMany({ where: { courseId: access.course.id, contentItem: { authorId: access.user.id }, type: { in: ["HIDE", "LOCK", "RESTORE", "UNLOCK"] } }, orderBy: { createdAt: "desc" }, take: 25, select: { id: true, contentItemId: true, type: true, reason: true, createdAt: true, reportId: true, appeals: { select: { status: true, resolution: true } } } }),
  ]);
  return { course: { ...access.course, memberCount }, user: access.user, permissions: { canModerate: access.canModerate, isAdmin: access.isAdmin },
    assessments: records.filter((r) => r.kind === "ASSESSMENT").map((r) => r.value), events: records.filter((r) => r.kind === "CALENDAR_EVENT").map((r) => r.value),
    notes: records.filter((r) => r.kind === "NOTE").map((r) => r.value), advice: records.filter((r) => r.kind === "ADVICE").map((r) => r.value), questions: records.filter((r) => r.kind === "QUESTION").map((r) => r.value), banks, notices,
    nextCursors: Object.fromEntries(kinds.map((kind, index) => [kind, (groups[index]?.length ?? 0) > 100 ? groups[index]?.[99]?.id ?? null : null])) };
}

export async function searchCourse(access: CourseAccess, query: string) {
  const text = z.string().trim().min(2).max(120).parse(query);
  const contains = { contains: text, mode: "insensitive" as const };
  const records = await db.contentItem.findMany({ where: { courseId: access.course.id, visibility: "PUBLISHED", OR: [
    { assessment: { OR: [{ title: contains }, { summary: contains }, { description: contains }] } },
    { note: { OR: [{ title: contains }, { body: contains }] } }, { advice: { OR: [{ title: contains }, { body: contains }] } },
    { question: { bank: { active: true, assessment: { contentItem: { visibility: "PUBLISHED" } } }, revisions: { some: { prompt: contains } } } },
  ] }, orderBy: { updatedAt: "desc" }, take: 50, include: contentInclude });
  // Search latest prompts only; older revisions must not expose removed text through a match.
  const matching = records.filter((item) => !item.question || item.question.revisions[0]?.prompt.toLowerCase().includes(text.toLowerCase()));
  const values = await serializeManyContent(matching, access);
  return { results: values.map((value, index) => ({ ...value, contentKind: matching[index]!.kind })) };
}

export async function joinCourse(request: Request, code: string) {
  const user = await requireUser(request);
  const found = await db.courseJoinCode.findUnique({ where: { codeHash: sha256(code.trim()) }, include: { course: true } });
  if (!found || found.revokedAt || (found.expiresAt && found.expiresAt <= new Date()) || found.course.archivedAt) throw new AppError(400, "INVALID_JOIN_CODE", "This course code is invalid or expired.");
  await db.courseMembership.upsert({ where: { courseId_userId: { courseId: found.courseId, userId: user.id } }, create: { courseId: found.courseId, userId: user.id }, update: {} });
  return { slug: found.course.slug, joined: true };
}
export async function rotateJoinCode(access: CourseAccess, requestId: string) {
  if (!access.canModerate) throw new AppError(403, "COURSE_STAFF_REQUIRED", "Only course staff can rotate the join code.");
  const code = randomToken(12);
  await db.$transaction(async (tx) => {
    await tx.courseJoinCode.updateMany({ where: { courseId: access.course.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.courseJoinCode.create({ data: { courseId: access.course.id, codeHash: sha256(code), createdById: access.user.id, expiresAt: new Date(Date.now() + 30 * 86_400_000) } });
    await tx.auditEvent.create({ data: { actorId: access.user.id, courseId: access.course.id, action: "ROTATE_JOIN_CODE", targetType: "Course", targetId: access.course.id, requestId } });
  });
  return { code, expiresInDays: 30 };
}

export const memberSchema = z.object({ username: z.string().trim().min(1).max(100), role: z.enum(["MEMBER", "STAFF"]).default("MEMBER"), remove: z.boolean().default(false) });
export async function manageMember(access: CourseAccess, input: z.infer<typeof memberSchema>, requestId: string) {
  if (!access.canModerate) throw new AppError(403, "COURSE_STAFF_REQUIRED", "Only course staff can manage members.");
  const user = await db.user.findUnique({ where: { username: input.username } });
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "This user must sign in to openTJ first.");
  const membership = await db.courseMembership.findUnique({ where: { courseId_userId: { courseId: access.course.id, userId: user.id } } });
  if (!access.isAdmin && (input.role === "STAFF" || membership?.role === "STAFF")) throw new AppError(403, "ADMIN_REQUIRED", "Only administrators may change staff assignments.");
  if (input.role === "STAFF" && !input.remove && !user.isTeacher) throw new AppError(400, "TEACHER_REQUIRED", "Course staff must be verified teachers.");
  await db.$transaction(async (tx) => {
    if (input.remove) await tx.courseMembership.deleteMany({ where: { courseId: access.course.id, userId: user.id } });
    else await tx.courseMembership.upsert({ where: { courseId_userId: { courseId: access.course.id, userId: user.id } }, create: { courseId: access.course.id, userId: user.id, role: input.role }, update: { role: input.role } });
    await tx.auditEvent.create({ data: { actorId: access.user.id, courseId: access.course.id, action: input.remove ? "REMOVE_MEMBER" : "SET_MEMBERSHIP", targetType: "User", targetId: user.id, requestId, metadata: { role: input.role } } });
  });
  return { updated: true };
}

export async function adminSnapshot(request: Request) {
  const actor = await requireUser(request);
  const isAdmin = await isPlatformAdmin(actor.id);
  const scope: Prisma.CourseWhereInput = isAdmin ? {} : { memberships: { some: { userId: actor.id, role: "STAFF" } }, archivedAt: null };
  const courses = await db.course.findMany({ where: scope, orderBy: { name: "asc" }, take: 200 });
  if (!isAdmin && !courses.length) throw new AppError(403, "COURSE_STAFF_REQUIRED", "Staff access is required.");
  const users = await db.user.findMany({ where: isAdmin ? {} : { memberships: { some: { courseId: { in: courses.map((c) => c.id) } } } }, take: 500, orderBy: { displayName: "asc" },
    select: { id: true, username: true, displayName: true, isTeacher: true, accountStatus: true, roleGrants: { select: { role: true } }, memberships: { where: { courseId: { in: courses.map((c) => c.id) } }, select: { courseId: true, role: true } } } });
  return { isAdmin, courses, users: users.map(({ roleGrants, ...user }) => ({ ...user, isAdmin: roleGrants.some((g) => g.role === "PLATFORM_ADMIN") })) };
}
export const adminSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createCourse"), name: z.string().trim().min(1).max(200), slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().trim().max(5000).default("") }),
  z.object({ action: z.literal("course"), courseId: z.string().min(1), archived: z.boolean() }),
  z.object({ action: z.literal("user"), userId: z.string().min(1), accountStatus: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(), isAdmin: z.boolean().optional() }),
]);
export async function administer(actorId: string, input: z.infer<typeof adminSchema>, requestId: string) {
  return db.$transaction(async (tx) => {
    // Serialize role changes so concurrent administrators cannot revoke each
    // other's last active administrator access between authorization and commit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('opentj:administrator-roles'))`;
    const actor = await tx.roleGrant.findFirst({ where: { userId: actorId, role: "PLATFORM_ADMIN", user: { accountStatus: "ACTIVE" } } });
    if (!actor) throw new AppError(403, "ADMIN_REQUIRED", "Administrator access was revoked. Reload before continuing.");
    let targetId: string;
    if (input.action === "createCourse") {
      const course = await tx.course.create({ data: { name: input.name, slug: input.slug, description: input.description } });
      targetId = course.id;
    } else if (input.action === "course") {
      await tx.course.update({ where: { id: input.courseId }, data: { archivedAt: input.archived ? new Date() : null } });
      targetId = input.courseId;
    } else {
      if (input.userId === actorId && (input.isAdmin === false || (input.accountStatus && input.accountStatus !== "ACTIVE"))) throw new AppError(400, "SELF_RESTRICTION", "An administrator cannot revoke or suspend their own access.");
      const user = await tx.user.findUnique({ where: { id: input.userId } });
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
      if (input.isAdmin === false || (input.accountStatus && input.accountStatus !== "ACTIVE")) {
        const grants = await tx.roleGrant.findMany({ where: { role: "PLATFORM_ADMIN", user: { accountStatus: "ACTIVE" } }, select: { userId: true } });
        if (grants.length === 1 && grants[0]?.userId === user.id) throw new AppError(409, "LAST_ADMINISTRATOR", "Grant another active administrator before revoking this access.");
      }
      if (input.accountStatus) {
        await tx.user.update({ where: { id: user.id }, data: { accountStatus: input.accountStatus } });
        if (input.accountStatus !== "ACTIVE") await tx.session.deleteMany({ where: { userId: user.id } });
      }
      if (input.isAdmin === true) await tx.roleGrant.upsert({ where: { userId_role: { userId: user.id, role: "PLATFORM_ADMIN" } }, create: { userId: user.id, role: "PLATFORM_ADMIN", grantedById: actorId }, update: {} });
      if (input.isAdmin === false) await tx.roleGrant.deleteMany({ where: { userId: user.id, role: "PLATFORM_ADMIN" } });
      targetId = user.id;
    }
    await tx.auditEvent.create({ data: { actorId, action: `ADMIN_${input.action.toUpperCase()}`, targetType: input.action === "user" ? "User" : "Course", targetId, requestId, metadata: input } });
    return { updated: true, id: targetId };
  });
}
export { requireCourseAccess };
