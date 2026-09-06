import { describe, expect, it } from "vitest";
import { gradeAnswer, normalizeText } from "@/lib/grading";

describe("deterministic grading", () => {
  it("normalizes Unicode and whitespace for short answers", () => {
    expect(normalizeText("  CAFÉ\n au   lait ")).toBe("café au lait");
  });

  it("grades choices without exposing an answer when ungraded", () => {
    expect(gradeAnswer({ type: "SINGLE_CHOICE", correctChoice: 2 }, { choice: 2 })).toBe("CORRECT");
    expect(gradeAnswer({ type: "SINGLE_CHOICE" }, { choice: 0 })).toBe("UNGRADED");
  });

  it("accepts aliases and honors case sensitivity", () => {
    expect(gradeAnswer({ type: "SHORT_ANSWER", acceptedAnswers: ["four", "4"] }, { text: " FOUR " })).toBe("CORRECT");
    expect(gradeAnswer({ type: "SHORT_ANSWER", acceptedAnswers: ["TJ"], caseSensitive: true }, { text: "tj" })).toBe("INCORRECT");
  });

  it("grades finite numeric answers with tolerance and units", () => {
    expect(gradeAnswer({ type: "NUMBER", answer: 2.5, absoluteTolerance: 0.01, unit: "m" }, { number: 2.505, unit: "M" })).toBe("CORRECT");
    expect(gradeAnswer({ type: "NUMBER", answer: 2.5 }, { number: Number.NaN })).toBe("INCORRECT");
  });

  it("never claims an automated grade for long responses", () => {
    expect(gradeAnswer({ type: "LONG_RESPONSE" }, { text: "A proof" })).toBe("COMPARED");
  });
});
