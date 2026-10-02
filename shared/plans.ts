export const ACCOUNT_PLANS = {
  starter: {
    key: "starter",
    name: "Starter",
    monthlyPrice: 0,
    allowance: 10,
    includedStorageGb: 1,
    tagline: "適合先建立日常圖片處理流程的個人與小店。",
    features: ["每月 10 張已完成處理", "1 GB 安全相片庫", "透明底、白底及精確清除"],
  },
  pro: {
    key: "pro",
    name: "Pro",
    monthlyPrice: 510,
    allowance: 200,
    includedStorageGb: 10,
    tagline: "適合需要每週交付產品、門市或社交素材的團隊。",
    features: ["每月 200 張已完成處理", "10 GB 安全相片庫", "批量處理與批量交付"],
  },
  business: {
    key: "business",
    name: "Business",
    monthlyPrice: 1770,
    allowance: 750,
    includedStorageGb: 50,
    tagline: "適合多店舖、多專案或高頻圖片交付工作。",
    features: ["每月 750 張已完成處理", "50 GB 安全相片庫", "大量素材工作流程"],
  },
} as const;

export type AccountPlan = keyof typeof ACCOUNT_PLANS;

export function getPlanAllowance(plan: AccountPlan) {
  return ACCOUNT_PLANS[plan].allowance;
}

export function isAccountPlan(value: string): value is AccountPlan {
  return value in ACCOUNT_PLANS;
}

export type PlanEntitlementAccount = {
  plan: AccountPlan;
  role: "user" | "admin";
  adminTestPlan?: AccountPlan | null;
};

/**
 * Uses a local entitlement override only for the administrator who enabled it.
 * The database `plan` remains the Stripe/webhook-owned commercial subscription.
 */
export function getEffectiveAccountPlan(account: PlanEntitlementAccount): AccountPlan {
  return account.role === "admin" && account.adminTestPlan ? account.adminTestPlan : account.plan;
}
