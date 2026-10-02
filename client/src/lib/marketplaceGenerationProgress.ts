import { getMarketplaceSuite, type MarketplaceChannel, type MarketplaceImageRole } from "@shared/marketplaceSuites";

// The provider returns only a final response, not role-by-role progress. Use a
// deliberately conservative estimate and never wrap the bar back to the start
// of a role: a long-running suite must remain monotonic and visibly estimated.
const ROLE_ESTIMATE_MS = 40_000;

export type MarketplaceGenerationProgress = {
  role: MarketplaceImageRole;
  roleTitle: string;
  completed: number;
  total: number;
  percent: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  isOverEstimate: boolean;
};

export function getMarketplaceGenerationProgress(input: {
  channel: MarketplaceChannel;
  roles: MarketplaceImageRole[];
  startedAt: number | null;
  completedCount?: number;
  now?: number;
}): MarketplaceGenerationProgress | null {
  if (!input.startedAt || !input.roles.length) return null;
  const now = input.now ?? Date.now();
  const elapsedMs = Math.max(0, now - input.startedAt);
  const completed = Math.min(input.roles.length - 1, Math.max(0, input.completedCount ?? 0));
  const role = input.roles[completed];
  const roleTitle = getMarketplaceSuite(input.channel).find((item) => item.role === role)?.title ?? "商品圖片";
  const inRoleProgress = Math.min(0.96, elapsedMs / ROLE_ESTIMATE_MS);
  const percent = Math.min(96, Math.max(4, Math.round(((completed + inRoleProgress) / input.roles.length) * 100)));
  const futureRoleCount = Math.max(0, input.roles.length - completed - 1);
  const estimatedRemainingMs = Math.max(0, ROLE_ESTIMATE_MS - elapsedMs) + futureRoleCount * ROLE_ESTIMATE_MS;
  const estimatedRemainingSeconds = Math.ceil(estimatedRemainingMs / 1000);
  return {
    role,
    roleTitle,
    completed,
    total: input.roles.length,
    percent,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    estimatedRemainingSeconds,
    isOverEstimate: elapsedMs >= ROLE_ESTIMATE_MS,
  };
}

export function formatMarketplaceGenerationSeconds(seconds: number) {
  if (seconds < 60) return `約 ${Math.max(1, seconds)} 秒`;
  return `約 ${Math.ceil(seconds / 60)} 分鐘`;
}
