import { describe, expect, it } from "vitest";
import { CREDIT_PACKS } from "@shared/creditPacks";
import { getVerifiedCreditEntitlement } from "./creditEntitlements";

describe("verified prepaid credit entitlements", () => {
  it("grants only a paid one-time Checkout with a known pack and valid account", () => {
    expect(getVerifiedCreditEntitlement({
      checkoutMode: "payment",
      paymentStatus: "paid",
      userIdValue: "42",
      stripePriceId: CREDIT_PACKS.value_100.priceId,
    })).toMatchObject({ userId: 42, pack: { key: "value_100", credits: 100 } });
  });

  it("rejects unpaid, subscription, unknown-price and unassigned checkouts", () => {
    const valid = { checkoutMode: "payment", paymentStatus: "paid", userIdValue: "42", stripePriceId: CREDIT_PACKS.flex_25.priceId };
    expect(getVerifiedCreditEntitlement({ ...valid, paymentStatus: "unpaid" })).toBeNull();
    expect(getVerifiedCreditEntitlement({ ...valid, checkoutMode: "subscription" })).toBeNull();
    expect(getVerifiedCreditEntitlement({ ...valid, stripePriceId: "price_unknown" })).toBeNull();
    expect(getVerifiedCreditEntitlement({ ...valid, userIdValue: "not-a-user" })).toBeNull();
  });
});
