import { describe, expect, it, vi } from "vitest";
import { CREDIT_PACKS } from "@shared/creditPacks";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = { sessions: { create: mocks.createSession } };
  },
}));

import { createCreditPackCheckout } from "./billing";

describe("one-time credit pack Checkout", () => {
  it("creates a one-time, account-bound Checkout session for the selected pack", async () => {
    mocks.createSession.mockResolvedValue({ url: "https://checkout.stripe.test/cs_credit" });

    await expect(createCreditPackCheckout({
      userId: 42,
      email: "owner@example.com",
      stripeCustomerId: null,
      pack: "value_100",
      origin: "https://iwantphoto.com",
    })).resolves.toBe("https://checkout.stripe.test/cs_credit");

    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      client_reference_id: "42",
      line_items: [{ price: CREDIT_PACKS.value_100.priceId, quantity: 1 }],
      metadata: expect.objectContaining({
        iwantphoto_purchase_type: "one_time_credit",
        iwantphoto_credit_pack: "value_100",
        iwantphoto_credits: "100",
      }),
      success_url: "https://iwantphoto.com/?credit_purchase=success&session_id={CHECKOUT_SESSION_ID}",
    }));
  });
});
