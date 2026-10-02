import { ACCOUNT_PLANS } from "./plans";

/**
 * Cost model assumptions for Iwantphoto monthly subscriptions.
 * The model is intentionally conservative: it includes GPT Image 2 medium edits,
 * a 20% retry/variance reserve, managed storage and egress, platform/support
 * allocation, and Hong Kong domestic Stripe card fees.
 */
export const PRICING_POLICY = {
  usdToHkd: 7.85,
  aiUsdPerCompletedImage: 0.06,
  aiRetryAndVarianceMultiplier: 1.2,
  storageEgressAndRequestCostHkd: 0.02,
  computeAndSupportCostHkd: 0.22,
  stripeDomesticPercentage: 0.034,
  stripeDomesticFixedHkd: 2.35,
  targetContributionMargin: 0.6,
  freePlanAllowance: 10,
} as const;

export const PLAN_PRICE_HKD = {
  starter: 0,
  pro: 510,
  business: 1770,
} as const satisfies Record<keyof typeof ACCOUNT_PLANS, number>;

export function calculateFullyLoadedImageCostHkd() {
  const aiCost = PRICING_POLICY.aiUsdPerCompletedImage
    * PRICING_POLICY.usdToHkd
    * PRICING_POLICY.aiRetryAndVarianceMultiplier;
  return aiCost + PRICING_POLICY.storageEgressAndRequestCostHkd + PRICING_POLICY.computeAndSupportCostHkd;
}

/** Rounds a proposed price upward to the next HK$10, by product policy. */
export function roundSubscriptionPriceHkd(price: number) {
  return Math.ceil(price / 10) * 10;
}
