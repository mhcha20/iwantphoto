import { describe, expect, it } from "vitest";
import { calculateFullyLoadedImageCostHkd, PLAN_PRICE_HKD, roundSubscriptionPriceHkd } from "./pricingPolicy";

describe("Iwantphoto cost-based pricing policy", () => {
  it("keeps the fully loaded per-image cost below one Hong Kong dollar", () => {
    expect(calculateFullyLoadedImageCostHkd()).toBeCloseTo(0.8052, 4);
  });

  it("uses the reviewed price points for paid plans", () => {
    expect(PLAN_PRICE_HKD).toMatchObject({ starter: 0, pro: 510, business: 1770 });
  });

  it("always rounds subscription prices upward to a ten-dollar amount", () => {
    expect(roundSubscriptionPriceHkd(501.07)).toBe(510);
    expect(roundSubscriptionPriceHkd(1765.71)).toBe(1770);
  });
});
