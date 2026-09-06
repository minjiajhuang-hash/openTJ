import { z } from "zod";
import { isPlatformAdmin, requireUser, type CourseAccess } from "./auth";
import { claimVersion, contentInclude, getContent, recordRevision, serializeContentForRead } from "./content";
import { db } from "./db";
import { AppError } from "./http";

export const reportSchema = z.object({ contentId: z.string().min(1), reason: z.enum(["ACADEMIC_INTEGRITY", "HARASSMENT_HATE", "PRIVACY", "COPYRIGHT", "UNSAFE_FILE", "SPAM", "OTHER"]), details: z.string().trim().max(5000).default("") });
export const moderationSchema = z.object({ contentId: z.string().min(1), version: z.number().int().positive(),
  action: z.enum(["HIDE", "RESTORE", "LOCK", "UNLOCK", "DISMISS_REPORT"]), reason: z.string().trim().min(3).max(3000), reportId: z.string().min(1).optional() });
export async function submitReport(access: CourseAccess, input: z.infer<typeof reportSchema>) {
  const item = await getContent(access, input.contentId);
  if (item.visibility !== "PUBLISHED") throw new AppError(400, "NOT_PUBLISHED", "This item is already hidden or awaiting processing.");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${item.id} FOR UPDATE`;
    const current = await tx.contentItem.findUnique({ where: { id: item.id }, select: { visibility: true } });
    if (current?.visibility !== "PUBLISHED") throw new AppError(409, "NOT_PUBLISHED", "This contribution has already been hidden.");
    const previous = await tx.report.findFirst({ where: { contentItemId: item.id, reporterId: access.user.id, status: "OPEN" } });
    if (previous) return { id: previous.id, status: previous.status };
    const report = await tx.report.create({ data: { courseId: access.course.id, contentItemId: item.id, reporterId: access.user.id, reason: input.reason, details: input.details } });
    return { id: report.id, status: report.status };
  });
}

export async function moderate(access: CourseAccess, input: z.infer<typeof moderationSchema>, requestId: string) {
  if (!access.canModerate) throw new AppError(403, "COURSE_STAFF_REQUIRED", "Course staff access is required.");
  const item = await getContent(access, input.contentId);
  if (item.authorId === access.user.id) throw new AppError(403, "INDEPENDENT_REVIEW_REQUIRED", "Another staff member must moderate your contribution.");
  const report = input.reportId ? await db.report.findFirst({ where: { id: input.reportId, courseId: access.course.id, contentItemId: item.id } }) : null;
  if (input.reportId && !report) throw new AppError(404, "REPORT_NOT_FOUND", "Report not found for this contribution.");
  if (input.action === "DISMISS_REPORT" && !report) throw new AppError(400, "REPORT_REQUIRED", "Choose the report to dismiss.");
  if (input.action === "RESTORE" && item.note?.mode === "PDF" && item.note.upload?.status !== "CLEAN") throw new AppError(409, "UPLOAD_NOT_CLEAN", "Only successfully scanned PDFs can be published.");
  const before = { visibility: item.visibility, locked: item.locked };
  const after = { visibility: input.action === "HIDE" ? "HIDDEN_BY_MODERATOR" as const : input.action === "RESTORE" ? "PUBLISHED" as const : item.visibility,
    locked: input.action === "LOCK" ? true : input.action === "UNLOCK" ? false : item.locked };
  await db.$transaction(async (tx) => {
    await claimVersion(tx, item.id, input.version);
    await tx.contentItem.update({ where: { id: item.id }, data: { ...after, hiddenAt: input.action === "HIDE" ? new Date() : input.action === "RESTORE" ? null : item.hiddenAt } });
    if (item.assessment && ["HIDE", "RESTORE"].includes(input.action)) await tx.questionBank.updateMany({ where: { assessmentId: item.id }, data: { active: after.visibility === "PUBLISHED" && item.assessment.isMajor } });
    // Every takedown has a report record so its author can use one appeal, including proactive staff takedowns.
    let reportId = report?.id;
    if (!reportId && input.action === "HIDE") {
      const created = await tx.report.create({ data: { courseId: access.course.id, contentItemId: item.id, reporterId: access.user.id, reason: "OTHER", details: "Staff review", status: "ACTIONED", resolvedById: access.user.id, resolvedAt: new Date() } });
      reportId = created.id;
    }
    if (reportId) await tx.report.update({ where: { id: reportId }, data: { status: input.action === "DISMISS_REPORT" ? "DISMISSED" : "ACTIONED", resolvedById: access.user.id, resolvedAt: new Date() } });
    await tx.moderationAction.create({ data: { courseId: access.course.id, contentItemId: item.id, reportId, actorId: access.user.id, type: input.action, reason: input.reason, before, after, requestId } });
    await tx.auditEvent.create({ data: { actorId: access.user.id, courseId: access.course.id, action: `MODERATION_${input.action}`, targetType: "ContentItem", targetId: item.id, requestId, metadata: { before, after } } });
    await recordRevision(tx, item.id, input.version + 1, access.user.id, { action: input.action, before, after });
  });
  return serializeContentForRead(await getContent(access, item.id), access);
}

function itemTitle(item: { assessment: { title: string } | null; calendarEvent: { title: string } | null; note: { title: string } | null; advice: { title: string } | null; question: { revisions: { prompt: string }[] } | null; calendarUpdate: { body: string } | null }) {
  return item.assessment?.title ?? item.calendarEvent?.title ?? item.note?.title ?? item.advice?.title ?? item.question?.revisions[0]?.prompt.slice(0, 150) ?? item.calendarUpdate?.body.slice(0, 150) ?? "Contribution";
}
export async function moderationSnapshot(request: Request) {
  const user = await requireUser(request);
  const admin = await isPlatformAdmin(user.id);
  const courses = await db.course.findMany({ where: admin ? { archivedAt: null } : { archivedAt: null, memberships: { some: { userId: user.id, role: "STAFF" } } }, select: { id: true, slug: true, name: true } });
  if (!admin && !courses.length) throw new AppError(403, "COURSE_STAFF_REQUIRED", "Course staff access is required.");
  const courseIds = courses.map((c) => c.id);
  const [reports, appeals, actions] = await Promise.all([
    db.report.findMany({ where: { courseId: { in: courseIds } }, orderBy: { createdAt: "desc" }, take: 200,
      include: { contentItem: { include: contentInclude }, reporter: { select: { username: true, displayName: true } }, course: { select: { slug: true, name: true } } } }),
    db.appeal.findMany({ where: { report: { courseId: { in: courseIds } } }, orderBy: { createdAt: "desc" }, take: 100,
      include: { author: { select: { username: true, displayName: true } }, report: { select: { course: { select: { slug: true } }, contentItemId: true } }, moderationAction: { select: { reason: true, actorId: true } } } }),
    db.moderationAction.findMany({ where: { courseId: { in: courseIds } }, orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { username: true, displayName: true } } } }),
  ]);
  return { courses, reports: reports.map((r) => ({ id: r.id, courseSlug: r.course.slug, courseName: r.course.name, contentId: r.contentItemId, title: itemTitle(r.contentItem), author: r.contentItem.author.displayName,
    authorId: r.contentItem.authorId, reporter: r.reporter.displayName, reason: r.reason, details: r.details, status: r.status, version: r.contentItem.version, visibility: r.contentItem.visibility, locked: r.contentItem.locked, createdAt: r.createdAt })),
    appeals: appeals.map((a) => ({ id: a.id, contentId: a.report.contentItemId, courseSlug: a.report.course.slug, author: a.author.displayName, message: a.message, status: a.status, resolution: a.resolution, reason: a.moderationAction.reason, createdAt: a.createdAt })), actions };
}

export async function submitAppeal(access: CourseAccess, contentId: string, message: string) {
  const item = await getContent(access, contentId);
  if (item.authorId !== access.user.id) throw new AppError(403, "AUTHOR_REQUIRED", "Only the contribution's author can appeal its takedown.");
  const action = await db.moderationAction.findFirst({ where: { contentItemId: item.id, courseId: access.course.id, type: "HIDE", reportId: { not: null } }, orderBy: { createdAt: "desc" } });
  if (!action?.reportId || item.visibility !== "HIDDEN_BY_MODERATOR") throw new AppError(400, "NO_TAKEDOWN", "There is no current takedown to appeal.");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${item.id} FOR UPDATE`;
    const current = await tx.contentItem.findUnique({ where: { id: item.id }, select: { visibility: true } });
    if (current?.visibility !== "HIDDEN_BY_MODERATOR") throw new AppError(409, "NO_TAKEDOWN", "There is no current takedown to appeal.");
    const existing = await tx.appeal.findUnique({ where: { moderationActionId: action.id } });
    if (existing) throw new AppError(409, "APPEAL_EXISTS", "You have already appealed this takedown.");
    const appeal = await tx.appeal.create({ data: { reportId: action.reportId!, moderationActionId: action.id, authorId: access.user.id, message } });
    await tx.report.update({ where: { id: action.reportId! }, data: { status: "APPEALED" } });
    return { id: appeal.id, status: appeal.status };
  });
}
export async function resolveAppeal(access: CourseAccess, id: string, status: "UPHELD" | "OVERTURNED", resolution: string, requestId: string) {
  if (!access.canModerate) throw new AppError(403, "COURSE_STAFF_REQUIRED", "Course staff access is required.");
  const appeal = await db.appeal.findFirst({ where: { id, report: { courseId: access.course.id } }, include: { report: { include: { contentItem: { include: contentInclude } } }, moderationAction: true } });
  if (!appeal) throw new AppError(404, "APPEAL_NOT_FOUND", "Appeal not found.");
  if (appeal.authorId === access.user.id) throw new AppError(403, "INDEPENDENT_REVIEW_REQUIRED", "Another staff member must review your appeal.");
  if (appeal.status !== "OPEN") throw new AppError(409, "APPEAL_RESOLVED", "This appeal has already been resolved.");
  const item = appeal.report.contentItem;
  if (status === "OVERTURNED" && item.note?.mode === "PDF" && item.note.upload?.status !== "CLEAN") throw new AppError(409, "UPLOAD_NOT_CLEAN", "Only successfully scanned PDFs can be restored.");
  await db.$transaction(async (tx) => {
    const result = await tx.appeal.updateMany({ where: { id, status: "OPEN" }, data: { status, resolution, resolvedById: access.user.id, resolvedAt: new Date() } });
    if (!result.count) throw new AppError(409, "APPEAL_RESOLVED", "This appeal has already been resolved.");
    await tx.report.update({ where: { id: appeal.reportId }, data: { status: "CLOSED", resolvedById: access.user.id, resolvedAt: new Date() } });
    if (status === "OVERTURNED") {
      await claimVersion(tx, item.id, item.version);
      await tx.contentItem.update({ where: { id: item.id }, data: { visibility: "PUBLISHED", hiddenAt: null } });
      if (item.assessment) await tx.questionBank.updateMany({ where: { assessmentId: item.id }, data: { active: item.assessment.isMajor } });
      await tx.moderationAction.create({ data: { actorId: access.user.id, courseId: access.course.id, contentItemId: item.id, reportId: appeal.reportId, type: "RESTORE", reason: resolution, requestId, before: { visibility: item.visibility }, after: { visibility: "PUBLISHED" } } });
      await recordRevision(tx, item.id, item.version + 1, access.user.id, { action: "APPEAL_OVERTURNED" });
    }
    await tx.auditEvent.create({ data: { actorId: access.user.id, courseId: access.course.id, action: `APPEAL_${status}`, targetType: "Appeal", targetId: id, requestId } });
  });
  return { id, status };
}
