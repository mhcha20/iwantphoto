import type { MarketplaceProductBrief } from "@shared/marketplaceProductBrief";

export type MarketplaceProductBriefSnapshot = {
  id: string;
  createdAt: number;
  source: "ai" | "merchant";
  name: string;
  brief: MarketplaceProductBrief;
};

export const MARKETPLACE_DRAFT_ESTIMATE_SECONDS = 24;
export const MAX_MARKETPLACE_DRAFT_HISTORY = 5;

export function cloneMarketplaceProductBrief(brief: MarketplaceProductBrief): MarketplaceProductBrief {
  return {
    productName: brief.productName,
    summary: brief.summary,
    weight: brief.weight ?? "",
    dimensions: brief.dimensions ?? "",
    confirmedFacts: [...brief.confirmedFacts],
    visualHighlights: [...brief.visualHighlights],
    usageIdeas: [...brief.usageIdeas],
    reviewQuestions: [...brief.reviewQuestions],
  };
}

export function hasMarketplaceProductBriefContent(brief: MarketplaceProductBrief) {
  return Boolean(
    brief.productName.trim()
    || brief.summary.trim()
    || brief.weight?.trim()
    || brief.dimensions?.trim()
    || brief.confirmedFacts.length
    || brief.visualHighlights.length
    || brief.usageIdeas.length
    || brief.reviewQuestions.length,
  );
}

export function createMarketplaceDraftSnapshot(
  brief: MarketplaceProductBrief,
  source: MarketplaceProductBriefSnapshot["source"],
  createdAt = Date.now(),
  name?: string,
): MarketplaceProductBriefSnapshot {
  return {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    source,
    name: normalizeMarketplaceDraftSnapshotName(name, source),
    brief: cloneMarketplaceProductBrief(brief),
  };
}

export function normalizeMarketplaceDraftSnapshotName(name: string | undefined, source: MarketplaceProductBriefSnapshot["source"]) {
  const fallback = source === "ai" ? "AI 草稿" : "重試前內容";
  return name?.trim().replace(/\s+/g, " ").slice(0, 36) || fallback;
}

export function renameMarketplaceDraftSnapshot(
  history: MarketplaceProductBriefSnapshot[],
  snapshotId: string,
  name: string,
) {
  return history.map((snapshot) => snapshot.id === snapshotId
    ? { ...snapshot, name: normalizeMarketplaceDraftSnapshotName(name, snapshot.source) }
    : snapshot);
}

export function addMarketplaceDraftSnapshot(
  history: MarketplaceProductBriefSnapshot[],
  snapshot: MarketplaceProductBriefSnapshot,
) {
  return [snapshot, ...history].slice(0, MAX_MARKETPLACE_DRAFT_HISTORY);
}

export function getMarketplaceDraftProgress(startedAt: number | null, now = Date.now()) {
  if (!startedAt) return 0;
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return Math.min(94, Math.max(8, Math.round((elapsedSeconds / MARKETPLACE_DRAFT_ESTIMATE_SECONDS) * 94)));
}

export function formatMarketplaceDraftElapsed(startedAt: number | null, now = Date.now()) {
  if (!startedAt) return "";
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (elapsedSeconds < 5) return "剛開始分析";
  const remaining = Math.max(0, MARKETPLACE_DRAFT_ESTIMATE_SECONDS - elapsedSeconds);
  return remaining > 0 ? `約餘 ${remaining} 秒` : "仍在整理資料，請稍候";
}

export type MarketplaceDraftDifference = {
  label: string;
  before: string;
  after: string;
};

function lineValue(lines: string[]) { return lines.join("、"); }

export function compareMarketplaceProductBriefs(
  before: MarketplaceProductBrief,
  after: MarketplaceProductBrief,
): MarketplaceDraftDifference[] {
  const fields: Array<[keyof MarketplaceProductBrief, string, (value: string | string[]) => string]> = [
    ["productName", "產品名稱", (value) => value as string],
    ["summary", "產品描述", (value) => value as string],
    ["weight", "產品重量", (value) => value as string],
    ["dimensions", "產品尺寸", (value) => value as string],
    ["confirmedFacts", "確認資料", (value) => lineValue(value as string[])],
    ["visualHighlights", "核實賣點", (value) => lineValue(value as string[])],
    ["usageIdeas", "使用情境", (value) => lineValue(value as string[])],
    ["reviewQuestions", "待核對項目", (value) => lineValue(value as string[])],
  ];

  return fields.flatMap(([field, label, format]) => {
    const previous = format(before[field]);
    const next = format(after[field]);
    return previous === next ? [] : [{ label, before: previous || "未填寫", after: next || "未填寫" }];
  });
}
