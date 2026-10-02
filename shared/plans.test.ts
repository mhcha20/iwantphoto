import { describe, expect, it } from "vitest";
import { ACCOUNT_PLANS, getEffectiveAccountPlan, getPlanAllowance, isAccountPlan } from "./plans";

describe("Iwantphoto account plans", () => {
  it("keeps published plan allowances consistent", () => {
    expect(getPlanAllowance("starter")).toBe(10);
    expect(getPlanAllowance("pro")).toBe(200);
    expect(getPlanAllowance("business")).toBe(750);
    expect(ACCOUNT_PLANS.starter.includedStorageGb).toBe(1);
    expect(ACCOUNT_PLANS.pro.includedStorageGb).toBe(10);
    expect(ACCOUNT_PLANS.business.includedStorageGb).toBe(50);
    expect(ACCOUNT_PLANS.pro.monthlyPrice).toBe(510);
    expect(ACCOUNT_PLANS.business.monthlyPrice).toBe(1770);
  });

  it("guards unknown plan values", () => {
    expect(isAccountPlan("starter")).toBe(true);
    expect(isAccountPlan("enterprise")).toBe(false);
  });

  it("uses a local test plan only for administrators", () => {
    expect(getEffectiveAccountPlan({ role: "admin", plan: "starter", adminTestPlan: "business" })).toBe("business");
    expect(getEffectiveAccountPlan({ role: "admin", plan: "pro", adminTestPlan: null })).toBe("pro");
    expect(getEffectiveAccountPlan({ role: "user", plan: "starter", adminTestPlan: "business" })).toBe("starter");
  });
});
