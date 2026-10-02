import { describe, expect, it } from "vitest";
import { getComparisonWidth, getImageAspectRatio, getOriginalCanvasAspectRatio } from "./imageAspectRatio";

describe("getImageAspectRatio", () => {
  it("preserves a portrait image ratio", () => {
    expect(getImageAspectRatio(1200, 1800)).toBeCloseTo(2 / 3);
  });

  it("preserves a landscape image ratio", () => {
    expect(getImageAspectRatio(1800, 1200)).toBeCloseTo(3 / 2);
  });

  it("uses a safe fallback when dimensions are unavailable", () => {
    expect(getImageAspectRatio(0, 0)).toBeCloseTo(4 / 3);
  });

  it("uses the uploaded original canvas ratio even when an AI output has a different shape", () => {
    const originalRatio = getOriginalCanvasAspectRatio(1200, 1800);
    const generatedRatio = getImageAspectRatio(1024, 1024);

    expect(originalRatio).toBeCloseTo(2 / 3);
    expect(originalRatio).not.toBe(generatedRatio);
  });
});

describe("getComparisonWidth", () => {
  it("limits portrait comparison width while retaining its ratio", () => {
    expect(getComparisonWidth(2 / 3, 430)).toBe("min(100%, 287px)");
  });
});
