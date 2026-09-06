import { Prisma, type ContentKind, type Visibility } from "@prisma/client";
import { z } from "zod";
import { assertCanChangeContent, requireCourseAccess, requirePolicyAccepted, type CourseAccess } from "./auth";
import { db } from "./db";
import { AppError } from "./http";
import { questionFlags } from "./question-flags";

const title = z.string().trim().min(1).max(200);
const body = z.string().trim().max(30_000);
const labels = z.array(z.string().trim().min(1).max(300)).max(40);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/).refine((value) => Number.isFinite(Date.parse(value)) && new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === value.slice(0, 10), "Enter a valid date.");
const eventFields = {
  title, start: date, end: date.optional().nullable(), allDay: z.boolean().default(true),
  kind: z.enum(["assessment", "assignment", "reminder", "other"]).default("assignment"), details: body.default(""),
};
export const eventSchema = z.object(eventFields).refine((v) => !v.end || Date.parse(v.end) > Date.parse(v.start), "The end must follow the start.");
export const assessmentSchema = z.object({
  title, kind: z.enum(["Test", "Quiz", "Assignment", "Other"]).default("Test"), summary: body.default(""), description: body.default(""),
  topics: labels.default([]), templates: labels.default([]), major: z.boolean().default(false),
  addToCalendar: z.boolean().default(false), date: date.optional(),
}).refine((v) => !v.addToCalendar || Boolean(v.date), "Choose a calendar date.");
export const noteSchema = z.object({
  title, mode: z.enum(["Plain text", "Markdown + LaTeX", "PDF"]), body: body.optional(), uploadId: z.string().min(1).optional().nullable(),
}).refine((v) => v.mode === "PDF" ? Boolean(v.uploadId) && !v.body : Boolean(v.body) && !v.uploadId, "Provide either a text body or a PDF upload.");
export const adviceSchema = z.object({
  title, body: body.min(1), type: z.enum(["GENERAL", "ASSESSMENT_SPECIFIC"]), assessmentId: z.string().min(1).optional().nullable(),
}).refine((v) => v.type === "ASSESSMENT_SPECIFIC" ? Boolean(v.assessmentId) : !v.assessmentId, "Assessment advice requires an assessment; general advice must not link one.");
export const questionSchema = z.object({
  bankId: z.string().min(1), type: z.enum(["SINGLE_CHOICE", "SHORT_ANSWER", "LONG_RESPONSE"]), prompt: body.min(1), skills: labels.default([]),
  choices: z.array(body.min(1)).max(12).default([]), correctChoice: z.number().int().min(0).optional().nullable(),
  explanations: z.array(body).max(12).default([]), solution: body.optional().nullable(),
  shortAnswerMode: z.enum(["TEXT", "NUMERIC"]).default("TEXT"), acceptedAnswers: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
  caseSensitive: z.boolean().default(false), numericAnswer: z.number().finite().min(-1e17).max(1e17).optional().nullable(),
  absoluteTolerance: z.number().finite().min(0).max(1e17).default(0), relativeTolerance: z.number().finite().min(0).max(1).default(0),
  unit: z.string().trim().max(50).optional().nullable(), authorized: z.literal(true),
}).superRefine((v, ctx) => {
  if (v.type === "SINGLE_CHOICE" && (v.choices.length < 2 || (v.correctChoice != null && v.correctChoice >= v.choices.length))) {
    ctx.addIssue({ code: "custom", path: ["choices"], message: "Provide at least two choices and a valid correct choice, or leave it ungraded." });
  }
  if (v.type !== "SINGLE_CHOICE" && (v.choices.length || v.correctChoice != null)) ctx.addIssue({ code: "custom", path: ["choices"], message: "Only multiple-choice questions have choices." });
});

