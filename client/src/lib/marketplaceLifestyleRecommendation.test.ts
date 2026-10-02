import { describe, expect, it } from "vitest";
import { getMarketplaceLifestyleRecommendationStatus, resolveMarketplaceLifestyleStyle } from "./marketplaceLifestyleRecommendation";

const officeRecommendation = { style: "office" as const, reason: "產品外形適合工作桌或辦公收納空間。" };

describe("marketplace lifestyle recommendation", () => {
  it("applies the AI recommendation when the merchant has not selected a scene", () => {
    expect(resolveMarketplaceLifestyleStyle({
      currentStyle: "auto",
      recommendation: officeRecommendation,
      merchantSelected: false,
    })).toBe("office");
  });

  it("keeps a merchant-selected or saved-workflow setting authoritative", () => {
    expect(resolveMarketplaceLifestyleStyle({
      currentStyle: "home",
      recommendation: officeRecommendation,
      merchantSelected: true,
    })).toBe("home");
    expect(getMarketplaceLifestyleRecommendationStatus({
      currentStyle: "home",
      recommendation: officeRecommendation,
      merchantSelected: true,
    })).toBe("merchant-choice");
  });

  it("identifies applied and available recommendations accurately", () => {
    expect(getMarketplaceLifestyleRecommendationStatus({
      currentStyle: "office",
      recommendation: officeRecommendation,
      merchantSelected: false,
    })).toBe("applied");
    expect(getMarketplaceLifestyleRecommendationStatus({
      currentStyle: "auto",
      recommendation: officeRecommendation,
      merchantSelected: false,
    })).toBe("available");
  });
});
