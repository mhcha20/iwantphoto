import { describe, expect, it } from "vitest";
import { getStorageUsagePercentage, isStorageNearCapacity } from "./storageUsage";

describe("storage usage display", () => {
  it("constrains a progress result to the display range", () => {
    expect(getStorageUsagePercentage(50, 100)).toBe(50);
    expect(getStorageUsagePercentage(200, 100)).toBe(100);
    expect(getStorageUsagePercentage(1, 0)).toBe(0);
  });

  it("raises a warning at 85 percent capacity", () => {
    expect(isStorageNearCapacity(84, 100)).toBe(false);
    expect(isStorageNearCapacity(85, 100)).toBe(true);
  });
});
