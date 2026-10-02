import { describe, expect, it } from "vitest";
import { constrainComparisonPosition } from "./comparisonPosition";

describe("constrainComparisonPosition", () => {
  it("preserves a valid comparison split", () => {
    expect(constrainComparisonPosition(50)).toBe(50);
  });

  it("keeps the before image visibly available at the lower bound", () => {
    expect(constrainComparisonPosition(-20)).toBe(4);
  });

  it("keeps the after image visibly available at the upper bound", () => {
    expect(constrainComparisonPosition(130)).toBe(96);
  });
});
