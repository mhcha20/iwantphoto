import { describe, expect, it } from "vitest";
import { getProjectStoragePercentage, sortProjectStorageSummaries } from "./projectStorage";

describe("project storage summaries", () => {
  it("calculates an account-relative storage share", () => {
    expect(getProjectStoragePercentage(256, 1024)).toBe(25);
    expect(getProjectStoragePercentage(1, 0)).toBe(0);
    expect(getProjectStoragePercentage(300, 100)).toBe(100);
  });

  it("orders the largest project footprint first", () => {
    expect(sortProjectStorageSummaries([
      { projectId: 1, name: "小型", imageCount: 2, usedBytes: 100 },
      { projectId: null, name: "未分類", imageCount: 3, usedBytes: 400 },
      { projectId: 2, name: "中型", imageCount: 4, usedBytes: 300 },
    ]).map((record) => record.name)).toEqual(["未分類", "中型", "小型"]);
  });

  it("keeps unclassified saved images in the account storage distribution", () => {
    const records = sortProjectStorageSummaries([
      { projectId: null, name: "未分類", imageCount: 4, usedBytes: 4096 },
      { projectId: 2, name: "產品圖", imageCount: 1, usedBytes: 1024 },
    ]);
    expect(records[0]).toMatchObject({ projectId: null, name: "未分類", imageCount: 4, usedBytes: 4096 });
    expect(getProjectStoragePercentage(records[0]!.usedBytes, 5120)).toBe(80);
  });
});
