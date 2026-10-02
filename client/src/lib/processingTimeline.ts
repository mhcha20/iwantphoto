export type ProcessingTimelineEvent = {
  id: number;
  units: number;
  source: string;
  createdAt: Date;
};

export function getProcessingTimelineLabel(source: string) {
  if (source === "editor_background") return "智能去背處理";
  if (source === "editor_cleanup") return "清除修圖";
  if (source === "marketplace_main") return "商品套組：合規白底主圖";
  if (source === "marketplace_studio") return "商品套組：完整套裝輔助圖";
  if (source === "marketplace_detail") return "商品套組：核實賣點圖";
  if (source === "marketplace_lifestyle") return "商品套組：使用情境圖";
  if (source.startsWith("legacy_deleted_repair_")) return "已完成處理（舊紀錄修正）";
  if (source.startsWith("legacy_image_")) return "已完成相片處理";
  return "已完成圖片處理";
}

export function formatProcessingTimelineTime(value: Date) {
  return new Date(value).toLocaleString("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function getProcessingTimelineUnitCopy(units: number) {
  return `${Math.max(1, Math.floor(units))} 張額度`;
}
