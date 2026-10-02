export const STORAGE_ALERT_THRESHOLDS = [80, 95] as const;
export type StorageAlertThreshold = (typeof STORAGE_ALERT_THRESHOLDS)[number];

export function getHighestStorageAlertThreshold(usedBytes: number, allowanceBytes: number): StorageAlertThreshold | null {
  if (!Number.isFinite(usedBytes) || !Number.isFinite(allowanceBytes) || allowanceBytes <= 0) return null;
  const percentage = (usedBytes / allowanceBytes) * 100;
  if (percentage >= 95) return 95;
  if (percentage >= 80) return 80;
  return null;
}

export function getStorageAlertCopy(threshold: StorageAlertThreshold) {
  if (threshold === 95) {
    return {
      subject: "Iwantphoto：你的儲存空間已使用 95%",
      heading: "儲存空間即將用滿",
      detail: "為免下一次處理無法儲存，請盡快下載並移除不再需要的相片，或加購儲存容量。",
      tone: "critical" as const,
    };
  }

  return {
    subject: "Iwantphoto：你的儲存空間已使用 80%",
    heading: "儲存空間快將用滿",
    detail: "建議你預先整理不再需要的相片，或加購儲存容量，確保下一次處理可以順利儲存。",
    tone: "notice" as const,
  };
}

export function storageUsagePercent(usedBytes: number, allowanceBytes: number) {
  if (!Number.isFinite(usedBytes) || !Number.isFinite(allowanceBytes) || allowanceBytes <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((usedBytes / allowanceBytes) * 1000) / 10));
}

export function shouldRearmStorageAlerts(usedBytes: number, allowanceBytes: number) {
  return storageUsagePercent(usedBytes, allowanceBytes) < 75;
}
