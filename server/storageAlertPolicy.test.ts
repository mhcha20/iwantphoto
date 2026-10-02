import { describe, expect, it } from "vitest";
import { getHighestStorageAlertThreshold, getStorageAlertCopy, shouldRearmStorageAlerts, storageUsagePercent } from "./storageAlertPolicy";

describe("storage alert policy", () => {
  it("selects a single highest alert threshold to avoid duplicate notices", () => {
    expect(getHighestStorageAlertThreshold(79, 100)).toBeNull();
    expect(getHighestStorageAlertThreshold(80, 100)).toBe(80);
    expect(getHighestStorageAlertThreshold(95, 100)).toBe(95);
    expect(getHighestStorageAlertThreshold(130, 100)).toBe(95);
  });

  it("returns capacity-specific customer guidance", () => {
    expect(getStorageAlertCopy(80)).toMatchObject({ subject: expect.stringContaining("80%"), tone: "notice" });
    expect(getStorageAlertCopy(95)).toMatchObject({ subject: expect.stringContaining("95%"), tone: "critical" });
  });

  it("formats an accurate bounded percentage", () => {
    expect(storageUsagePercent(853, 1000)).toBe(85.3);
    expect(storageUsagePercent(200, 100)).toBe(100);
    expect(storageUsagePercent(1, 0)).toBe(0);
  });

  it("rearms notices only after capacity falls below the hysteresis threshold", () => {
    expect(shouldRearmStorageAlerts(74, 100)).toBe(true);
    expect(shouldRearmStorageAlerts(75, 100)).toBe(false);
  });
});
