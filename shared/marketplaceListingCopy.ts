import type { MarketplaceChannel } from "./marketplaceSuites";
import { getThailandMarketplaceListingRequirements, normaliseThailandMarketplaceListingFields, type ThailandMarketplaceListingFields } from "./thailandMarketplaceListing";

export type MarketplaceListingCopy = {
  channel: MarketplaceChannel;
  title: string;
  bullets: string[];
  reviewNotes: string[];
  thailandFields?: ThailandMarketplaceListingFields | null;
};

export const EMPTY_MARKETPLACE_LISTING_COPY: MarketplaceListingCopy = {
  channel: "amazon",
  title: "",
  bullets: [],
  reviewNotes: [],
  thailandFields: null,
};

export function normaliseMarketplaceListingCopy(input: Partial<MarketplaceListingCopy>, channel: MarketplaceChannel): MarketplaceListingCopy {
  const thailandRequirements = getThailandMarketplaceListingRequirements(channel);
  return {
    channel,
    title: typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ").slice(0, thailandRequirements?.titleLimit ?? 180) : "",
    bullets: Array.isArray(input.bullets)
      ? input.bullets.filter((value): value is string => typeof value === "string").map((value) => value.trim().replace(/\s+/g, " ")).filter(Boolean).slice(0, 5).map((value) => value.slice(0, 240))
      : [],
    reviewNotes: Array.isArray(input.reviewNotes)
      ? input.reviewNotes.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 4).map((value) => value.slice(0, 180))
      : [],
    thailandFields: normaliseThailandMarketplaceListingFields(input.thailandFields, channel),
  };
}

export function isMarketplaceListingCopyReady(copy: MarketplaceListingCopy) {
  return copy.title.trim().length > 0 && copy.bullets.length === 5;
}
