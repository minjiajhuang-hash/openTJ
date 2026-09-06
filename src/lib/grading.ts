export type GradingQuestion =
  | { type: "SINGLE_CHOICE"; correctChoice?: number }
  | { type: "SHORT_ANSWER"; acceptedAnswers?: string[]; caseSensitive?: boolean }
  | { type: "NUMBER"; answer: number; absoluteTolerance?: number; relativeTolerance?: number; unit?: string }
  | { type: "LONG_RESPONSE" };

export type GradeResult = "CORRECT" | "INCORRECT" | "UNGRADED" | "COMPARED";

export function normalizeText(value: string, caseSensitive = false): string {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return caseSensitive ? normalized : normalized.toLocaleLowerCase("en-US");
}

export function gradeAnswer(question: GradingQuestion, answer: { choice?: number; text?: string; number?: number; unit?: string }): GradeResult {
  if (question.type === "LONG_RESPONSE") return "COMPARED";
  if (question.type === "SINGLE_CHOICE") {
    if (question.correctChoice === undefined) return "UNGRADED";
    return answer.choice === question.correctChoice ? "CORRECT" : "INCORRECT";
  }
  if (question.type === "SHORT_ANSWER") {
    if (!question.acceptedAnswers?.length) return "UNGRADED";
    const submitted = normalizeText(answer.text ?? "", question.caseSensitive);
    return question.acceptedAnswers.some((candidate) => normalizeText(candidate, question.caseSensitive) === submitted) ? "CORRECT" : "INCORRECT";
  }
  if (!Number.isFinite(answer.number)) return "INCORRECT";
  if (question.unit && normalizeText(answer.unit ?? "") !== normalizeText(question.unit)) return "INCORRECT";
  const difference = Math.abs((answer.number as number) - question.answer);
  const absolute = Math.max(question.absoluteTolerance ?? 0, 0);
  const relative = Math.max(question.relativeTolerance ?? 0, 0) * Math.abs(question.answer);
  return difference <= Math.max(absolute, relative) ? "CORRECT" : "INCORRECT";
}
