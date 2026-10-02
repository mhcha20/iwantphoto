import { describe, expect, it } from "vitest";
import { selectImagePreviewUrl } from "./imagePreview";

describe("selectImagePreviewUrl", () => {
  it("shows the source photo by default", () => {
    expect(selectImagePreviewUrl("original.jpg", "processed.png", "original")).toBe("original.jpg");
  });

  it("shows the processed photo after the user switches view", () => {
    expect(selectImagePreviewUrl("original.jpg", "processed.png", "processed")).toBe("processed.png");
  });

  it("can keep the completed image selected after processing succeeds", () => {
    const completedPreviewMode = "processed" as const;
    expect(selectImagePreviewUrl("original.jpg", "processed.png", completedPreviewMode)).toBe("processed.png");
  });

  it("falls back to the source photo when processing is not yet complete", () => {
    expect(selectImagePreviewUrl("original.jpg", undefined, "processed")).toBe("original.jpg");
  });
});
