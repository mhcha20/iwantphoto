import { describe, expect, it } from "vitest";
import { STORAGE_ADD_ONS, formatStorageBytes, getStorageAddOnForStripePrice, storageAllowanceBytes } from "./storagePlans";

describe("Iwantphoto storage capacity add-ons", () => {
  it("maps only published Stripe prices to an add-on capacity", () => {
    expect(getStorageAddOnForStripePrice(STORAGE_ADD_ONS.archive_200.priceId)).toMatchObject({ key: "archive_200", capacityGb: 200 });
    expect(getStorageAddOnForStripePrice("price_unknown")).toBeNull();
  });

  it("adds recurring archive capacity to the account's included storage", () => {
    expect(storageAllowanceBytes("starter", 50)).toBe(51 * 1024 * 1024 * 1024);
    expect(storageAllowanceBytes("business", 1000)).toBe(1050 * 1024 * 1024 * 1024);
  });

  it("renders practical storage figures for users", () => {
    expect(formatStorageBytes(0)).toBe("0 MB");
    expect(formatStorageBytes(50 * 1024 * 1024)).toBe("50 MB");
    expect(formatStorageBytes(1 * 1024 * 1024 * 1024)).toBe("1 GB");
  });
});
