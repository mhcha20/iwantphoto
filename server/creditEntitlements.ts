import { getCreditPackForStripePrice } from "@shared/creditPacks";

export function getVerifiedCreditEntitlement(input: {
  checkoutMode: string | null;
  paymentStatus: string | null;
  userIdValue: string | null | undefined;
  stripePriceId: string | null | undefined;
}) {
  if (input.checkoutMode !== "payment" || input.paymentStatus !== "paid") return null;
  const userId = Number(input.userIdValue);
  if (!Number.isSafeInteger(userId) || userId < 1) return null;
  const pack = getCreditPackForStripePrice(input.stripePriceId);
  if (!pack) return null;
  return { userId, pack };
}
