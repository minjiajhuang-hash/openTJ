import { Prisma } from "@prisma/client";
import { z } from "zod";
import { gradeAnswer, type GradingQuestion } from "../grading";
import { assertCanChangeContent, type CourseAccess } from "./auth";
import { db } from "./db";
import { getContent, serializeContent } from "./content";
import { AppError } from "./http";

export const answerSchema = z.object({ revisionId: z.string().min(1), idempotencyKey: z.string().min(8).max(100),
  choice: z.number().int().min(0).max(11).optional(), text: z.string().trim().max(30_000).optional(), number: z.number().finite().optional(), unit: z.string().max(50).optional() });
const revisionInclude = Prisma.validator<Prisma.QuestionRevisionInclude>()({ choices: { orderBy: { position: "asc" } }, skills: { include: { skill: true } },
  question: { include: { contentItem: true, bank: { include: { assessment: { include: { contentItem: true } } } } } } });
type Revision = Prisma.QuestionRevisionGetPayload<{ include: typeof revisionInclude }>;
function sameSubmission(left: unknown, right: unknown) {
  return JSON.stringify(Object.entries(left as Record<string, unknown>).sort()) === JSON.stringify(Object.entries(right as Record<string, unknown>).sort());
}

export { questionFlags } from "./question-flags";
async function accessibleRevision(access: CourseAccess, id: string, revisionId: string): Promise<Revision> {
  const revision = await db.questionRevision.findFirst({ where: { id: revisionId, questionId: id }, include: revisionInclude });
  if (!revision || revision.question.courseId !== access.course.id || revision.question.contentItem.visibility !== "PUBLISHED" || !revision.question.bank.active || revision.question.bank.assessment.contentItem.visibility !== "PUBLISHED") {
    throw new AppError(404, "QUESTION_NOT_FOUND", "This question is no longer available for practice.");
  }
  return revision;
}
function gradingConfig(r: Revision): GradingQuestion {
  if (r.type === "SINGLE_CHOICE") return { type: "SINGLE_CHOICE", correctChoice: r.choices.find((c) => c.isCorrect)?.position };
  if (r.type === "LONG_RESPONSE") return { type: "LONG_RESPONSE" };
  if (r.shortAnswerMode === "NUMERIC" && r.numericAnswer !== null) return { type: "NUMBER", answer: Number(r.numericAnswer), unit: r.unit ?? undefined, absoluteTolerance: Number(r.absoluteTolerance ?? 0), relativeTolerance: Number(r.relativeTolerance ?? 0) };
  return { type: "SHORT_ANSWER", acceptedAnswers: Array.isArray(r.acceptedAnswers) ? r.acceptedAnswers.filter((v): v is string => typeof v === "string") : r.canonicalAnswer ? [r.canonicalAnswer] : [], caseSensitive: r.caseSensitive };
}

