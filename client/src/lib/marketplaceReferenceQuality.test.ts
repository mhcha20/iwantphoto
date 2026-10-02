import { describe, expect, it } from "vitest";
import { evaluateMarketplaceReferenceQuality } from "./marketplaceReferenceQuality";

describe("marketplace reference image readiness", () => {
  it("accepts a clear, sufficiently large product reference", () => {
    const quality = evaluateMarketplaceReferenceQuality({ width: 1800, height: 1800, bytes: 900_000, edgeVariation: 10, centerContrast: 24 });
    expect(quality.readiness).toBe("ready");
    expect(quality.notices).toEqual([]);
  });

  it("flags low resolution, compressed and visually difficult references without blocking the workflow", () => {
    const quality = evaluateMarketplaceReferenceQuality({ width: 600, height: 420, bytes: 48_000, edgeVariation: 38, centerContrast: 4 });
    expect(quality.readiness).toBe("attention");
    expect(quality.notices.join(" ")).toContain("解析度");
    expect(quality.notices.join(" ")).toContain("背景");
  });
});
