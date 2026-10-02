import type { MarketplaceChannel } from "@shared/marketplaceSuites";
import type { MarketplaceListingCopy } from "@shared/marketplaceListingCopy";
import type { MarketplaceProductBrief } from "@shared/marketplaceProductBrief";

export type SavedMarketplaceProduct = {
  id: number;
  userId: number;
  projectId: number;
  sku: string;
  productName: string;
  brief: MarketplaceProductBrief;
  listingCopy: MarketplaceListingCopy | null;
  createdAt: Date;
  updatedAt: Date;
};

export function formatMarketplaceListingBullets(copy: MarketplaceListingCopy | null) {
  if (!copy?.bullets.length) return "";
  return copy.bullets.map((bullet, index) => `${index + 1}. ${bullet}`).join("\n");
}

export function getSavedMarketplaceListingCopyForChannel(product: SavedMarketplaceProduct, channel: MarketplaceChannel) {
  return product.listingCopy?.channel === channel ? product.listingCopy : null;
}

export async function copyMarketplaceText(text: string) {
  const value = text.trim();
  if (!value) throw new Error("暫時沒有可複製的內容。");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("瀏覽器未能複製文字，請手動選取。" );
}
