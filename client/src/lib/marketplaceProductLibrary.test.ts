import { describe, expect, it } from "vitest";
import { formatMarketplaceListingBullets, getSavedMarketplaceListingCopyForChannel, type SavedMarketplaceProduct } from "./marketplaceProductLibrary";

const product: SavedMarketplaceProduct = {
  id: 1,
  userId: 42,
  projectId: 7,
  sku: "BOX-BLK-01",
  productName: "透明收納盒",
  brief: {
    productName: "透明收納盒",
    summary: "透明盒身配有深色扣件。",
    confirmedFacts: ["透明盒身"],
    visualHighlights: ["深色扣件"],
    usageIdeas: ["家居收納"],
    reviewQuestions: [],
  },
  listingCopy: {
    channel: "shopee",
    title: "透明收納盒",
    bullets: ["透明盒身", "深色扣件", "可見密封蓋", "家居收納", "請確認實際套裝內容"],
    reviewNotes: [],
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("saved marketplace product helpers", () => {
  it("formats copy and restores it only for its original platform", () => {
    expect(formatMarketplaceListingBullets(product.listingCopy)).toContain("1. 透明盒身");
    expect(getSavedMarketplaceListingCopyForChannel(product, "shopee")).toEqual(product.listingCopy);
    expect(getSavedMarketplaceListingCopyForChannel(product, "amazon")).toBeNull();
  });
});
