import { describe, expect, it } from "vitest";
import { sanitizeReturnTo } from "@/lib/server/oauth";

describe("OAuth return URL allowlist", () => {
  it.each(["https://evil.example", "//evil.example", "/unknown", "/courses\\evil"])("rejects %s", (value) => {
    expect(sanitizeReturnTo(value)).toBe("/courses");
  });

  it("keeps allowed local destinations", () => {
    expect(sanitizeReturnTo("/courses/concrete-math-av-p4/notes?mine=1")).toBe("/courses/concrete-math-av-p4/notes?mine=1");
  });
});
