import { describe, expect, it } from "vitest";
import { getMonthlyAllowanceForStripePrice, getPlanForStripePrice, normalizeStripePlan, shouldGrantSubscriptionEntitlement } from "./billing";

describe("Stripe subscription entitlement guards", () => {
  it("never grants a paid entitlement without an active Stripe status", () => {
    expect(shouldGrantSubscriptionEntitlement("active")).toBe(true);
    expect(shouldGrantSubscriptionEntitlement("trialing")).toBe(true);
    expect(shouldGrantSubscriptionEntitlement("canceled")).toBe(false);
    expect(shouldGrantSubscriptionEntitlement(undefined)).toBe(false);
  });

  it("falls back to starter for an unrecognized Stripe price or plan", () => {
    expect(getPlanForStripePrice("unrecognized-price")).toBe("starter");
    expect(normalizeStripePlan("enterprise")).toBe("starter");
  });

  it("does not give a paid allowance to canceled or unknown prices", () => {
    expect(getMonthlyAllowanceForStripePrice("unrecognized-price", "active")).toBe(10);
    expect(getMonthlyAllowanceForStripePrice("unrecognized-price", "canceled")).toBe(10);
  });
});
