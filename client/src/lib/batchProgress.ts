export type BatchProgressState = {
  total: number;
  completed: number;
  completedDurationMs: number;
  currentStartedAt: number;
};

// Background removal runs two local segmentation models (plus the image model when unsure).
const DEFAULT_IMAGE_DURATION_MS = 36_000;

export function estimateSingleImageProgress(startedAt: number, now = Date.now()) {
  const elapsedMs = Math.max(0, now - startedAt);
  const inFlightProgress = Math.min(0.95, elapsedMs / DEFAULT_IMAGE_DURATION_MS);
  const percentage = Math.min(99, Math.max(1, Math.round(inFlightProgress * 100)));
  const remainingSeconds = Math.max(0, Math.ceil((DEFAULT_IMAGE_DURATION_MS - elapsedMs) / 1000));

  return { percentage, remainingSeconds, estimatedDurationMs: DEFAULT_IMAGE_DURATION_MS };
}

export function estimateBatchProgress(progress: BatchProgressState, now = Date.now()) {
  const total = Math.max(1, progress.total);
  const completed = Math.min(Math.max(0, progress.completed), total);
  const averageImageDurationMs = completed > 0
    ? Math.max(1_000, progress.completedDurationMs / completed)
    : DEFAULT_IMAGE_DURATION_MS;
  const currentElapsedMs = Math.max(0, now - progress.currentStartedAt);
  const inFlightProgress = completed >= total ? 0 : Math.min(0.95, currentElapsedMs / averageImageDurationMs);
  const percentage = completed >= total
    ? 100
    : Math.min(99, Math.round(((completed + inFlightProgress) / total) * 100));
  const remainingSeconds = Math.max(0, Math.ceil(((total - completed - inFlightProgress) * averageImageDurationMs) / 1000));

  return { percentage, remainingSeconds, averageImageDurationMs };
}

export function formatEstimatedSeconds(seconds: number) {
  if (seconds <= 5) return "少於 5 秒";
  if (seconds < 60) return `約 ${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `約 ${minutes} 分 ${remainder} 秒` : `約 ${minutes} 分`;
}
