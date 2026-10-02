import Stripe from "stripe";

const stripe = new Stripe(process.env.IWANTPHOTO_STRIPE_SECRET_KEY);
const productMetadata = { application: "iwantphoto", purpose: "subscription-management" };
const settings = {
  metadata: productMetadata,
  features: {
    customer_update: { enabled: true, allowed_updates: ["email", "address", "phone"] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      cancellation_reason: {
        enabled: true,
        options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
      },
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "create_prorations",
      products: [
        { product: "prod_VHE8w8EyMbDeuP", prices: ["price_1UGffkIrIlUINMyl5nDxSnjh"] },
        { product: "prod_VHE8CE6l1B5t9R", prices: ["price_1UGffmIrIlUINMylflXVCT9i"] },
      ],
    },
  },
};

const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
const current = existing.data.find((configuration) => configuration.metadata.application === "iwantphoto");
const configuration = current
  ? await stripe.billingPortal.configurations.update(current.id, settings)
  : await stripe.billingPortal.configurations.create(settings);

console.log(JSON.stringify({ id: configuration.id, active: configuration.active, isDefault: configuration.is_default }, null, 2));
