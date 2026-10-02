export type PhotoLibraryMode = "background" | "cleanup" | "marketplace";
export type PhotoLibraryFilter = "all" | "last-7-days" | "this-month" | PhotoLibraryMode;
export type PhotoLibrarySort = "newest" | "largest" | "smallest";

export type PhotoLibraryRecord = {
  id: number;
  fileName: string;
  mode: PhotoLibraryMode;
  cleanupNote?: string | null;
  createdAt: Date | string;
};

export type StoredPhotoLibraryRecord = PhotoLibraryRecord & {
  projectId: number | null;
  originalBytes: number;
  processedBytes: number;
};

export type MonthlyImageUsage = {
  used: number;
  allowance: number;
  remaining: number;
  percentage: number;
};

function asDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getSavedImageStorageBytes(record: Pick<StoredPhotoLibraryRecord, "originalBytes" | "processedBytes">) {
  const original = Number.isFinite(record.originalBytes) ? Math.max(0, record.originalBytes) : 0;
  const processed = Number.isFinite(record.processedBytes) ? Math.max(0, record.processedBytes) : 0;
  return original + processed;
}

/** Defaults to newest-first; storage ordering is explicitly opt-in. */
export function sortPhotoLibraryRecords<T extends StoredPhotoLibraryRecord>(records: T[], sort: PhotoLibrarySort): T[] {
  return [...records].sort((left, right) => {
    const leftBytes = getSavedImageStorageBytes(left);
    const rightBytes = getSavedImageStorageBytes(right);
    if (sort === "largest" && rightBytes !== leftBytes) return rightBytes - leftBytes;
    if (sort === "smallest" && rightBytes !== leftBytes) return leftBytes - rightBytes;
    const leftTime = asDate(left.createdAt)?.getTime() ?? 0;
    const rightTime = asDate(right.createdAt)?.getTime() ?? 0;
    return rightTime - leftTime || right.id - left.id;
  });
}

export function selectedUnclassifiedPhotoLibraryRecords<T extends StoredPhotoLibraryRecord>(records: T[], selectedIds: Set<number>) {
  return records.filter((record) => record.projectId === null && selectedIds.has(record.id));
}

export function filterPhotoLibrary<T extends PhotoLibraryRecord>(
  records: T[],
  search: string,
  filter: PhotoLibraryFilter,
  now = new Date(),
) {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  return records.filter((record) => {
    const searchable = `${record.fileName} ${record.cleanupNote || ""}`.toLocaleLowerCase();
    if (normalizedSearch && !searchable.includes(normalizedSearch)) return false;
    if (filter === "background" || filter === "cleanup" || filter === "marketplace") return record.mode === filter;

    const createdAt = asDate(record.createdAt);
    if (!createdAt) return filter === "all";
    if (filter === "last-7-days") return createdAt >= weekStart && createdAt <= now;
    if (filter === "this-month") return createdAt >= monthStart && createdAt <= now;
    return true;
  });
}

export function getMonthlyImageUsage(used: number, allowance: number): MonthlyImageUsage {
  const safeUsed = Math.max(0, Math.floor(used));
  const safeAllowance = Math.max(1, Math.floor(allowance));
  return {
    used: safeUsed,
    allowance: safeAllowance,
    remaining: Math.max(0, safeAllowance - safeUsed),
    percentage: Math.min(100, Math.round((safeUsed / safeAllowance) * 100)),
  };
}

export function selectedPhotoLibraryRecords<T extends { id: number }>(records: T[], selectedIds: Set<number>) {
  return records.filter((record) => selectedIds.has(record.id));
}

export function createProcessedDownloadFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "image";
  return `iwantphoto-${baseName}-processed.png`;
}
