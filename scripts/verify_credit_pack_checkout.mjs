import Stripe from "stripe";

const key = process.env.IWANTPHOTO_STRIPE_SECRET_KEY;
if (!key) throw new Error("Missing IWANTPHOTO_STRIPE_SECRET_KEY");

const stripe = new Stripe(key);
const pack = {
  key: "flex_25",
  credits: 25,
  priceId: "price_1UGgTgIrIlUINMylqdFNLMK6",
};
const baseUrl = process.env.APP_BASE_URL || "https://iwantphoto.com";
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  client_reference_id: "iwantphoto-credit-checkout-smoke-test",
  line_items: [{ price: pack.priceId, quantity: 1 }],
  success_url: `${baseUrl}/?credit_purchase=verification-success&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${baseUrl}/#plans`,
  metadata: {
    iwantphoto_purchase_type: "one_time_credit",
    iwantphoto_user_id: "999999",
    iwantphoto_credit_pack: pack.key,
    iwantphoto_credits: String(pack.credits),
    iwantphoto_verification: "credit_checkout_smoke_test",
  },
});
if (!session.url) throw new Error("Stripe did not return a hosted one-time checkout URL");
await stripe.checkout.sessions.expire(session.id);
console.log(JSON.stringify({ created: true, expired: true, mode: session.mode, sessionId: session.id, priceId: pack.priceId }));
