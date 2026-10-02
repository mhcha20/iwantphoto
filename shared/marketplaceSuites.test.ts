import { describe, expect, it } from "vitest";
import { MARKETPLACE_CHANNELS, MARKETPLACE_LIFESTYLE_STYLES, MARKETPLACE_SUITE_CREDIT_COST, buildMarketplaceImagePrompt, getMarketplaceLifestyleSceneCorrection, getMarketplaceSuite, getMarketplaceSuiteCreditCost, getMarketplaceSuiteSelection, isMarketplaceChannel, isMarketplaceLifestyleStyle, normaliseMarketplaceBrandStyle } from "./marketplaceSuites";

describe("marketplace image suite presets", () => {
  it("creates a four-image suite for every supported sales channel", () => {
    for (const channel of ["amazon", "instagram", "shopee", "lazada_th", "shopee_th", "facebook", "google"] as const) {
      const suite = getMarketplaceSuite(channel);
      expect(suite).toHaveLength(MARKETPLACE_SUITE_CREDIT_COST);
      expect(suite.map((item) => item.role)).toEqual(["main", "studio", "detail", "lifestyle"]);
    }
  });

  it("keeps product truth and no-overlay restrictions in generated prompts", () => {
    const item = getMarketplaceSuite("amazon")[0]!;
    const prompt = buildMarketplaceImagePrompt({ channel: "amazon", item, productNote: "Black cotton tote; one bag only" });
    expect(prompt).toContain("sole visual source of truth");
    expect(prompt).toContain("Do not substitute");
    expect(prompt).toContain("pure white RGB 255/255/255");
    expect(prompt).toContain("Black cotton tote");
  });

  it("requires genuinely different composition treatments for supporting, detail and lifestyle roles", () => {
    const [main, studio, detail, lifestyle] = getMarketplaceSuite("amazon");
    const brief = {
      productName: "維生素 D3 補充劑",
      summary: "深棕色瓶身配有綠色瓶蓋。",
      confirmedFacts: ["180 粒裝"],
      visualHighlights: ["綠色瓶蓋"],
      usageIdeas: ["家居收納櫃"],
    };

    const mainPrompt = buildMarketplaceImagePrompt({ channel: "amazon", item: main!, productBrief: brief });
    const studioPrompt = buildMarketplaceImagePrompt({ channel: "amazon", item: studio!, productBrief: brief });
    const detailPrompt = buildMarketplaceImagePrompt({ channel: "amazon", item: detail!, productBrief: brief });
    const lifestylePrompt = buildMarketplaceImagePrompt({ channel: "amazon", item: lifestyle!, productBrief: brief });

    expect(mainPrompt).toContain("ROLE: CATALOG MAIN");
    expect(mainPrompt).toContain("pure white RGB 255/255/255");
    expect(studioPrompt).toContain("ROLE: STUDIO SUPPORTING IMAGE");
    expect(studioPrompt).toContain("three-quarter or side-facing camera angle");
    expect(studioPrompt).toContain("visibly different from the pure-white catalog main image");
    expect(detailPrompt).toContain("ROLE: VERIFIED DETAIL");
    expect(detailPrompt).toContain("tight editorial close-up");
    expect(detailPrompt).toContain("visibly closer than a full-product catalog view");
    expect(lifestylePrompt).toContain("ROLE: LIFESTYLE SCENE");
    expect(lifestylePrompt).toContain("not a white-background product shot");
    expect(lifestylePrompt).toContain("家居收納櫃");
    expect(lifestylePrompt).toContain("commercial product-photography rendition");
  });

  it("renders confirmed weight and dimensions only on the third verified-detail image", () => {
    const [main, , detail, lifestyle] = getMarketplaceSuite("shopee");
    const brief = {
      productName: "收納盒",
      summary: "透明收納盒。",
      weight: "180 g",
      dimensions: "12 × 8 × 4 cm",
      confirmedFacts: [],
      visualHighlights: [],
      usageIdeas: [],
    };

    const mainPrompt = buildMarketplaceImagePrompt({ channel: "shopee", item: main!, productBrief: brief });
    const detailPrompt = buildMarketplaceImagePrompt({ channel: "shopee", item: detail!, productBrief: brief, detailSpecificationLayout: "side_card" });
    const lifestylePrompt = buildMarketplaceImagePrompt({ channel: "shopee", item: lifestyle!, productBrief: brief });

    expect(detailPrompt).toContain("VERIFIED SPECIFICATION OVERLAY");
    expect(detailPrompt).toContain("重量：180 g");
    expect(detailPrompt).toContain("尺寸：12 × 8 × 4 cm");
    expect(detailPrompt).toContain("without translation");
    expect(detailPrompt).toContain("Merchant-selected layout: 側邊資訊卡");
    expect(detailPrompt).toContain("information card beside the product");
    expect(mainPrompt).toContain("No specification overlay is permitted for this role.");
    expect(lifestylePrompt).toContain("No specification overlay is permitted for this role.");
    expect(mainPrompt).not.toContain("VERIFIED SPECIFICATION OVERLAY");
    expect(lifestylePrompt).not.toContain("VERIFIED SPECIFICATION OVERLAY");
  });

  it("adds a targeted composition correction only for a failed role regeneration", () => {
    const prompt = buildMarketplaceImagePrompt({
      channel: "shopee",
      item: getMarketplaceSuite("shopee")[3]!,
      compositionCorrection: "Do not return an isolated white-background product shot; produce the requested environmental lifestyle scene.",
    });

    expect(prompt).toContain("first attempt was rejected");
    expect(prompt).toContain("environmental lifestyle scene");
  });

  it("treats a per-image redesign request as art direction rather than product truth", () => {
    const prompt = buildMarketplaceImagePrompt({
      channel: "amazon",
      item: getMarketplaceSuite("amazon")[3]!,
      redesignInstruction: "Move it beside a sunny window and state it is clinically proven.",
    });

    expect(prompt).toContain("merchant asks to redesign this one image");
    expect(prompt).toContain("sunny window");
    expect(prompt).toContain("Never treat it as proof of a product specification");
    expect(prompt).toContain("claim, certification");
  });

  it("adds the selected safe lifestyle setting only to the lifestyle output", () => {
    expect(Object.keys(MARKETPLACE_LIFESTYLE_STYLES)).toEqual(["auto", "home", "office", "outdoor"]);
    expect(isMarketplaceLifestyleStyle("home")).toBe(true);
    expect(isMarketplaceLifestyleStyle("beach-party")).toBe(false);

    const lifestylePrompt = buildMarketplaceImagePrompt({
      channel: "instagram",
      item: getMarketplaceSuite("instagram")[3]!,
      lifestyleStyle: "office",
      productBrief: {
        productName: "桌上收納盒",
        summary: "透明盒身配有黑色扣件。",
        confirmedFacts: [],
        visualHighlights: [],
        usageIdeas: ["文件與桌面收納"],
      },
    });
    const mainPrompt = buildMarketplaceImagePrompt({
      channel: "instagram",
      item: getMarketplaceSuite("instagram")[0]!,
      lifestyleStyle: "outdoor",
    });
    const outdoorPrompt = buildMarketplaceImagePrompt({
      channel: "instagram",
      item: getMarketplaceSuite("instagram")[3]!,
      lifestyleStyle: "outdoor",
    });

    expect(lifestylePrompt).toContain("The merchant selected this lifestyle style: 辦公室");
    expect(lifestylePrompt).toContain("professional office or workspace setting");
    expect(lifestylePrompt).toContain("文件與桌面收納");
    expect(outdoorPrompt).toContain("unmistakably outdoor, natural-daylight setting");
    expect(outdoorPrompt).toContain("never substitute a near-window or indoor scene");
    expect(outdoorPrompt).toContain("at least two secondary outdoor cues");
    expect(mainPrompt).not.toContain("The merchant selected this lifestyle style");
  });

  it("carries a merchant-selected scene subtype and unsuitable-scene exclusions only into lifestyle generation", () => {
    const lifestylePrompt = buildMarketplaceImagePrompt({
      channel: "shopee",
      item: getMarketplaceSuite("shopee")[3]!,
      lifestyleStyle: "home",
      lifestyleScene: { id: "home-storage-shelf", style: "home", title: "家居收納架", description: "整理好的層架與柔和自然光。" },
      avoidLifestyleStyles: ["outdoor", "office"],
    });
    const detailPrompt = buildMarketplaceImagePrompt({
      channel: "shopee",
      item: getMarketplaceSuite("shopee")[2]!,
      lifestyleStyle: "home",
      lifestyleScene: { id: "home-storage-shelf", style: "home", title: "家居收納架", description: "整理好的層架與柔和自然光。" },
      avoidLifestyleStyles: ["outdoor"],
    });

    expect(lifestylePrompt).toContain("merchant selected this non-factual scene direction: 家居收納架");
    expect(lifestylePrompt).toContain("Avoid these unrelated setting categories for this image: 戶外, 辦公室");
    expect(lifestylePrompt).toContain("Do not treat it as evidence of a product use");
    expect(detailPrompt).not.toContain("家居收納架");
    expect(detailPrompt).not.toContain("Avoid these unrelated setting categories");
  });

  it("makes every selected lifestyle style visibly distinct from studio imagery and each other", () => {
    const lifestyle = getMarketplaceSuite("amazon")[3]!;
    const home = buildMarketplaceImagePrompt({ channel: "amazon", item: lifestyle, lifestyleStyle: "home" });
    const office = buildMarketplaceImagePrompt({ channel: "amazon", item: lifestyle, lifestyleStyle: "office" });
    const automatic = buildMarketplaceImagePrompt({ channel: "amazon", item: lifestyle, lifestyleStyle: "auto" });

    expect(home).toContain("unmistakably home-interior setting");
    expect(home).toContain("at least two visible domestic cues");
    expect(home).toContain("Never use a seamless studio backdrop");
    expect(office).toContain("unmistakably professional office or workspace setting");
    expect(office).toContain("at least two visible workplace cues");
    expect(office).toContain("Never use a seamless studio backdrop");
    expect(automatic).toContain("clearly recognisable, real-world non-studio setting");
    expect(getMarketplaceLifestyleSceneCorrection("home")).toContain("explicitly selected Home");
    expect(getMarketplaceLifestyleSceneCorrection("office")).toContain("explicitly selected Office");
    expect(getMarketplaceLifestyleSceneCorrection("outdoor")).toContain("explicitly selected Outdoor");
  });

  it("recognizes supported marketplace channel keys only", () => {
    expect(isMarketplaceChannel("google")).toBe(true);
    expect(isMarketplaceChannel("lazada_th")).toBe(true);
    expect(isMarketplaceChannel("shopee_th")).toBe(true);
    expect(isMarketplaceChannel("ebay")).toBe(false);
  });

  it("discloses embedded IPTC AI metadata for Google Merchant Center exports", () => {
    expect(MARKETPLACE_CHANNELS.google.note).toContain("IPTC");
    expect(MARKETPLACE_CHANNELS.google.note).toContain("PNG");

    const prompt = buildMarketplaceImagePrompt({ channel: "google", item: getMarketplaceSuite("google")[0]! });
    expect(prompt).toContain("Do not render any platform requirement, AI disclosure, IPTC label, or metadata");
    expect(prompt).not.toContain(MARKETPLACE_CHANNELS.google.note);
  });

  it("prices the selected image plan and uses brand styling only in supplementary images", () => {
    expect(getMarketplaceSuiteSelection(["main", "lifestyle"])).toEqual(["main", "lifestyle"]);
    expect(getMarketplaceSuiteCreditCost(["main", "lifestyle"])).toBe(2);
    expect(normaliseMarketplaceBrandStyle({ accentColor: "#2f7a63", fontStyle: "editorial" })).toEqual({ accentColor: "#2F7A63", fontStyle: "editorial" });

    const mainPrompt = buildMarketplaceImagePrompt({ channel: "amazon", item: getMarketplaceSuite("amazon")[0]!, brandStyle: { accentColor: "#2F7A63", fontStyle: "editorial" }, referenceImageCount: 2 });
    const detailPrompt = buildMarketplaceImagePrompt({ channel: "amazon", item: getMarketplaceSuite("amazon")[2]!, brandStyle: { accentColor: "#2F7A63", fontStyle: "editorial" }, referenceImageCount: 2 });
    expect(mainPrompt).toContain("2 reference photos");
    expect(mainPrompt).toContain("Do not apply the merchant brand colour");
    expect(detailPrompt).toContain("#2F7A63");
    expect(detailPrompt).toContain("高級雜誌感");
  });

  it("allows an approved logo only in eligible supplementary image prompts", () => {
    const brandIdentity = { accentColor: "#2F7A63", fontStyle: "friendly" as const, name: "SIM uncle", hasLogo: true };
    const mainPrompt = buildMarketplaceImagePrompt({ channel: "amazon", item: getMarketplaceSuite("amazon")[0]!, brandIdentity });
    const detailPrompt = buildMarketplaceImagePrompt({ channel: "amazon", item: getMarketplaceSuite("amazon")[2]!, brandIdentity });
    const googlePrompt = buildMarketplaceImagePrompt({ channel: "google", item: getMarketplaceSuite("google")[2]!, brandIdentity });
    expect(mainPrompt).not.toContain("last supplied reference is the merchant's approved logo");
    expect(detailPrompt).toContain("last supplied reference is the merchant's approved logo");
    expect(googlePrompt).toContain("Google Merchant Center assets must not include a brand overlay");
  });
});
