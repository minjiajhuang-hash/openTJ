import { afterEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/server/db", () => ({ db: { contentItem: { findMany } } }));
const { retentionCutoffs, runRetention } = await import("@/lib/server/retention");

afterEach(() => vi.unstubAllEnvs());
describe("Retention preservation and calendar cutoffs", () => {
  it("performs no database reads or erasure while preservation is enabled", async () => {
    vi.stubEnv("PRESERVATION_HOLD", "true");
    expect(await runRetention()).toEqual({ held: true, expired: 0, files: 0, audit: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });
  it("uses 90 elapsed days and clamps 13 calendar months at month end", () => {
    const now = new Date("2026-03-31T15:00:00.000Z");
    const cutoffs = retentionCutoffs(now);
    expect(now.getTime() - cutoffs.hidden.getTime()).toBe(90 * 86_400_000);
    expect(cutoffs.audit.toISOString()).toBe("2025-02-28T15:00:00.000Z");
  });
});
