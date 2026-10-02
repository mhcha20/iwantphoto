import Stripe from "stripe";

const key = process.env.IWANTPHOTO_STRIPE_SECRET_KEY;
if (!key) throw new Error("Missing IWANTPHOTO_STRIPE_SECRET_KEY");
const stripe = new Stripe(key);
const baseUrl = process.env.APP_BASE_URL || "https://iwantphoto.com";
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  client_reference_id: "iwantphoto-checkout-smoke-test",
  line_items: [{ price: "price_1UGffkIrIlUINMyl5nDxSnjh", quantity: 1 }],
  success_url: `${baseUrl}/?checkout=verification-success&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${baseUrl}/#plans`,
  metadata: { iwantphoto_verification: "checkout_smoke_test" },
  subscription_data: { metadata: { iwantphoto_verification: "checkout_smoke_test" } },
});
if (!session.url) throw new Error("Stripe did not return a hosted checkout URL");
await stripe.checkout.sessions.expire(session.id);
console.log(JSON.stringify({ created: true, expired: true, sessionId: session.id, paymentStatus: session.payment_status }));
