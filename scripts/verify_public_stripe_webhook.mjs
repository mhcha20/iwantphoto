import Stripe from "stripe";

const secret = process.env.IWANTPHOTO_STRIPE_WEBHOOK_SECRET;
const baseUrl = process.env.APP_BASE_URL || "https://iwantphoto.com";
if (!secret) throw new Error("Missing IWANTPHOTO_STRIPE_WEBHOOK_SECRET");

const payload = JSON.stringify({
  id: "evt_iwantphoto_public_signature_check",
  object: "event",
  api_version: "2026-08-26.dahlia",
  created: Math.floor(Date.now() / 1000),
  data: { object: { id: "obj_iwantphoto_public_signature_check", object: "unknown" } },
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
  type: "iwantphoto.signature_check",
});
const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
const accepted = await fetch(`${baseUrl}/api/stripe/webhook`, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": signature },
  body: payload,
});
if (accepted.status !== 200) throw new Error(`Expected signed webhook to succeed; received ${accepted.status}`);
const rejected = await fetch(`${baseUrl}/api/stripe/webhook`, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=invalid" },
  body: payload,
});
if (rejected.status !== 400) throw new Error(`Expected forged webhook to be rejected; received ${rejected.status}`);
console.log(JSON.stringify({ publicSignedWebhookAccepted: true, forgedWebhookRejected: true }));
