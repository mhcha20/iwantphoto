import { describe, expect, it } from "vitest";
import { EMPTY_MARKETPLACE_PRODUCT_BRIEF } from "@shared/marketplaceProductBrief";
import { addMarketplaceDraftSnapshot, compareMarketplaceProductBriefs, createMarketplaceDraftSnapshot, formatMarketplaceDraftElapsed, getMarketplaceDraftProgress, hasMarketplaceProductBriefContent, renameMarketplaceDraftSnapshot } from "./marketplaceDraftHistory";

describe("marketplace product draft history", () => {
  const firstBrief = {
    productName: "透明收納盒",
    summary: "透明盒身配有深色扣件。",
    weight: "180 g",
    dimensions: "12 × 8 × 4 cm",
    confirmedFacts: ["透明盒身"],
    visualHighlights: ["深色扣件"],
    usageIdeas: ["家居收納"],
    reviewQuestions: ["請確認容量"],
  };

  it("keeps an immutable, bounded history of draft versions", () => {
    const snapshot = createMarketplaceDraftSnapshot(firstBrief, "ai", 1000);
    firstBrief.confirmedFacts.push("後加資料");
    expect(snapshot.brief.confirmedFacts).toEqual(["透明盒身"]);
    expect(renameMarketplaceDraftSnapshot([snapshot], snapshot.id, "黑色版本")[0]?.name).toBe("黑色版本");

    const history = Array.from({ length: 7 }, (_, index) => createMarketplaceDraftSnapshot({ ...firstBrief, productName: `草稿 ${index}` }, "ai", index));
    expect(history.reduce(addMarketplaceDraftSnapshot, [])).toHaveLength(5);
  });

  it("marks retained content and explains bounded draft progress", () => {
    expect(hasMarketplaceProductBriefContent(EMPTY_MARKETPLACE_PRODUCT_BRIEF)).toBe(false);
    expect(hasMarketplaceProductBriefContent(firstBrief)).toBe(true);
    expect(getMarketplaceDraftProgress(1_000, 1_000)).toBe(8);
    expect(getMarketplaceDraftProgress(1_000, 25_000)).toBeGreaterThan(80);
    expect(formatMarketplaceDraftElapsed(1_000, 6_000)).toContain("約餘");
  });

  it("compares editable draft changes by customer-facing field", () => {
    const differences = compareMarketplaceProductBriefs(firstBrief, {
      ...firstBrief,
      summary: "透明盒身配有黑色扣件。",
      weight: "200 g",
      usageIdeas: ["辦公室收納"],
    });
    expect(differences).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "產品描述", before: "透明盒身配有深色扣件。", after: "透明盒身配有黑色扣件。" }),
      expect.objectContaining({ label: "產品重量", before: "180 g", after: "200 g" }),
      expect.objectContaining({ label: "使用情境", before: "家居收納", after: "辦公室收納" }),
    ]));
  });
});
