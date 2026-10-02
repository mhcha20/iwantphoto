import { describe, expect, it } from "vitest";
import { CREDIT_PACKS } from "./creditPacks";
import { calculateFullyLoadedImageCostHkd } from "./pricingPolicy";

describe("one-time credit pack pricing", () => {
  it("retains a sustainable contribution after estimated processing and payment costs", () => {
    const unitCost = calculateFullyLoadedImageCostHkd();
    for (const pack of Object.values(CREDIT_PACKS)) {
      const stripeFee = pack.priceHkd * 0.034 + 2.35;
      const contributionMargin = (pack.priceHkd - unitCost * pack.credits - stripeFee) / pack.priceHkd;
      expect(contributionMargin).toBeGreaterThan(0.68);
    }
  });

  it("makes larger packs cheaper per credit without undercutting monthly plans", () => {
    expect(CREDIT_PACKS.flex_25.pricePerCreditHkd).toBeGreaterThan(CREDIT_PACKS.value_100.pricePerCreditHkd);
    expect(CREDIT_PACKS.value_100.pricePerCreditHkd).toBeGreaterThan(CREDIT_PACKS.studio_250.pricePerCreditHkd);
    expect(CREDIT_PACKS.studio_250.pricePerCreditHkd).toBeGreaterThan(2.5);
  });
});
