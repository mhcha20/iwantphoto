import { describe, expect, it } from "vitest";
import { adjustComparisonAlignment, adjustComparisonScale, DEFAULT_COMPARISON_ALIGNMENT, getComparisonAlignmentTransform, updateComparisonAlignment } from "./imageAlignment";

describe("comparison alignment", () => {
  it("moves the processed image by explicit operator-controlled offsets", () => {
    expect(adjustComparisonAlignment(DEFAULT_COMPARISON_ALIGNMENT, -2, 1)).toEqual({ x: -2, y: 1, scale: 1 });
    expect(getComparisonAlignmentTransform({ x: -2, y: 1, scale: 1 })).toBe("translate(-2%, 1%) scale(1)");
  });

  it("keeps manual adjustments within a safe preview range", () => {
    expect(adjustComparisonAlignment({ x: 19, y: -19, scale: 1 }, 8, -8)).toEqual({ x: 20, y: -20, scale: 1 });
  });

  it("allows fine operator-controlled scaling within a safe preview range", () => {
    expect(adjustComparisonScale(DEFAULT_COMPARISON_ALIGNMENT, 0.0025)).toEqual({ x: 0, y: 0, scale: 1.0025 });
    expect(adjustComparisonScale({ x: 0, y: 0, scale: 1.19 }, 0.1)).toEqual({ x: 0, y: 0, scale: 1.2 });
  });

  it("supports direct 0.25 percent x/y/scale slider values while keeping all values safe", () => {
    expect(updateComparisonAlignment(DEFAULT_COMPARISON_ALIGNMENT, { x: 1.25, y: -0.25, scale: 0.9975 })).toEqual({ x: 1.25, y: -0.25, scale: 0.9975 });
  });
});
