import { describe, expect, it } from "vitest";
import { getTestModeBannerCopy } from "./testModeBanner";

describe("test mode banner", () => {
  it("shows a precise no-charge reminder only for an administrator test plan", () => {
    expect(getTestModeBannerCopy({ role: "admin", commercialPlan: "starter", testPlan: "pro" })).toMatchObject({
      active: true,
      title: "測試模式 · Pro",
      resetLabel: "回復真實方案",
    });
    expect(getTestModeBannerCopy({ role: "admin", commercialPlan: "starter", testPlan: "pro" }).description).toContain("真實商業方案為 Starter");
    expect(getTestModeBannerCopy({ role: "admin", commercialPlan: "starter", testPlan: "pro" }).description).toContain("不會建立 Stripe 訂閱或收費");
  });

  it("hides when no test override is active or the user is not an administrator", () => {
    expect(getTestModeBannerCopy({ role: "admin", commercialPlan: "starter", testPlan: null }).active).toBe(false);
    expect(getTestModeBannerCopy({ role: "user", commercialPlan: "starter", testPlan: "business" }).active).toBe(false);
  });
});
