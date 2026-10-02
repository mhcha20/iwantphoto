import { describe, expect, it } from "vitest";
import { canShowImageComparison, returnToOriginalPreview, shouldShowImageComparison } from "./imageComparisonDisplay";

describe("image comparison display", () => {
  it("only offers comparison when an output image exists", () => {
    expect(canShowImageComparison(undefined)).toBe(false);
    expect(canShowImageComparison("processed.png")).toBe(true);
  });

  it("opens the slide comparison only when the user selects it and an output exists", () => {
    expect(shouldShowImageComparison("single", "processed.png")).toBe(false);
    expect(shouldShowImageComparison("compare", undefined)).toBe(false);
    expect(shouldShowImageComparison("compare", "processed.png")).toBe(true);
  });

  it("returns to the full original image only when the explicit exit action is used", () => {
    expect(returnToOriginalPreview()).toEqual({ view: "single", preview: "original" });
  });
});
