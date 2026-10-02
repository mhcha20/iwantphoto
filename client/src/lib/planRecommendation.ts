import type { AccountPlan } from "@shared/plans";

export const RECOMMENDED_MONTHLY_PLAN: AccountPlan = "pro";

export function isRecommendedMonthlyPlan(plan: AccountPlan) {
  return plan === RECOMMENDED_MONTHLY_PLAN;
}
