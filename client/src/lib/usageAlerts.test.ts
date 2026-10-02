import { describe, expect, it } from "vitest";
import { getUsageAlert } from "./usageAlerts";

describe("usage allowance alerts", () => {
  it("does not alert under eighty percent", () => {
    expect(getUsageAlert(7, 10, "starter").level).toBe("none");
  });

  it("raises a progressive alert at eighty and ninety percent", () => {
    expect(getUsageAlert(8, 10, "starter")).toMatchObject({ level: "notice", percentage: 80, shouldSuggestUpgrade: true });
    expect(getUsageAlert(9, 10, "starter")).toMatchObject({ level: "warning", percentage: 90, shouldSuggestUpgrade: true });
  });

  it("stops offering an unavailable upgrade at the business limit", () => {
    expect(getUsageAlert(750, 750, "business")).toMatchObject({ level: "limit", shouldSuggestUpgrade: false });
  });
});
