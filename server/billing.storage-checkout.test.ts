import { describe, expect, it, vi } from "vitest";
import { STORAGE_ADD_ONS } from "@shared/storagePlans";

const mocks = vi.hoisted(() => ({ createSession: vi.fn() }));
vi.mock("stripe", () => ({
  default: class StripeMock { checkout = { sessions: { create: mocks.createSession } }; },
}));

import { createStorageAddOnCheckout } from "./billing";

describe("recurring storage Checkout", () => {
  it("creates an account-bound monthly archive Checkout session", async () => {
    mocks.createSession.mockResolvedValue({ url: "https://checkout.stripe.test/cs_storage" });
    await expect(createStorageAddOnCheckout({
      userId: 42,
      email: "owner@example.com",
      stripeCustomerId: null,
      addOn: "archive_200",
      origin: "https://iwantphoto.com",
    })).resolves.toBe("https://checkout.stripe.test/cs_storage");

    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      client_reference_id: "42",
      line_items: [{ price: STORAGE_ADD_ONS.archive_200.priceId, quantity: 1 }],
      metadata: expect.objectContaining({
        iwantphoto_product: "storage_addon",
        iwantphoto_storage_addon: "archive_200",
        iwantphoto_storage_gb: "200",
      }),
      success_url: "https://iwantphoto.com/?storage_purchase=success&session_id={CHECKOUT_SESSION_ID}",
    }));
  });
});
