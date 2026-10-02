import { describe, expect, it } from "vitest";
import { formatMarketplaceDetailSpecificationOverlay, formatMarketplaceProductBriefForPrompt, getMarketplaceDetailSpecificationLines, isMarketplaceDetailSpecificationLayout, isMarketplaceProductBriefReady, MARKETPLACE_DETAIL_SPECIFICATION_LAYOUTS } from "./marketplaceProductBrief";

describe("marketplace product briefs", () => {
  const brief = {
    productName: "玻璃食物盒套裝",
    summary: "透明玻璃食物盒及黑色扣件的套裝。",
    weight: "680 g",
    dimensions: "18 × 13 × 7 cm",
    confirmedFacts: ["透明盒身", "黑色扣件"],
    visualHighlights: ["兩個已核實容量：370 ml、660 ml"],
    usageIdeas: ["家居食物收納"],
  };

  it("requires a reviewed name and description before suite generation", () => {
    expect(isMarketplaceProductBriefReady(brief)).toBe(true);
    expect(isMarketplaceProductBriefReady({ ...brief, summary: " " })).toBe(false);
  });

  it("limits supplementary callouts to facts the merchant confirmed", () => {
    const prompt = formatMarketplaceProductBriefForPrompt(brief);

    expect(prompt).toContain("玻璃食物盒套裝");
    expect(prompt).toContain("370 ml、660 ml");
    expect(prompt).toContain("Merchant-confirmed product weight: 680 g");
    expect(prompt).toContain("Merchant-confirmed product dimensions: 18 × 13 × 7 cm");
    expect(prompt).toContain("Never place text");
    expect(prompt).toContain("If any approved wording cannot be rendered accurately, omit it");
  });

  it("allows exact confirmed specifications only in the verified-detail overlay", () => {
    const overlay = formatMarketplaceDetailSpecificationOverlay(brief);

    expect(overlay).toContain("VERIFIED SPECIFICATION OVERLAY");
    expect(overlay).toContain("重量：680 g");
    expect(overlay).toContain("尺寸：18 × 13 × 7 cm");
    expect(overlay).toContain("without translation");
    expect(formatMarketplaceDetailSpecificationOverlay({ ...brief, weight: "", dimensions: "" })).toContain("Do not render any weight");
  });

  it("uses an explicit merchant-selected layout without changing the proofread text", () => {
    const overlay = formatMarketplaceDetailSpecificationOverlay(brief, "dimension_guide");

    expect(overlay).toContain("Merchant-selected layout: 尺寸導引");
    expect(overlay).toContain("Do not infer an arrow value");
    expect(getMarketplaceDetailSpecificationLines(brief)).toEqual(["重量：680 g", "尺寸：18 × 13 × 7 cm"]);
    expect(isMarketplaceDetailSpecificationLayout("bottom_strip")).toBe(true);
    expect(isMarketplaceDetailSpecificationLayout("floating-price-tag")).toBe(false);
    expect(MARKETPLACE_DETAIL_SPECIFICATION_LAYOUTS.side_card.label).toBe("側邊資訊卡");
  });
});