// This selection intentionally cannot fetch answer keys or detailed solutions.
export const contentInclude = Prisma.validator<Prisma.ContentItemInclude>()({
  author: { select: { displayName: true, username: true } },
  assessment: { include: { topics: { orderBy: { position: "asc" } }, templates: { orderBy: { position: "asc" } }, calendarEvent: { include: { contentItem: { select: { visibility: true } } } }, questionBank: true } },
  calendarEvent: { include: { assessment: { include: { contentItem: { select: { visibility: true } } } }, updates: { orderBy: { contentItem: { createdAt: "asc" } }, take: 200, include: { contentItem: { include: { author: { select: { displayName: true, username: true } } } } } } } },
  calendarUpdate: true,
  note: { include: { upload: { select: { id: true, status: true, originalName: true, bytes: true, pages: true, failureReason: true } } } },
  advice: { include: { assessment: { select: { title: true } } } },
  question: { include: { bank: { include: { assessment: { select: { title: true } } } }, revisions: { orderBy: { revision: "desc" }, take: 1, select: {
    id: true, revision: true, type: true, prompt: true, shortAnswerMode: true, unit: true,
    choices: { orderBy: { position: "asc" }, select: { text: true } },
    skills: { include: { skill: { select: { name: true } } } },
  } } } },
});
export type ContentRecord = Prisma.ContentItemGetPayload<{ include: typeof contentInclude }>;
export function contentMetadata(item: Pick<ContentRecord, "id" | "authorId" | "version" | "visibility" | "locked" | "createdAt" | "updatedAt" | "author">) {
  return { id: item.id, authorId: item.authorId, author: item.author.displayName, username: item.author.username, version: item.version,
    visibility: item.visibility, locked: item.locked, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}
function isoDate(value: Date | null | undefined) { return value?.toISOString().slice(0, 10) ?? ""; }
export function serializeContent(item: ContentRecord, access: CourseAccess) {
  const meta = contentMetadata(item);
  if (item.assessment) {
    const a = item.assessment;
    const e = a.calendarEvent;
    return { ...meta, title: a.title, kind: ({ TEST: "Test", QUIZ: "Quiz", ASSIGNMENT: "Assignment", OTHER: "Other" } as const)[a.type],
      summary: a.summary, description: a.description, topics: a.topics.map((t) => t.label), templates: a.templates.map((t) => t.description), major: a.isMajor,
      date: e?.contentItem.visibility === "PUBLISHED" ? e.allDay ? isoDate(e.startDate) : e.startsAt?.toISOString() ?? "" : "", calendarEventId: e?.contentItemId ?? null, bankId: a.questionBank?.id ?? null };
  }
  if (item.calendarEvent) {
    const e = item.calendarEvent;
    return { ...meta, title: e.title, start: e.allDay ? isoDate(e.startDate) : e.startsAt?.toISOString(), end: e.allDay ? isoDate(e.endDate) || null : e.endsAt?.toISOString() ?? null,
      allDay: e.allDay, kind: e.type.toLowerCase(), details: e.details, assessmentId: e.assessmentId, parentHidden: Boolean(e.assessment && e.assessment.contentItem.visibility !== "PUBLISHED"),
      updates: e.updates.filter((u) => u.contentItem.visibility === "PUBLISHED" || u.contentItem.authorId === access.user.id || access.canModerate)
        .map((u) => ({ ...contentMetadata(u.contentItem), body: u.body, calendarEventId: e.contentItemId })) };
  }
  if (item.calendarUpdate) return { ...meta, body: item.calendarUpdate.body, calendarEventId: item.calendarUpdate.calendarEventId };
  if (item.note) return { ...meta, title: item.note.title, mode: ({ PLAIN_TEXT: "Plain text", MARKDOWN_LATEX: "Markdown + LaTeX", PDF: "PDF" } as const)[item.note.mode],
    body: item.note.body ?? "", uploadId: item.note.uploadId, uploadStatus: item.note.upload?.status ?? null, upload: item.note.upload };
  if (item.advice) return { ...meta, title: item.advice.title, body: item.advice.body, type: item.advice.type, assessmentId: item.advice.assessmentId, assessment: item.advice.assessment?.title };
  if (item.question) {
    const revision = item.question.revisions[0];
    return { ...meta, bankId: item.question.bankId, assessment: item.question.bank.assessment.title, assessmentId: item.question.bank.assessmentId,
      revisionId: revision?.id, type: revision?.type, prompt: revision?.prompt ?? "", skills: revision?.skills.map((s) => s.skill.name) ?? [], choices: revision?.choices.map((c) => c.text) ?? [],
      shortAnswerMode: revision?.shortAnswerMode, unit: revision?.unit, graded: false, parentHidden: !item.question.bank.active };
  }
  return meta;
}

export function visibleWhere(access: CourseAccess): Prisma.ContentItemWhereInput {
  return { courseId: access.course.id, visibility: { not: "DELETED" }, ...(access.canModerate ? {} : { OR: [{ visibility: "PUBLISHED", ...publicParentsWhere() }, { authorId: access.user.id }] }) };
}
export async function serializeManyContent(items: ContentRecord[], access: CourseAccess) {
  const flags = await questionFlags(items.flatMap((item) => item.question?.revisions.map((revision) => revision.id) ?? []));
  return items.map((item) => {
    const value = serializeContent(item, access);
    if (item.question) Object.assign(value, { graded: flags.get(item.question.revisions[0]?.id ?? "") ?? false });
    return value;
  });
}
export async function serializeContentForRead(item: ContentRecord, access: CourseAccess) {
  return (await serializeManyContent([item], access))[0]!;
}
export function publicParentsWhere(): Prisma.ContentItemWhereInput {
  return { AND: [
    { OR: [{ calendarEvent: null }, { calendarEvent: { OR: [{ assessmentId: null }, { assessment: { contentItem: { visibility: "PUBLISHED" } } }] } }] },
    { OR: [{ question: null }, { question: { bank: { active: true, assessment: { contentItem: { visibility: "PUBLISHED" } } } } }] },
    { OR: [{ calendarUpdate: null }, { calendarUpdate: { calendarEvent: { contentItem: { visibility: "PUBLISHED" }, OR: [{ assessmentId: null }, { assessment: { contentItem: { visibility: "PUBLISHED" } } }] } } }] },
  ] };
}
export async function getContent(access: CourseAccess, id: string) {
  const item = await db.contentItem.findFirst({ where: { ...visibleWhere(access), id }, include: contentInclude });
  if (!item) throw new AppError(404, "CONTENT_NOT_FOUND", "Contribution not found.");
  return item;
}
export async function assertPublishedReference(tx: Prisma.TransactionClient, courseId: string, id: string, kind: ContentKind) {
  const item = await tx.contentItem.findFirst({ where: { id, courseId, kind, visibility: "PUBLISHED" } });
  if (!item) throw new AppError(400, "INVALID_REFERENCE", "Select a visible item from this course.");
  return item;
}
export async function claimVersion(tx: Prisma.TransactionClient, id: string, version: number) {
  const result = await tx.contentItem.updateMany({ where: { id, version }, data: { version: { increment: 1 } } });
  if (!result.count) throw new AppError(409, "VERSION_CONFLICT", "This item changed. Reload it before editing again.");
}
export async function recordRevision(tx: Prisma.TransactionClient, itemId: string, version: number, editorId: string, snapshot: unknown) {
  await tx.contentRevision.create({ data: { contentItemId: itemId, revision: version, editorId, snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue } });
}
export function calendarData(value: z.infer<typeof eventSchema>) {
  // All-day dates are date-only in PostgreSQL; timed events are ISO instants in UTC.
  if (value.allDay && (!/^\d{4}-\d{2}-\d{2}$/.test(value.start) || (value.end && !/^\d{4}-\d{2}-\d{2}$/.test(value.end)))) throw new AppError(400, "INVALID_DATE", "All-day events require YYYY-MM-DD dates.");
  if (!value.allDay && (!/[zZ]|[+-]\d\d:\d\d$/.test(value.start) || (value.end && !/[zZ]|[+-]\d\d:\d\d$/.test(value.end)))) throw new AppError(400, "INVALID_DATE", "Timed events require a timezone offset.");
  return { title: value.title, details: value.details, type: ({ assessment: "ASSESSMENT", assignment: "ASSIGNMENT", reminder: "REMINDER", other: "OTHER" } as const)[value.kind], allDay: value.allDay,
    startDate: value.allDay ? new Date(`${value.start}T00:00:00Z`) : null, endDate: value.allDay && value.end ? new Date(`${value.end}T00:00:00Z`) : null,
    startsAt: value.allDay ? null : new Date(value.start), endsAt: !value.allDay && value.end ? new Date(value.end) : null };
}

export async function addQuestionRevision(tx: Prisma.TransactionClient, id: string, courseId: string, userId: string, revision: number, value: z.infer<typeof questionSchema>) {
  const skillIds: string[] = [];
  for (const name of [...new Set(value.skills)]) {
    const skill = await tx.skill.upsert({ where: { courseId_name: { courseId, name } }, create: { courseId, name }, update: {} });
    skillIds.push(skill.id);
  }
  await tx.questionRevision.create({ data: { questionId: id, revision, createdById: userId, type: value.type, prompt: value.prompt,
    shortAnswerMode: value.type === "SHORT_ANSWER" ? value.shortAnswerMode : null,
    canonicalAnswer: value.type === "SHORT_ANSWER" && value.shortAnswerMode === "TEXT" ? value.acceptedAnswers[0] ?? null : null,
    acceptedAnswers: value.type === "SHORT_ANSWER" && value.shortAnswerMode === "TEXT" ? value.acceptedAnswers : [], caseSensitive: value.caseSensitive,
    numericAnswer: value.type === "SHORT_ANSWER" && value.shortAnswerMode === "NUMERIC" ? value.numericAnswer : null,
    absoluteTolerance: value.absoluteTolerance, relativeTolerance: value.relativeTolerance, unit: value.unit, detailedSolution: value.solution,
    choices: { create: value.choices.map((text, position) => ({ text, position, isCorrect: position === value.correctChoice, explanation: value.explanations[position] ?? null })) },
    skills: { create: skillIds.map((skillId) => ({ skillId })) },
  } });
}

export async function linkAssessment(access: CourseAccess, id: string, input: unknown) {
  await requirePolicyAccepted(access.user.id);
  const value = eventSchema.parse(input);
  const result = await db.$transaction(async (tx) => {
    await assertPublishedReference(tx, access.course.id, id, "ASSESSMENT");
    // Lock the parent row: concurrent requests cannot create competing calendar envelopes.
    await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${id} FOR UPDATE`;
    const existing = await tx.calendarEvent.findUnique({ where: { assessmentId_courseId: { assessmentId: id, courseId: access.course.id } } });
    if (existing) return existing.contentItemId;
    const item = await tx.contentItem.create({ data: { courseId: access.course.id, authorId: access.user.id, kind: "CALENDAR_EVENT", publishedAt: new Date() } });
    await tx.calendarEvent.create({ data: { contentItemId: item.id, courseId: access.course.id, assessmentId: id, ...calendarData(value) } });
    await recordRevision(tx, item.id, 1, access.user.id, value);
    return item.id;
  });
  return serializeContentForRead(await getContent(access, result), access);
}

export async function writeContent(access: CourseAccess, raw: Record<string, unknown>, existingId?: string) {
  await requirePolicyAccepted(access.user.id);
  const existing = existingId ? await getContent(access, existingId) : null;
  if (existing) {
    await assertCanChangeContent(access.user.id, existing);
    if (existing.visibility === "HIDDEN_BY_MODERATOR" && !access.canModerate) throw new AppError(403, "CONTENT_MODERATED", "Hidden material must be appealed before it can be changed.");
  }
  const kind = existing?.kind ?? z.enum(["ASSESSMENT", "CALENDAR_EVENT", "CALENDAR_UPDATE", "NOTE", "ADVICE", "QUESTION"]).parse(raw.kind);
  const version = existing ? z.number().int().positive().parse(raw.version) : 1;
  const publicOld = existing ? serializeContent(existing, access) : {};
  // Content kind is the outer discriminator; subtype uses assessmentType/eventType on writes.
  const merged: Record<string, unknown> = { ...publicOld, ...raw };
  if (kind === "ASSESSMENT") merged.kind = raw.assessmentType ?? (publicOld as { kind?: string }).kind ?? "Test";
  if (kind === "ASSESSMENT" && merged.date === "") merged.date = undefined;
  if (kind === "CALENDAR_EVENT") merged.kind = raw.eventType ?? (publicOld as { kind?: string }).kind ?? "assignment";
  if (kind === "QUESTION" && existing) {
    // A partial prompt edit must preserve the previous revision's private answer key.
    const revision = await db.questionRevision.findFirst({ where: { questionId: existing.id }, orderBy: { revision: "desc" }, include: { choices: { orderBy: { position: "asc" } } } });
    if (revision) {
      Object.assign(merged, { shortAnswerMode: revision.shortAnswerMode ?? "TEXT", correctChoice: revision.choices.find((c) => c.isCorrect)?.position ?? null,
        explanations: revision.choices.map((c) => c.explanation ?? ""), solution: revision.detailedSolution, acceptedAnswers: revision.acceptedAnswers ?? [],
        caseSensitive: revision.caseSensitive, numericAnswer: revision.numericAnswer === null ? null : Number(revision.numericAnswer),
        absoluteTolerance: Number(revision.absoluteTolerance ?? 0), relativeTolerance: Number(revision.relativeTolerance ?? 0), ...raw });
    }
  }
  if (kind === "QUESTION" && merged.shortAnswerMode == null) merged.shortAnswerMode = "TEXT";
  const parsed = kind === "ASSESSMENT" ? assessmentSchema.parse(merged) : kind === "CALENDAR_EVENT" ? eventSchema.parse(merged) : kind === "NOTE" ? noteSchema.parse(merged) : kind === "ADVICE" ? adviceSchema.parse(merged) : kind === "QUESTION" ? questionSchema.parse(merged) : z.object({ body: body.min(1), calendarEventId: z.string().min(1) }).parse(merged);
  const resultId = await db.$transaction(async (tx) => {
    if (existing) await claimVersion(tx, existing.id, version);
    const item = existing ?? await tx.contentItem.create({ data: { courseId: access.course.id, authorId: access.user.id, kind, publishedAt: new Date() } });
    const courseId = access.course.id;
    if (kind === "ASSESSMENT") {
      const v = parsed as z.infer<typeof assessmentSchema>;
      const fields = { title: v.title, type: ({ Test: "TEST", Quiz: "QUIZ", Assignment: "ASSIGNMENT", Other: "OTHER" } as const)[v.kind], summary: v.summary, description: v.description, isMajor: v.major };
      await tx.assessment.upsert({ where: { contentItemId: item.id }, create: { contentItemId: item.id, courseId, ...fields }, update: fields });
      if (existing) { await tx.assessmentTopic.deleteMany({ where: { assessmentId: item.id } }); await tx.assessmentQuestionTemplate.deleteMany({ where: { assessmentId: item.id } }); }
      await tx.assessmentTopic.createMany({ data: v.topics.map((label, position) => ({ assessmentId: item.id, position, label })) });
      await tx.assessmentQuestionTemplate.createMany({ data: v.templates.map((description, position) => ({ assessmentId: item.id, position, description })) });
      if (v.major) await tx.questionBank.upsert({ where: { assessmentId: item.id }, create: { courseId, assessmentId: item.id, title: v.title }, update: { title: v.title, active: item.visibility === "PUBLISHED" } });
      else await tx.questionBank.updateMany({ where: { assessmentId: item.id }, data: { active: false } });
      if (v.addToCalendar && v.date) {
        const linked = await tx.calendarEvent.findUnique({ where: { assessmentId_courseId: { assessmentId: item.id, courseId } } });
        if (!linked) {
          const event = await tx.contentItem.create({ data: { courseId, authorId: access.user.id, kind: "CALENDAR_EVENT", publishedAt: new Date() } });
          const e = eventSchema.parse({ title: v.title, start: v.date, details: v.summary, kind: "assessment" });
          await tx.calendarEvent.create({ data: { contentItemId: event.id, courseId, assessmentId: item.id, ...calendarData(e) } });
          await recordRevision(tx, event.id, 1, access.user.id, e);
        }
      }
    } else if (kind === "CALENDAR_EVENT") {
      const fields = calendarData(parsed as z.infer<typeof eventSchema>);
      await tx.calendarEvent.upsert({ where: { contentItemId: item.id }, create: { contentItemId: item.id, courseId, ...fields }, update: fields });
    } else if (kind === "CALENDAR_UPDATE") {
      const v = parsed as { calendarEventId: string; body: string };
      const event = await assertPublishedReference(tx, courseId, v.calendarEventId, "CALENDAR_EVENT");
      const visibleEvent = await tx.contentItem.findFirst({ where: { id: event.id, ...publicParentsWhere() }, select: { id: true } });
      if (!visibleEvent) throw new AppError(400, "INVALID_REFERENCE", "The parent assessment is no longer published.");
      if (event.locked && !access.canModerate) throw new AppError(423, "CONTENT_LOCKED", "This event is locked for updates.");
      await tx.calendarUpdate.upsert({ where: { contentItemId: item.id }, create: { contentItemId: item.id, courseId, ...v }, update: { body: v.body } });
    } else if (kind === "NOTE") {
      const v = parsed as z.infer<typeof noteSchema>;
      let visibility: Visibility = existing?.visibility ?? "PUBLISHED";
      if (v.mode === "PDF") {
        const upload = await tx.upload.findFirst({ where: { id: v.uploadId!, ownerId: access.user.id, courseId } });
        if (!upload || ["REJECTED", "FAILED"].includes(upload.status)) throw new AppError(400, "INVALID_UPLOAD", "Choose your accepted PDF upload from this course.");
        if (upload.status !== "CLEAN") visibility = "QUARANTINED";
      }
      const fields = { title: v.title, mode: ({ "Plain text": "PLAIN_TEXT", "Markdown + LaTeX": "MARKDOWN_LATEX", PDF: "PDF" } as const)[v.mode], body: v.mode === "PDF" ? null : v.body!, uploadId: v.mode === "PDF" ? v.uploadId : null };
      await tx.note.upsert({ where: { contentItemId: item.id }, create: { contentItemId: item.id, courseId, ...fields }, update: fields });
      await tx.contentItem.update({ where: { id: item.id }, data: { visibility } });
    } else if (kind === "ADVICE") {
      const v = parsed as z.infer<typeof adviceSchema>;
      if (v.assessmentId) await assertPublishedReference(tx, courseId, v.assessmentId, "ASSESSMENT");
      await tx.advicePost.upsert({ where: { contentItemId: item.id }, create: { contentItemId: item.id, courseId, ...v }, update: v });
    } else if (kind === "QUESTION") {
      const v = parsed as z.infer<typeof questionSchema>;
      const bank = await tx.questionBank.findFirst({ where: { id: v.bankId, courseId, active: true, assessment: { contentItem: { visibility: "PUBLISHED" } } } });
      if (!bank) throw new AppError(400, "INVALID_BANK", "Choose an active major-assessment question bank.");
      await tx.question.upsert({ where: { contentItemId: item.id }, create: { contentItemId: item.id, courseId, bankId: v.bankId }, update: { bankId: v.bankId } });
      const last = await tx.questionRevision.findFirst({ where: { questionId: item.id }, orderBy: { revision: "desc" }, select: { revision: true } });
      await addQuestionRevision(tx, item.id, courseId, access.user.id, (last?.revision ?? 0) + 1, v);
    }
    // Answer keys are held only in QuestionRevision, never in ordinary content history.
    const snapshot = kind === "QUESTION" ? { type: "QUESTION", prompt: (parsed as z.infer<typeof questionSchema>).prompt } : parsed;
    await recordRevision(tx, item.id, existing ? version + 1 : 1, access.user.id, snapshot);
    return item.id;
  });
  return serializeContentForRead(await getContent(access, resultId), access);
}

export async function changeVisibility(access: CourseAccess, id: string, version: number, action: "hide" | "restore") {
  const item = await getContent(access, id);
  await assertCanChangeContent(access.user.id, item);
  if (item.authorId !== access.user.id) throw new AppError(403, "USE_MODERATION", "Use moderation actions with a reason for another author's contribution.");
  if (item.visibility === "HIDDEN_BY_MODERATOR") throw new AppError(403, "CONTENT_MODERATED", "Course staff must restore moderated material.");
  if (item.visibility === "QUARANTINED") throw new AppError(409, "UPLOAD_NOT_READY", "Wait for PDF processing before changing visibility.");
  const visibility = action === "hide" ? "HIDDEN_BY_AUTHOR" : "PUBLISHED";
  await db.$transaction(async (tx) => {
    await claimVersion(tx, id, version);
    await tx.contentItem.update({ where: { id }, data: { visibility, hiddenAt: action === "hide" ? new Date() : null } });
    if (item.assessment) await tx.questionBank.updateMany({ where: { assessmentId: id }, data: { active: action === "restore" && item.assessment.isMajor } });
    await recordRevision(tx, id, version + 1, access.user.id, { action, visibility });
  });
  return serializeContentForRead(await getContent(access, id), access);
}

export { requireCourseAccess };
