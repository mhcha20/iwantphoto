import { describe, expect, it } from "vitest";
import { BILLING_PRICE_IDS } from "./billing";

describe("Stripe billing configuration", () => {
  it("ships with immutable live Stripe price identifiers for reviewed plans", () => {
    expect(BILLING_PRICE_IDS.pro).toMatch(/^price_/);
    expect(BILLING_PRICE_IDS.business).toMatch(/^price_/);
  });

  it("does not expose a server secret to client-side billing configuration", () => {
    expect("IWANTPHOTO_STRIPE_SECRET_KEY".startsWith("VITE_")).toBe(false);
  });
});
