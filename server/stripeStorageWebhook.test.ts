import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_ADD_ONS } from "@shared/storagePlans";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getUserByStripeCustomerId: vi.fn(),
  updateUserStorageSubscription: vi.fn(),
}));

vi.mock("./db", () => ({
  getUserById: mocks.getUserById,
  getUserByStripeCustomerId: mocks.getUserByStripeCustomerId,
  updateUserStorageSubscription: mocks.updateUserStorageSubscription,
  grantPurchasedCredits: vi.fn(),
  updateUserBillingState: vi.fn(),
}));

import { synchronizeStorageSubscription } from "./stripeWebhook";

describe("Stripe storage subscription synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserById.mockResolvedValue({ id: 42 });
    mocks.updateUserStorageSubscription.mockResolvedValue({ id: 42, storageAddonGb: 200 });
  });

  it("grants capacity only for an active recognized storage subscription", async () => {
    await synchronizeStorageSubscription({
      id: "sub_storage_200",
      customer: "cus_123",
      status: "active",
      metadata: { iwantphoto_user_id: "42", iwantphoto_product: "storage_addon" },
      items: { data: [{ price: { id: STORAGE_ADD_ONS.archive_200.priceId } }] },
    } as never);

    expect(mocks.updateUserStorageSubscription).toHaveBeenCalledWith({
      userId: 42,
      storageAddonGb: 200,
      stripeStorageSubscriptionId: "sub_storage_200",
      storageSubscriptionStatus: "active",
    });
  });

  it("removes add-on capacity for a cancelled storage subscription", async () => {
    await synchronizeStorageSubscription({
      id: "sub_storage_50",
      customer: "cus_123",
      status: "canceled",
      metadata: { iwantphoto_user_id: "42", iwantphoto_product: "storage_addon" },
      items: { data: [{ price: { id: STORAGE_ADD_ONS.archive_50.priceId } }] },
    } as never);

    expect(mocks.updateUserStorageSubscription).toHaveBeenCalledWith(expect.objectContaining({ storageAddonGb: 0, storageSubscriptionStatus: "canceled" }));
  });
});
