import { describe, expect, it } from "vitest";
import { getProcessingErrorMessage, shouldResetBatchFeedback } from "./processingFeedback";

describe("processing feedback", () => {
  it("uses the server error when it is available", () => {
    expect(getProcessingErrorMessage(new Error("相片格式不正確"))).toBe("相片格式不正確");
  });

  it("replaces low-level URL pattern errors with actionable no-charge recovery copy", () => {
    expect(getProcessingErrorMessage(new Error("The string did not match the expected pattern.")))
      .toBe("相片準備服務暫時未能連線，請重新上載後再試；未完成圖片不會扣除額度。");
  });

  it("uses a clear retry message for unknown failures", () => {
    expect(getProcessingErrorMessage(undefined)).toContain("手動重新嘗試");
  });

  it("clears completed batch feedback when the final old image is removed", () => {
    expect(shouldResetBatchFeedback(0)).toBe(true);
    expect(shouldResetBatchFeedback(1)).toBe(false);
  });
});
