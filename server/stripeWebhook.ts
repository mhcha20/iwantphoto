import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import { getPlanForStripePrice, getStorageAddOnForStripePrice, getStripeClient, shouldGrantSubscriptionEntitlement } from "./billing";
import { getVerifiedCreditEntitlement } from "./creditEntitlements";
import { getUserById, getUserByStripeCustomerId, grantPurchasedCredits, updateUserBillingState, updateUserStorageSubscription } from "./db";

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function firstSubscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price.id ?? null;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const value = (subscription as unknown as { current_period_end?: number }).current_period_end;
  return typeof value === "number" ? new Date(value * 1000) : null;
}

async function locateUser(subscription: Stripe.Subscription) {
  const fromMetadata = Number(subscription.metadata.iwantphoto_user_id);
  if (Number.isSafeInteger(fromMetadata) && fromMetadata > 0) {
    const user = await getUserById(fromMetadata);
    if (user) return user;
  }
  const customerId = stripeId(subscription.customer);
  return customerId ? getUserByStripeCustomerId(customerId) : undefined;
}

export async function synchronizeStripeSubscription(subscription: Stripe.Subscription) {
  const user = await locateUser(subscription);
  if (!user) {
    console.warn("[iwantphoto billing] received subscription without a matching account", subscription.id);
    return null;
  }

  const status = subscription.status;
  const candidatePlan = getPlanForStripePrice(firstSubscriptionPriceId(subscription));
  const plan = shouldGrantSubscriptionEntitlement(status) ? candidatePlan : "starter";
  return updateUserBillingState({
    userId: user.id,
    plan,
    stripeCustomerId: stripeId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: status,
    subscriptionCurrentPeriodEnd: subscriptionPeriodEnd(subscription),
  });
}

function isStorageSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata.iwantphoto_product === "storage_addon" || Boolean(getStorageAddOnForStripePrice(firstSubscriptionPriceId(subscription)));
}

export async function synchronizeStorageSubscription(subscription: Stripe.Subscription) {
  const user = await locateUser(subscription);
  if (!user) {
    console.warn("[iwantphoto billing] received storage subscription without a matching account", subscription.id);
    return null;
  }
  const addOn = getStorageAddOnForStripePrice(firstSubscriptionPriceId(subscription));
  const storageAddonGb = addOn && shouldGrantSubscriptionEntitlement(subscription.status) ? addOn.capacityGb : 0;
  return updateUserStorageSubscription({
    userId: user.id,
    storageAddonGb,
    stripeStorageSubscriptionId: subscription.id,
    storageSubscriptionStatus: subscription.status,
  });
}

async function grantOneTimeCreditPurchase(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  const stripe = getStripeClient();
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
  if (lineItems.data.length !== 1) {
    console.warn("[iwantphoto billing] received prepaid checkout with unexpected item count", session.id);
    return null;
  }
  const entitlement = getVerifiedCreditEntitlement({
    checkoutMode: session.mode,
    paymentStatus: session.payment_status,
    userIdValue: metadata.iwantphoto_user_id || session.client_reference_id,
    stripePriceId: lineItems.data[0]?.price?.id,
  });
  if (!entitlement) {
    console.warn("[iwantphoto billing] received invalid prepaid checkout", session.id);
    return null;
  }
  return grantPurchasedCredits({ userId: entitlement.userId, checkoutSessionId: session.id, credits: entitlement.pack.credits });
}

async function handleVerifiedStripeEvent(event: Stripe.Event) {
  const stripe = getStripeClient();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment") await grantOneTimeCreditPurchase(session);
      const subscriptionId = stripeId(session.subscription);
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (isStorageSubscription(subscription)) await synchronizeStorageSubscription(subscription);
        else await synchronizeStripeSubscription(subscription);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await grantOneTimeCreditPurchase(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      if (isStorageSubscription(subscription)) await synchronizeStorageSubscription(subscription);
      else await synchronizeStripeSubscription(subscription);
      break;
    }
    default:
      break;
  }
}

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    if (!ENV.stripeSecretKey || !ENV.stripeWebhookSecret) {
      res.status(503).json({ error: "Stripe webhook is not configured." });
      return;
    }
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: "Missing webhook signature." });
      return;
    }

    try {
      const event = getStripeClient().webhooks.constructEvent(req.body, signature, ENV.stripeWebhookSecret);
      await handleVerifiedStripeEvent(event);
      res.json({ received: true });
    } catch (error) {
      console.error("[iwantphoto billing] Stripe webhook rejected", error);
      res.status(400).json({ error: "Invalid webhook." });
    }
  });
}
