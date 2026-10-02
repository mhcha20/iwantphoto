import type { ReprocessBackgroundStyle, ReprocessMode } from "./reprocessWorkflow";

export type ProcessingHistoryRecord = {
  id: string;
  imageId: string;
  fileName: string;
  mode: ReprocessMode;
  backgroundStyle: ReprocessBackgroundStyle;
  durationMs: number;
  completedAt: number;
  success: boolean;
  message?: string;
};

export function getProcessingMethodLabel(mode: ReprocessMode, backgroundStyle: ReprocessBackgroundStyle) {
  if (mode === "cleanup") return "精確清除";
  return backgroundStyle === "transparent" ? "去背 · 透明底" : "去背 · 純白底";
}

export function formatProcessingDuration(durationMs: number) {
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return seconds < 60 ? `約 ${seconds} 秒` : `約 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

export function trimProcessingHistory(records: ProcessingHistoryRecord[], maximum = 20) {
  return records.slice(0, Math.max(1, maximum));
}
