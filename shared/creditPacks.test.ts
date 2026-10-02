import { describe, expect, it } from "vitest";
import { CREDIT_PACKS, getCreditPackForStripePrice, isCreditPackKey } from "./creditPacks";

describe("one-time image credit pack catalog", () => {
  it("keeps three representative Hong Kong packs in ascending order", () => {
    const packs = Object.values(CREDIT_PACKS);
    expect(packs).toHaveLength(3);
    expect(packs.map((pack) => pack.credits)).toEqual([25, 100, 250]);
    expect(packs.every((pack) => pack.coverage === "香港")).toBe(true);
  });

  it("resolves Stripe price IDs only to known packs", () => {
    expect(getCreditPackForStripePrice(CREDIT_PACKS.value_100.priceId)).toMatchObject({ key: "value_100", credits: 100 });
    expect(getCreditPackForStripePrice("price_unknown")).toBeNull();
    expect(isCreditPackKey("studio_250")).toBe(true);
    expect(isCreditPackKey("unlimited")).toBe(false);
  });
});
