import { ACCOUNT_PLANS, type AccountPlan } from "@shared/plans";

export type TestModeBannerCopy = {
  active: boolean;
  title: string;
  description: string;
  resetLabel: string;
  ariaLabel: string;
};

export function getTestModeBannerCopy(input: {
  role?: "admin" | "user";
  commercialPlan?: AccountPlan;
  testPlan?: AccountPlan | null;
}): TestModeBannerCopy {
  const active = input.role === "admin" && Boolean(input.testPlan);
  const testPlanName = input.testPlan ? ACCOUNT_PLANS[input.testPlan].name : "";
  const commercialPlanName = input.commercialPlan ? ACCOUNT_PLANS[input.commercialPlan].name : "";

  return {
    active,
    title: active ? `測試模式 · ${testPlanName}` : "",
    description: active
      ? `目前正以 ${testPlanName} 測試方案運作；真實商業方案為 ${commercialPlanName}。只影響你的帳戶，不會建立 Stripe 訂閱或收費。`
      : "",
    resetLabel: "回復真實方案",
    ariaLabel: active ? `測試模式已啟用，目前使用 ${testPlanName}；按此回復 ${commercialPlanName} 真實方案` : "",
  };
}
