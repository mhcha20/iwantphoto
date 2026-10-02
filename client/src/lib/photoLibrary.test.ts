import { describe, expect, it } from "vitest";
import {
  createProcessedDownloadFileName,
  filterPhotoLibrary,
  getMonthlyImageUsage,
  getSavedImageStorageBytes,
  selectedPhotoLibraryRecords,
  selectedUnclassifiedPhotoLibraryRecords,
  sortPhotoLibraryRecords,
} from "./photoLibrary";

const records = [
  { id: 1, fileName: "product-cup.jpg", mode: "background" as const, projectId: 2, originalBytes: 120, processedBytes: 40, createdAt: new Date("2026-09-15T09:00:00Z") },
  { id: 2, fileName: "shopfront.jpg", mode: "cleanup" as const, cleanupNote: "移除紙箱", projectId: null, originalBytes: 400, processedBytes: 100, createdAt: new Date("2026-09-09T09:00:00Z") },
  { id: 3, fileName: "old-menu.jpg", mode: "cleanup" as const, projectId: null, originalBytes: 12, processedBytes: 8, createdAt: new Date("2026-08-30T09:00:00Z") },
  { id: 4, fileName: "tote-amazon-main.png", mode: "marketplace" as const, cleanupNote: "Amazon 商品頁 · 合規白底主圖", projectId: 2, originalBytes: 0, processedBytes: 190, createdAt: new Date("2026-09-17T10:00:00Z") },
];

describe("photo library helpers", () => {
  const now = new Date("2026-09-17T12:00:00Z");

  it("filters records by search, time period, and processing mode", () => {
    expect(filterPhotoLibrary(records, "cup", "all", now).map((record) => record.id)).toEqual([1]);
    expect(filterPhotoLibrary(records, "", "last-7-days", now).map((record) => record.id)).toEqual([1, 4]);
    expect(filterPhotoLibrary(records, "", "this-month", now).map((record) => record.id)).toEqual([1, 2, 4]);
    expect(filterPhotoLibrary(records, "紙箱", "cleanup", now).map((record) => record.id)).toEqual([2]);
    expect(filterPhotoLibrary(records, "amazon", "marketplace", now).map((record) => record.id)).toEqual([4]);
  });

  it("calculates a safe monthly allowance summary", () => {
    expect(getMonthlyImageUsage(12, 50)).toEqual({ used: 12, allowance: 50, remaining: 38, percentage: 24 });
    expect(getMonthlyImageUsage(70, 50)).toMatchObject({ used: 70, allowance: 50, remaining: 0, percentage: 100 });
  });

  it("selects only the requested records and names processed downloads", () => {
    expect(selectedPhotoLibraryRecords(records, new Set([1, 3])).map((record) => record.id)).toEqual([1, 3]);
    expect(createProcessedDownloadFileName("產品相片.jpg")).toBe("iwantphoto-產品相片-processed.png");
  });

  it("sums both saved objects for one image", () => {
    expect(getSavedImageStorageBytes(records[0]!)).toBe(160);
    expect(getSavedImageStorageBytes({ originalBytes: -1, processedBytes: Number.NaN })).toBe(0);
  });

  it("keeps newest photos first by default and supports capacity ordering", () => {
    expect(sortPhotoLibraryRecords(records, "newest").map((record) => record.id)).toEqual([4, 1, 2, 3]);
    expect(sortPhotoLibraryRecords(records, "largest").map((record) => record.id)).toEqual([2, 4, 1, 3]);
    expect(sortPhotoLibraryRecords(records, "smallest").map((record) => record.id)).toEqual([3, 1, 4, 2]);
  });

  it("limits bulk removal candidates to selected unclassified records", () => {
    expect(selectedUnclassifiedPhotoLibraryRecords(records, new Set([1, 2, 3])).map((record) => record.id)).toEqual([2, 3]);
  });
});
