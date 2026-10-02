import { describe, expect, it } from "vitest";
import { formatMarketplaceGenerationSeconds, getMarketplaceGenerationProgress } from "./marketplaceGenerationProgress";

describe("marketplace generation progress", () => {
  it("shows the current role and a bounded estimated completion", () => {
    const progress = getMarketplaceGenerationProgress({
      channel: "amazon",
      roles: ["main", "detail", "lifestyle"],
      startedAt: 1_000,
      completedCount: 1,
      now: 23_000,
    });
    expect(progress).toMatchObject({ role: "detail", completed: 1, total: 3 });
    expect(progress?.percent).toBeGreaterThan(33);
    expect(progress?.percent).toBeLessThan(96);
    expect(progress?.estimatedRemainingSeconds).toBeGreaterThan(0);
  });

  it("never moves backwards when a long-running final role exceeds the estimate", () => {
    const roles = ["main", "studio", "detail", "lifestyle"] as const;
    const samples = [20_000, 40_000, 80_000, 120_000].map((elapsed) => getMarketplaceGenerationProgress({
      channel: "amazon",
      roles: [...roles],
      startedAt: 1_000,
      completedCount: 3,
      now: 1_000 + elapsed,
    }));
    const percentages = samples.map((sample) => sample?.percent ?? 0);

    expect(percentages).toEqual([...percentages].sort((left, right) => left - right));
    expect(percentages.at(-1)).toBe(96);
    expect(samples.at(-1)).toMatchObject({ role: "lifestyle", isOverEstimate: true, estimatedRemainingSeconds: 0 });
  });

  it("marks progress copy as estimated before the conservative suite duration", () => {
    const progress = getMarketplaceGenerationProgress({
      channel: "amazon",
      roles: ["main", "studio", "detail", "lifestyle"],
      startedAt: 1_000,
      completedCount: 2,
      now: 21_000,
    });

    expect(progress).toMatchObject({ role: "detail", isOverEstimate: false, estimatedRemainingSeconds: 60 });
  });

  it("returns no progress before suite generation starts", () => {
    expect(getMarketplaceGenerationProgress({ channel: "amazon", roles: ["main"], startedAt: null })).toBeNull();
  });

  it("formats seconds for compact mobile copy", () => {
    expect(formatMarketplaceGenerationSeconds(12)).toBe("約 12 秒");
    expect(formatMarketplaceGenerationSeconds(61)).toBe("約 2 分鐘");
  });
});
