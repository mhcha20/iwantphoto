import Stripe from "stripe";
import { ENV } from "./_core/env";
import { getPlanAllowance, isAccountPlan, type AccountPlan } from "@shared/plans";
import { CREDIT_PACKS, type CreditPackKey } from "@shared/creditPacks";
import { STORAGE_ADD_ONS, type StorageAddOnKey } from "@shared/storagePlans";

export const BILLING_PRICE_IDS = {
  pro: ENV.stripeProPriceId,
  business: ENV.stripeBusinessPriceId,
} as const;

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export function getStripeClient() {
  if (!ENV.stripeSecretKey) throw new Error("Stripe billing is not configured.");
  return new Stripe(ENV.stripeSecretKey);
}

export function getStripePriceId(plan: Exclude<AccountPlan, "starter">) {
  const priceId = BILLING_PRICE_IDS[plan];
  if (!priceId) throw new Error(`Stripe price for ${plan} is not configured.`);
  return priceId;
}

export function getPlanForStripePrice(priceId: string | null | undefined): AccountPlan {
  if (priceId && priceId === BILLING_PRICE_IDS.pro) return "pro";
  if (priceId && priceId === BILLING_PRICE_IDS.business) return "business";
  return "starter";
}

export function shouldGrantSubscriptionEntitlement(status: string | null | undefined) {
  return Boolean(status && ACTIVE_SUBSCRIPTION_STATUSES.has(status));
}

export function getStorageAddOnForStripePrice(priceId: string | null | undefined) {
  return Object.values(STORAGE_ADD_ONS).find((addOn) => addOn.priceId === priceId) ?? null;
}

export function normalizeStripePlan(value: string | null | undefined): AccountPlan {
  return value && isAccountPlan(value) ? value : "starter";
}

export function getMonthlyAllowanceForStripePrice(priceId: string | null | undefined, status: string | null | undefined) {
  const plan = getPlanForStripePrice(priceId);
  return shouldGrantSubscriptionEntitlement(status) ? getPlanAllowance(plan) : getPlanAllowance("starter");
}

export async function createSubscriptionCheckout(input: {
  userId: number;
  email?: string | null;
  stripeCustomerId?: string | null;
  plan: Exclude<AccountPlan, "starter">;
  origin: string;
}) {
  const stripe = getStripeClient();
  const price = getStripePriceId(input.plan);
  const userId = String(input.userId);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...(input.stripeCustomerId ? { customer: input.stripeCustomerId } : input.email ? { customer_email: input.email } : {}),
    client_reference_id: userId,
    line_items: [{ price, quantity: 1 }],
    billing_address_collection: "auto",
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true,
    success_url: `${input.origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/#plans`,
    metadata: { iwantphoto_user_id: userId, iwantphoto_plan: input.plan },
    subscription_data: { metadata: { iwantphoto_user_id: userId, iwantphoto_plan: input.plan } },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

export async function createCustomerPortal(input: { stripeCustomerId: string; origin: string }) {
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: input.stripeCustomerId,
    return_url: `${input.origin}/#plans`,
  });
  return session.url;
}

export async function createCreditPackCheckout(input: {
  userId: number;
  email?: string | null;
  stripeCustomerId?: string | null;
  pack: CreditPackKey;
  origin: string;
}) {
  const stripe = getStripeClient();
  const creditPack = CREDIT_PACKS[input.pack];
  const userId = String(input.userId);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(input.stripeCustomerId ? { customer: input.stripeCustomerId } : input.email ? { customer_email: input.email } : {}),
    client_reference_id: userId,
    line_items: [{ price: creditPack.priceId, quantity: 1 }],
    billing_address_collection: "auto",
    phone_number_collection: { enabled: true },
    success_url: `${input.origin}/?credit_purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/#plans`,
    metadata: {
      iwantphoto_purchase_type: "one_time_credit",
      iwantphoto_user_id: userId,
      iwantphoto_credit_pack: input.pack,
      iwantphoto_credits: String(creditPack.credits),
    },
    payment_intent_data: {
      metadata: {
        iwantphoto_purchase_type: "one_time_credit",
        iwantphoto_user_id: userId,
        iwantphoto_credit_pack: input.pack,
        iwantphoto_credits: String(creditPack.credits),
      },
    },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

export async function createStorageAddOnCheckout(input: {
  userId: number;
  email?: string | null;
  stripeCustomerId?: string | null;
  addOn: StorageAddOnKey;
  origin: string;
}) {
  const stripe = getStripeClient();
  const storageAddOn = STORAGE_ADD_ONS[input.addOn];
  const userId = String(input.userId);
  const metadata = {
    iwantphoto_user_id: userId,
    iwantphoto_product: "storage_addon",
    iwantphoto_storage_addon: input.addOn,
    iwantphoto_storage_gb: String(storageAddOn.capacityGb),
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...(input.stripeCustomerId ? { customer: input.stripeCustomerId } : input.email ? { customer_email: input.email } : {}),
    client_reference_id: userId,
    line_items: [{ price: storageAddOn.priceId, quantity: 1 }],
    billing_address_collection: "auto",
    phone_number_collection: { enabled: true },
    success_url: `${input.origin}/?storage_purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/#plans`,
    metadata,
    subscription_data: { metadata },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}
