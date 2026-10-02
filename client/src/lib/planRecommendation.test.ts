import { describe, expect, it } from "vitest";
import { RECOMMENDED_MONTHLY_PLAN, isRecommendedMonthlyPlan } from "./planRecommendation";

describe("recommended monthly plan", () => {
  it("designates Pro as the single recommended plan", () => {
    expect(RECOMMENDED_MONTHLY_PLAN).toBe("pro");
    expect(isRecommendedMonthlyPlan("pro")).toBe(true);
    expect(isRecommendedMonthlyPlan("starter")).toBe(false);
    expect(isRecommendedMonthlyPlan("business")).toBe(false);
  });
});
