import Stripe from "stripe";
import { describe, expect, it } from "vitest";

describe("Iwantphoto signed Stripe webhook endpoint", () => {
  it("accepts a payload only when signed with the configured webhook secret", async () => {
    const secret = process.env.IWANTPHOTO_STRIPE_WEBHOOK_SECRET;
    expect(secret).toMatch(/^whsec_/);

    const payload = JSON.stringify({
      id: "evt_iwantphoto_signature_check",
      object: "event",
      api_version: "2026-08-26.dahlia",
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: "obj_iwantphoto_signature_check", object: "unknown" } },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "iwantphoto.signature_check",
    });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: secret! });
    const response = await fetch("http://127.0.0.1:3000/api/stripe/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: payload,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
  }, 20_000);
});
