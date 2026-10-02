import { ACCOUNT_PLANS, type AccountPlan } from "@shared/plans";

export type PlanComparisonRowKey = "monthlyPrice" | "allowance" | "storage" | "workflow" | "bestFor";

export type PlanComparisonRow = {
  key: PlanComparisonRowKey;
  label: string;
  icon: "credit" | "sparkles" | "storage" | "workflow" | "audience";
  getValue: (plan: AccountPlan) => string;
};

export const PLAN_COMPARISON_ROWS: PlanComparisonRow[] = [
  {
    key: "monthlyPrice",
    label: "月費",
    icon: "credit",
    getValue: (plan) => (ACCOUNT_PLANS[plan].monthlyPrice === 0 ? "免費" : `HK$${ACCOUNT_PLANS[plan].monthlyPrice.toLocaleString()}／月`),
  },
  {
    key: "allowance",
    label: "每月處理額度",
    icon: "sparkles",
    getValue: (plan) => `${ACCOUNT_PLANS[plan].allowance.toLocaleString()} 張`,
  },
  {
    key: "storage",
    label: "已包括相片庫",
    icon: "storage",
    getValue: (plan) => `${ACCOUNT_PLANS[plan].includedStorageGb} GB`,
  },
  {
    key: "workflow",
    label: "工作流程",
    icon: "workflow",
    getValue: (plan) => ACCOUNT_PLANS[plan].features[2],
  },
  {
    key: "bestFor",
    label: "適合工作量",
    icon: "audience",
    getValue: (plan) => ACCOUNT_PLANS[plan].tagline,
  },
];

export function getPlanComparisonValue(row: PlanComparisonRow, plan: AccountPlan) {
  return row.getValue(plan);
}
