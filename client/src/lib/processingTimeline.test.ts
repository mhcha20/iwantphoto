import { describe, expect, it } from "vitest";
import { formatProcessingTimelineTime, getProcessingTimelineLabel, getProcessingTimelineUnitCopy } from "./processingTimeline";

describe("processing timeline helpers", () => {
  it("labels standard and marketplace processing events clearly", () => {
    expect(getProcessingTimelineLabel("editor_background")).toBe("智能去背處理");
    expect(getProcessingTimelineLabel("marketplace_lifestyle")).toBe("商品套組：使用情境圖");
    expect(getProcessingTimelineLabel("legacy_image_88")).toBe("已完成相片處理");
  });

  it("keeps legacy repair and unknown events safe to display", () => {
    expect(getProcessingTimelineLabel("legacy_deleted_repair_20260920")).toBe("已完成處理（舊紀錄修正）");
    expect(getProcessingTimelineLabel("unexpected_source")).toBe("已完成圖片處理");
    expect(getProcessingTimelineUnitCopy(0)).toBe("1 張額度");
    expect(getProcessingTimelineUnitCopy(4)).toBe("4 張額度");
  });

  it("formats timestamp values for the account locale", () => {
    expect(formatProcessingTimelineTime(new Date("2026-09-20T10:30:00.000Z"))).toContain("2026");
  });
});
