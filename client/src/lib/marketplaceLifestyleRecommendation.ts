import type { MarketplaceLifestyleRecommendation } from "@shared/marketplaceProductBrief";
import type { MarketplaceLifestyleStyle } from "@shared/marketplaceSuites";

/** Keeps a merchant or saved-workflow choice authoritative over a new AI suggestion. */
export function resolveMarketplaceLifestyleStyle(input: {
  currentStyle: MarketplaceLifestyleStyle;
  recommendation: MarketplaceLifestyleRecommendation;
  merchantSelected: boolean;
}) {
  return input.merchantSelected ? input.currentStyle : input.recommendation.style;
}

export function getMarketplaceLifestyleRecommendationStatus(input: {
  currentStyle: MarketplaceLifestyleStyle;
  recommendation: MarketplaceLifestyleRecommendation | null;
  merchantSelected: boolean;
}) {
  if (!input.recommendation) return "unavailable" as const;
  if (input.merchantSelected) return "merchant-choice" as const;
  return input.currentStyle === input.recommendation.style ? "applied" as const : "available" as const;
}
