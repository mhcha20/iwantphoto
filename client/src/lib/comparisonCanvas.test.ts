import { describe, expect, it } from "vitest";
import { getComparisonImageFit, getCoordinateAlignmentDescription } from "./comparisonCanvas";

describe("comparison canvas", () => {
  it("maps both layers to the same original-image coordinate canvas", () => {
    expect(getComparisonImageFit()).toBe("object-fill");
    expect(getCoordinateAlignmentDescription()).toContain("相同座標");
  });
});
