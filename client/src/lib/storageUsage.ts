export function getStorageUsagePercentage(usedBytes: number, allowanceBytes: number) {
  if (!Number.isFinite(usedBytes) || !Number.isFinite(allowanceBytes) || allowanceBytes <= 0) return 0;
  return Math.max(0, Math.min(100, (usedBytes / allowanceBytes) * 100));
}

export function isStorageNearCapacity(usedBytes: number, allowanceBytes: number) {
  return getStorageUsagePercentage(usedBytes, allowanceBytes) >= 85;
}
