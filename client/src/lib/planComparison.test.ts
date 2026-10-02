import { describe, expect, it } from "vitest";
import { ACCOUNT_PLANS } from "@shared/plans";
import { getPlanComparisonValue, PLAN_COMPARISON_ROWS } from "./planComparison";

describe("monthly plan comparison data", () => {
  it("compares the published plans across five decision-relevant criteria", () => {
    expect(PLAN_COMPARISON_ROWS.map((row) => row.key)).toEqual([
      "monthlyPrice",
      "allowance",
      "storage",
      "workflow",
      "bestFor",
    ]);
  });

  it("uses the live plan catalog values instead of separate pricing claims", () => {
    const price = PLAN_COMPARISON_ROWS.find((row) => row.key === "monthlyPrice")!;
    const allowance = PLAN_COMPARISON_ROWS.find((row) => row.key === "allowance")!;
    const storage = PLAN_COMPARISON_ROWS.find((row) => row.key === "storage")!;

    expect(getPlanComparisonValue(price, "starter")).toBe("免費");
    expect(getPlanComparisonValue(price, "pro")).toBe(`HK$${ACCOUNT_PLANS.pro.monthlyPrice.toLocaleString()}／月`);
    expect(getPlanComparisonValue(allowance, "business")).toBe("750 張");
    expect(getPlanComparisonValue(storage, "business")).toBe("50 GB");
  });
});
