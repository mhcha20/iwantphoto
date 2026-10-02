import { describe, expect, it } from "vitest";
import { estimateBatchProgress, estimateSingleImageProgress, formatEstimatedSeconds } from "./batchProgress";

describe("batch progress estimation", () => {
  it("uses completed image duration to estimate percentage and remaining time", () => {
    const result = estimateBatchProgress({
      total: 3,
      completed: 1,
      completedDurationMs: 20_000,
      currentStartedAt: 20_000,
    }, 30_000);

    expect(result.percentage).toBe(50);
    expect(result.remainingSeconds).toBe(30);
    expect(result.averageImageDurationMs).toBe(20_000);
  });

  it("uses a conservative initial estimate before the first image completes", () => {
    const result = estimateBatchProgress({
      total: 3,
      completed: 0,
      completedDurationMs: 0,
      currentStartedAt: 0,
    }, 9_000);

    expect(result.percentage).toBe(17);
    expect(result.remainingSeconds).toBe(45);
  });

  it("formats estimated time in Traditional Chinese", () => {
    expect(formatEstimatedSeconds(4)).toBe("少於 5 秒");
    expect(formatEstimatedSeconds(26)).toBe("約 26 秒");
    expect(formatEstimatedSeconds(78)).toBe("約 1 分 18 秒");
  });

  it("shows an estimated single-image percentage without reporting completion early", () => {
    expect(estimateSingleImageProgress(0, 9_000)).toMatchObject({ percentage: 50, remainingSeconds: 9 });
    expect(estimateSingleImageProgress(0, 30_000)).toMatchObject({ percentage: 95, remainingSeconds: 0 });
  });
});
