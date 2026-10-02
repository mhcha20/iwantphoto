export type ProjectStorageSummary = {
  projectId: number | null;
  name: string;
  imageCount: number;
  usedBytes: number;
};

export function getProjectStoragePercentage(usedBytes: number, accountUsedBytes: number) {
  if (!Number.isFinite(usedBytes) || !Number.isFinite(accountUsedBytes) || accountUsedBytes <= 0) return 0;
  return Math.max(0, Math.min(100, (usedBytes / accountUsedBytes) * 100));
}

export function sortProjectStorageSummaries(records: ProjectStorageSummary[]) {
  return [...records].sort((left, right) => right.usedBytes - left.usedBytes || right.imageCount - left.imageCount || left.name.localeCompare(right.name, "zh-HK"));
}
