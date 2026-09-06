import { Prisma } from "@prisma/client";
import { db } from "./db";
import { deleteObject } from "./storage";

const REMOVED = "Removed under the retention policy";
const reviewStatuses = ["OPEN", "APPEALED"] as const;

export function retentionCutoffs(now: Date) {
  const hidden = new Date(now.getTime() - 90 * 86_400_000);
  const audit = new Date(now);
  // Calendar months, clamping month-end days rather than rolling into the next month.
  const day = audit.getUTCDate();
  audit.setUTCDate(1);
  audit.setUTCMonth(audit.getUTCMonth() - 13);
  const lastDay = new Date(Date.UTC(audit.getUTCFullYear(), audit.getUTCMonth() + 1, 0)).getUTCDate();
  audit.setUTCDate(Math.min(day, lastDay));
  return { hidden, audit };
}

/**
 * Bounded hourly lifecycle work. PRESERVATION_HOLD=true pauses all retention for
 * a school review. Open reports/appeals independently preserve their contents.
 * Revisions are immutable during use: expiry is the explicit erasure exception.
 * Revision/attempt IDs and historical grading outcomes remain for private history.
 */
export async function runRetention(now = new Date()) {
  if (process.env.PRESERVATION_HOLD === "true") return { held: true, expired: 0, files: 0, audit: 0 };
  const cutoff = retentionCutoffs(now);
  const reportsClear = { none: { OR: [{ status: { in: [...reviewStatuses] } }, { appeals: { some: { status: "OPEN" as const } } }] } };
  const candidates = await db.contentItem.findMany({ where: { visibility: { in: ["HIDDEN_BY_AUTHOR", "HIDDEN_BY_MODERATOR"] }, hiddenAt: { lt: cutoff.hidden }, reports: reportsClear },
    orderBy: { hiddenAt: "asc" }, take: 25, select: { id: true, version: true, kind: true } });
  let expired = 0;
  for (const item of candidates) {
    if (process.env.PRESERVATION_HOLD === "true") break;
    const erased = await db.$transaction(async (tx) => {
      // Reports/appeals take this same row lock, closing the race between an
      // arriving school review and the expiry eligibility check.
      await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${item.id} FOR UPDATE`;
      const changed = await tx.contentItem.updateMany({ where: { id: item.id, version: item.version, visibility: { in: ["HIDDEN_BY_AUTHOR", "HIDDEN_BY_MODERATOR"] }, hiddenAt: { lt: cutoff.hidden }, reports: reportsClear }, data: { visibility: "DELETED", deletedAt: now, version: { increment: 1 } } });
      if (!changed.count) return false;
      await tx.contentRevision.deleteMany({ where: { contentItemId: item.id } });
      if (item.kind === "ASSESSMENT") {
        await tx.assessment.update({ where: { contentItemId: item.id }, data: { title: REMOVED, summary: "", description: "", topics: { deleteMany: {} }, templates: { deleteMany: {} } } });
        await tx.questionBank.updateMany({ where: { assessmentId: item.id }, data: { active: false, title: REMOVED } });
        // Start the same recovery clock for dependent content that loses its parent.
        await tx.contentItem.updateMany({ where: { visibility: "PUBLISHED", OR: [{ calendarEvent: { assessmentId: item.id } }, { question: { bank: { assessmentId: item.id } } }] }, data: { visibility: "HIDDEN_BY_MODERATOR", hiddenAt: now, version: { increment: 1 } } });
      } else if (item.kind === "CALENDAR_EVENT") {
        await tx.calendarEvent.update({ where: { contentItemId: item.id }, data: { title: REMOVED, details: "" } });
        await tx.contentItem.updateMany({ where: { visibility: "PUBLISHED", calendarUpdate: { calendarEventId: item.id } }, data: { visibility: "HIDDEN_BY_MODERATOR", hiddenAt: now, version: { increment: 1 } } });
      } else if (item.kind === "CALENDAR_UPDATE") await tx.calendarUpdate.update({ where: { contentItemId: item.id }, data: { body: REMOVED } });
      else if (item.kind === "NOTE") {
        await tx.note.updateMany({ where: { contentItemId: item.id, mode: { not: "PDF" } }, data: { title: REMOVED, body: REMOVED } });
        await tx.note.updateMany({ where: { contentItemId: item.id, mode: "PDF" }, data: { title: REMOVED, body: null } });
      }
      else if (item.kind === "ADVICE") await tx.advicePost.update({ where: { contentItemId: item.id }, data: { title: REMOVED, body: REMOVED } });
      else if (item.kind === "QUESTION") {
        await tx.questionRevision.updateMany({ where: { questionId: item.id }, data: { prompt: REMOVED, canonicalAnswer: null, acceptedAnswers: Prisma.DbNull, numericAnswer: null, detailedSolution: null, unit: null } });
        await tx.questionChoice.updateMany({ where: { revision: { questionId: item.id } }, data: { text: REMOVED, explanation: null, isCorrect: false } });
        await tx.questionRevisionSkill.deleteMany({ where: { revision: { questionId: item.id } } });
      }
      return true;
    });
    if (erased) expired += 1;
  }
  // Object deletion follows the committed tombstone. Failures retry next pass;
  // bytes=0 acknowledges deletion without making an unavailable object public.
  const uploads = await db.upload.findMany({ where: { bytes: { gt: 0 }, OR: [{ note: { contentItem: { visibility: "DELETED" } } }, { note: null, createdAt: { lt: cutoff.hidden }, status: { not: "SCANNING" } }] }, take: 25, select: { id: true, objectKey: true } });
  let files = 0;
  for (const upload of uploads) {
    if (process.env.PRESERVATION_HOLD === "true") break;
    try {
      await deleteObject(upload.objectKey);
      await db.upload.update({ where: { id: upload.id }, data: { bytes: 0, status: "REJECTED", originalName: "removed.pdf", failureReason: REMOVED, sha256: null } });
      files += 1;
    } catch { console.warn(JSON.stringify({ event: "retention_file_retry", uploadId: upload.id })); }
  }
  const oldAudit = await db.auditEvent.findMany({ where: { createdAt: { lt: cutoff.audit }, OR: [{ course: null }, { course: { reports: reportsClear } }] }, take: 200, select: { id: true } });
  if (process.env.PRESERVATION_HOLD === "true") return { held: true, expired, files, audit: 0 };
  const audit = await db.auditEvent.deleteMany({ where: { id: { in: oldAudit.map((event) => event.id) } } });
  const oldReports = await db.report.findMany({ where: { createdAt: { lt: cutoff.audit }, status: { notIn: [...reviewStatuses] }, appeals: { none: { status: "OPEN" } } }, take: 100, select: { id: true } });
  await db.report.deleteMany({ where: { id: { in: oldReports.map((report) => report.id) } } });
  const oldActions = await db.moderationAction.findMany({ where: { createdAt: { lt: cutoff.audit }, report: null, appeals: { none: { status: "OPEN" } } }, take: 100, select: { id: true } });
  await db.moderationAction.deleteMany({ where: { id: { in: oldActions.map((action) => action.id) } } });
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.oAuthTransaction.deleteMany({ where: { expiresAt: { lt: now } } });
  return { held: false, expired, files, audit: audit.count };
}
