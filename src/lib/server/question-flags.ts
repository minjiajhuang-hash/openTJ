import { Prisma } from "@prisma/client";
import { db } from "./db";

export async function questionFlags(ids: string[]) {
  if (!ids.length) return new Map<string, boolean>();
  // Compute the presence of an answer within PostgreSQL; answer values never leave this query.
  const rows = await db.$queryRaw<{ id: string; graded: boolean }[]>(Prisma.sql`
    SELECT r.id, CASE WHEN r.type = 'SINGLE_CHOICE' THEN EXISTS (SELECT 1 FROM "QuestionChoice" c WHERE c."revisionId" = r.id AND c."isCorrect")
    WHEN r.type = 'SHORT_ANSWER' THEN (r."numericAnswer" IS NOT NULL OR r."canonicalAnswer" IS NOT NULL OR (jsonb_typeof(r."acceptedAnswers") = 'array' AND jsonb_array_length(r."acceptedAnswers") > 0))
    ELSE FALSE END AS graded FROM "QuestionRevision" r WHERE r.id IN (${Prisma.join(ids)})`);
  return new Map(rows.map((row) => [row.id, row.graded]));
}
