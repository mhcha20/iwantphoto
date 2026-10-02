import { getMarketplaceSuiteCreditCost, MARKETPLACE_SUITE_CREDIT_COST, type MarketplaceBrandStyle, type MarketplaceChannel, type MarketplaceImageRole } from "@shared/marketplaceSuites";
import type { MarketplaceReferenceQuality } from "./marketplaceReferenceQuality";

export type MarketplaceReferenceImage = {
  fileName: string;
  mimeType: string;
  originalData: string;
  previewUrl: string;
  quality?: MarketplaceReferenceQuality;
};

export type MarketplaceSuiteOutput = {
  role: MarketplaceImageRole;
  title: string;
  description: string;
  url: string;
  savedImageId?: number;
  googleMerchantMetadataEmbedded?: true;
  compositionCorrected?: true;
  compositionWarning?: string;
  /** Exact approved lines sent to this completed detail image. */
  specificationLines?: string[];
};

export type MarketplaceSuiteResult = {
  channel: MarketplaceChannel;
  outputs: MarketplaceSuiteOutput[];
  failures: Array<{ role: MarketplaceImageRole; title: string; message: string }>;
};

/** Keeps each provider call bounded so completed roles can be shown immediately on mobile. */
export function getMarketplaceRoleRequestPlan(selectedRoles: MarketplaceImageRole[]) {
  return selectedRoles.map((role) => [role] as [MarketplaceImageRole]);
}

/** Replaces only retried roles while retaining prior successful suite assets. */
export function mergeMarketplaceSuiteResult(previous: MarketplaceSuiteResult | null, incoming: MarketplaceSuiteResult) {
  if (!previous || previous.channel !== incoming.channel) return incoming;
  const roleOrder: MarketplaceImageRole[] = ["main", "studio", "detail", "lifestyle"];
  const retriedRoles = new Set<MarketplaceImageRole>([
    ...incoming.outputs.map((output) => output.role),
    ...incoming.failures.map((failure) => failure.role),
  ]);
  const outputs = [...previous.outputs.filter((output) => !retriedRoles.has(output.role)), ...incoming.outputs]
    .sort((left, right) => roleOrder.indexOf(left.role) - roleOrder.indexOf(right.role));
  const failures = [...previous.failures.filter((failure) => !retriedRoles.has(failure.role)), ...incoming.failures];
  return { channel: incoming.channel, outputs, failures } satisfies MarketplaceSuiteResult;
}

export function getMarketplaceSuiteCreditCopy(selectedRoles?: MarketplaceImageRole[]) {
  const cost = getMarketplaceSuiteCreditCost(selectedRoles);
  return `此套組會使用 ${cost || MARKETPLACE_SUITE_CREDIT_COST} 張處理額度`;
}

export function getMarketplaceResultFileName(fileName: string, role: MarketplaceImageRole) {
  const base = fileName.replace(/\.[^.]+$/, "") || "product";
  return `iwantphoto-${base}-${role}.png`;
}

export function getMarketplaceBrandPreviewCopy(style: MarketplaceBrandStyle) {
  return `${style.accentColor} · ${style.fontStyle === "clean" ? "簡潔無襯線" : style.fontStyle === "editorial" ? "高級雜誌感" : "親和圓角"}`;
}