export async function checkAnswer(access: CourseAccess, id: string, input: z.infer<typeof answerSchema>) {
  const revision = await accessibleRevision(access, id, input.revisionId);
  const submitted = { choice: input.choice, text: input.text, number: input.number, unit: input.unit };
  if (revision.type === "SINGLE_CHOICE" && (input.choice === undefined || input.choice >= revision.choices.length)) throw new AppError(400, "ANSWER_REQUIRED", "Choose one of the available answers.");
  if (revision.type !== "SINGLE_CHOICE" && input.number === undefined && !input.text) throw new AppError(400, "ANSWER_REQUIRED", "Enter an answer before submitting.");
  const old = await db.practiceAttempt.findUnique({ where: { userId_idempotencyKey: { userId: access.user.id, idempotencyKey: input.idempotencyKey } } });
  const normalizedSubmitted = JSON.parse(JSON.stringify(submitted)) as Prisma.InputJsonObject;
  if (old) {
    if (old.revisionId !== input.revisionId || !sameSubmission(old.submitted, normalizedSubmitted)) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This request key was already used for a different answer.");
    return { id: old.id, result: old.result, feedback: old.feedback };
  }
  let parsedNumber = input.number;
  if (revision.shortAnswerMode === "NUMERIC" && parsedNumber === undefined && input.text && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input.text.trim())) parsedNumber = Number(input.text);
  const graded = gradeAnswer(gradingConfig(revision), { ...submitted, number: parsedNumber });
  const result = graded === "COMPARED" ? "UNGRADED" : graded;
  const feedback = { message: result === "CORRECT" ? "Correct." : result === "INCORRECT" ? "That answer is not correct. Review the explanation and try again." : "This response is ungraded. Reveal the solution to compare your reasoning.",
    explanations: revision.choices.map((c) => c.explanation ?? ""), correctChoice: revision.choices.find((c) => c.isCorrect)?.position ?? null };
  const attempt = await db.practiceAttempt.upsert({ where: { userId_idempotencyKey: { userId: access.user.id, idempotencyKey: input.idempotencyKey } },
    create: { userId: access.user.id, revisionId: revision.id, idempotencyKey: input.idempotencyKey, submitted: normalizedSubmitted, result, feedback }, update: {} }).catch(async (error: unknown) => {
      // Prisma may implement an empty-update upsert as read+insert. A simultaneous
      // button/Enter request can win that insert; return its committed attempt.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return db.practiceAttempt.findUniqueOrThrow({ where: { userId_idempotencyKey: { userId: access.user.id, idempotencyKey: input.idempotencyKey } } });
      }
      throw error;
    });
  if (attempt.revisionId !== input.revisionId || !sameSubmission(attempt.submitted, normalizedSubmitted)) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This request key was already used for a different answer.");
  return { id: attempt.id, result: attempt.result, feedback: attempt.feedback };
}
export async function revealSolution(access: CourseAccess, id: string, revisionId: string) {
  const revision = await accessibleRevision(access, id, revisionId);
  return { solution: revision.detailedSolution ?? "No detailed solution has been supplied.", explanations: revision.choices.map((c) => c.explanation ?? ""),
    correctChoice: revision.choices.find((c) => c.isCorrect)?.position ?? null,
    acceptedAnswers: revision.acceptedAnswers, numericAnswer: revision.numericAnswer?.toString() ?? null, unit: revision.unit };
}
export async function editableContent(access: CourseAccess, id: string) {
  const item = await getContent(access, id);
  await assertCanChangeContent(access.user.id, item);
  const content = serializeContent(item, access);
  if (!item.question) return content;
  const r = await db.questionRevision.findFirst({ where: { questionId: id }, orderBy: { revision: "desc" }, include: { choices: { orderBy: { position: "asc" } } } });
  if (!r) throw new AppError(404, "QUESTION_NOT_FOUND", "Question revision not found.");
  return { ...content, correctChoice: r.choices.find((c) => c.isCorrect)?.position ?? null, explanations: r.choices.map((c) => c.explanation ?? ""), solution: r.detailedSolution,
    acceptedAnswers: r.acceptedAnswers ?? [], numericAnswer: r.numericAnswer === null ? null : Number(r.numericAnswer), caseSensitive: r.caseSensitive,
    absoluteTolerance: Number(r.absoluteTolerance ?? 0), relativeTolerance: Number(r.relativeTolerance ?? 0), authorized: true };
}
export async function privateHistory(userId: string, limit: number, cursor?: string) {
  const attempts = await db.practiceAttempt.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), include: { revision: { select: { id: true, revision: true, prompt: true, question: { select: { contentItemId: true, bank: { select: { title: true } } } } } } } });
  return { attempts: attempts.slice(0, limit).map((a) => ({ id: a.id, revisionId: a.revisionId, questionId: a.revision.question.contentItemId, revision: a.revision.revision,
    assessment: a.revision.question.bank.title, prompt: a.revision.prompt, submitted: a.submitted, response: JSON.stringify(a.submitted), result: a.result, when: a.createdAt.toISOString() })),
    nextCursor: attempts.length > limit ? attempts[limit - 1]?.id ?? null : null };
}
