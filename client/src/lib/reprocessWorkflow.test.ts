import { describe, expect, it } from "vitest";
import { formatProcessingDuration, getProcessingMethodLabel, trimProcessingHistory, type ProcessingHistoryRecord } from "./processingHistory";
import { getReprocessRequest } from "./reprocessWorkflow";

describe("reprocessing workflow", () => {
  it("makes transparent-background reprocessing explicit", () => {
    expect(getReprocessRequest("background-transparent", "white")).toEqual({ mode: "background", backgroundStyle: "transparent" });
  });

  it("makes white-background reprocessing explicit", () => {
    expect(getReprocessRequest("background-white", "transparent")).toEqual({ mode: "background", backgroundStyle: "white" });
  });

  it("keeps the selected background style for a cleanup retry", () => {
    expect(getReprocessRequest("cleanup", "white")).toEqual({ mode: "cleanup", backgroundStyle: "white" });
  });
});

describe("processing history", () => {
  const record: ProcessingHistoryRecord = { id: "1", imageId: "a", fileName: "product.jpg", mode: "background", backgroundStyle: "white", durationMs: 12_300, completedAt: 1, success: true };

  it("formats methods and duration for a readable current-session record", () => {
    expect(getProcessingMethodLabel("background", "white")).toBe("去背 · 純白底");
    expect(getProcessingMethodLabel("cleanup", "transparent")).toBe("精確清除");
    expect(formatProcessingDuration(12_300)).toBe("約 12 秒");
  });

  it("keeps only the most recent processing history records", () => {
    expect(trimProcessingHistory([record, { ...record, id: "2" }], 1)).toEqual([record]);
  });
});
