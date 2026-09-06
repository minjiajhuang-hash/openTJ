import { describe, expect, it } from "vitest";
import { assessmentSchema, adviceSchema, calendarData, contentInclude, eventSchema, noteSchema, questionSchema } from "@/lib/server/content";

describe("Contribution boundaries", () => {
  it("requires an assessment for specific advice and rejects one on general advice", () => {
    expect(adviceSchema.safeParse({ type: "ASSESSMENT_SPECIFIC", title: "Study advice", body: "Review examples." }).success).toBe(false);
    expect(adviceSchema.safeParse({ type: "GENERAL", title: "Study advice", body: "Review examples.", assessmentId: "assessment-1" }).success).toBe(false);
  });
  it("accepts exactly one note representation", () => {
    expect(noteSchema.safeParse({ title: "Notes", mode: "PDF", uploadId: "upload-1", body: "hidden text" }).success).toBe(false);
    expect(noteSchema.safeParse({ title: "Notes", mode: "Plain text", body: "Useful note", uploadId: "upload-1" }).success).toBe(false);
    expect(noteSchema.safeParse({ title: "Notes", mode: "PDF", uploadId: "upload-1" }).success).toBe(true);
  });
  it("requires a calendar date when requesting simultaneous assessment linking", () => {
    expect(assessmentSchema.safeParse({ title: "Exam", addToCalendar: true }).success).toBe(false);
  });
});

describe("Calendar date semantics", () => {
  it("preserves all-day dates through DST boundaries", () => {
    const event = calendarData(eventSchema.parse({ title: "Assignment", start: "2026-11-01", end: "2026-11-02" }));
    expect(event.startDate?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(event.endDate?.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(event.startsAt).toBeNull();
  });
  it("converts timed events to UTC and requires explicit offsets", () => {
    const event = calendarData(eventSchema.parse({ title: "Review", start: "2026-09-08T15:00:00-04:00", allDay: false }));
    expect(event.startsAt?.toISOString()).toBe("2026-09-08T19:00:00.000Z");
    expect(event.startDate).toBeNull();
    expect(() => calendarData(eventSchema.parse({ title: "Review", start: "2026-09-08T15:00:00", allDay: false }))).toThrow("timezone offset");
  });
  it("rejects impossible calendar dates and backwards ranges", () => {
    expect(eventSchema.safeParse({ title: "Review", start: "2026-02-30" }).success).toBe(false);
    expect(eventSchema.safeParse({ title: "Review", start: "2026-09-09", end: "2026-09-08" }).success).toBe(false);
  });
});

describe("Question authoring and answer isolation", () => {
  const base = { bankId: "bank", prompt: "An original question", skills: [], authorized: true };
  it("allows ungraded choices but rejects invalid answer indexes and missing attestation", () => {
    expect(questionSchema.safeParse({ ...base, type: "SINGLE_CHOICE", choices: ["A", "B"] }).success).toBe(true);
    expect(questionSchema.safeParse({ ...base, type: "SINGLE_CHOICE", choices: ["A", "B"], correctChoice: 2 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, authorized: false, type: "LONG_RESPONSE" }).success).toBe(false);
  });
  it("rejects nonfinite numbers and negative tolerances", () => {
    expect(questionSchema.safeParse({ ...base, type: "SHORT_ANSWER", shortAnswerMode: "NUMERIC", numericAnswer: Infinity }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, type: "SHORT_ANSWER", shortAnswerMode: "NUMERIC", numericAnswer: 3, absoluteTolerance: -1 }).success).toBe(false);
  });
  it("ordinary content reads never select answer keys or solutions", () => {
    const selection = JSON.stringify(contentInclude.question);
    for (const privateField of ["canonicalAnswer", "acceptedAnswers", "numericAnswer", "isCorrect", "detailedSolution", "explanation"]) {
      expect(selection).not.toContain(privateField);
    }
  });
});
