export const MAX_BATCH_FILES = 10;

export function selectBatchFiles<T>(files: T[], existingCount: number, maxFiles = MAX_BATCH_FILES) {
  const availableSlots = Math.max(0, maxFiles - existingCount);
  return files.slice(0, availableSlots);
}

export function queueEligible<T extends { status: string }>(entries: T[]) {
  return entries.filter((entry) => entry.status === "ready" || entry.status === "error");
}

export function queueFailed<T extends { status: string }>(entries: T[]) {
  return entries.filter((entry) => entry.status === "error");
}
