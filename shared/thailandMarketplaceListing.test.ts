import { describe, expect, it } from "vitest";
import { getThailandMarketplaceListingCharacterStatus, getThailandMarketplaceListingRequirements, normaliseThailandMarketplaceListingFields } from "./thailandMarketplaceListing";

describe("Thailand marketplace listing requirements", () => {
  it("provides separate Lazada and Shopee Thailand targets and fields", () => {
    const lazada = getThailandMarketplaceListingRequirements("lazada_th");
    const shopee = getThailandMarketplaceListingRequirements("shopee_th");

    expect(lazada).toMatchObject({ titleLimit: 255, descriptionLimit: 3000 });
    expect(lazada?.fields.map((field) => field.key)).toContain("whatsInTheBox");
    expect(shopee).toMatchObject({ titleLimit: 120, descriptionLimit: 3000 });
    expect(shopee?.fields.map((field) => field.key)).not.toContain("whatsInTheBox");
  });

  it("counts Thai listing text and bounds stored platform values", () => {
    expect(getThailandMarketplaceListingCharacterStatus("shopee_th", "title", "สินค้าไทย")).toMatchObject({ length: 9, limit: 120, overLimit: false });
    expect(normaliseThailandMarketplaceListingFields({ description: "x".repeat(3100), brand: "  No Brand  " }, "lazada_th")).toMatchObject({ description: "x".repeat(3000), brand: "No Brand" });
  });
});
