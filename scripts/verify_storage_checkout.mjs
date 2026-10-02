import Stripe from "stripe";

const storagePriceId = "price_1UGgwyIrIlUINMylAcTu9fqv";

const key = process.env.IWANTPHOTO_STRIPE_SECRET_KEY;
if (!key) throw new Error("Missing IWANTPHOTO_STRIPE_SECRET_KEY");

const stripe = new Stripe(key);
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items: [{ price: storagePriceId, quantity: 1 }],
  client_reference_id: "storage-smoke-test",
  success_url: "https://iwantphoto.com/?storage_purchase=success&session_id={CHECKOUT_SESSION_ID}",
  cancel_url: "https://iwantphoto.com/#plans",
  metadata: {
    iwantphoto_user_id: "storage-smoke-test",
    iwantphoto_product: "storage_addon",
    iwantphoto_storage_addon: "archive_50",
    iwantphoto_storage_gb: "50",
    verification_only: "true",
  },
  subscription_data: {
    metadata: {
      iwantphoto_user_id: "storage-smoke-test",
      iwantphoto_product: "storage_addon",
      iwantphoto_storage_addon: "archive_50",
      iwantphoto_storage_gb: "50",
      verification_only: "true",
    },
  },
});

if (!session.url || session.mode !== "subscription") throw new Error("Storage Checkout smoke test did not return a subscription Checkout URL");
console.log(JSON.stringify({ id: session.id, mode: session.mode, status: session.status, payment_status: session.payment_status, price: storagePriceId }, null, 2));
