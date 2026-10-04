import type { AccountPlan } from "@shared/plans";

export type UsageAlert = {
  level: "none" | "notice" | "warning" | "limit";
  percentage: number;
  title: string;
  description: string;
  shouldSuggestUpgrade: boolean;
};

export function getUsageAlert(used: number, allowance: number, plan: AccountPlan, creditBalance = 0): UsageAlert {
  const safeAllowance = Math.max(1, allowance);
  const percentage = Math.min(100, Math.max(0, Math.round((Math.max(0, used) / safeAllowance) * 100)));
  const remaining = Math.max(0, safeAllowance - Math.max(0, used));
  const planName = plan === "starter" ? "Starter" : plan === "pro" ? "Pro" : "Business";

  const credits = Math.max(0, Math.floor(creditBalance));
  if (credits > 0) {
    // One-time credits are used automatically once the monthly allowance runs out.
    if (percentage >= 100) return { level: "notice", percentage, title: "本月月費額度已用完", description: `正在使用一次性加購額度，尚餘 ${credits} 張。`, shouldSuggestUpgrade: false };
    return { level: "none", percentage, title: "", description: "", shouldSuggestUpgrade: false };
  }
  if (percentage >= 100) {
    return { level: "limit", percentage, title: "本月額度已用完", description: `${planName} 方案本月 ${safeAllowance} 張處理額度已用完；升級後即可繼續處理。`, shouldSuggestUpgrade: plan !== "business" };
  }
  if (percentage >= 90) {
    return { level: "warning", percentage, title: "額度即將用完", description: `本月尚餘 ${remaining} 張；請預留額度給重要交付，或現在升級方案。`, shouldSuggestUpgrade: plan !== "business" };
  }
  if (percentage >= 80) {
    return { level: "notice", percentage, title: "已使用超過八成額度", description: `本月尚餘 ${remaining} 張，建議安排下一輪交付或查看更高額度方案。`, shouldSuggestUpgrade: plan !== "business" };
  }
  return { level: "none", percentage, title: "", description: "", shouldSuggestUpgrade: false };
}
