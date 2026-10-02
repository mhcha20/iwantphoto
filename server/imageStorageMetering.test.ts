import { describe, expect, it, vi } from "vitest";
import { needsStoredImageSizeMeasurement, refreshStoredImageSizes } from "./imageStorageMetering";

describe("legacy saved-image storage metering", () => {
  it("identifies only records with a missing original or processed size", () => {
    expect(needsStoredImageSizeMeasurement({ id: 1, originalUrl: "/manus-storage/a", processedUrl: "/manus-storage/b", originalBytes: 0, processedBytes: 12 })).toBe(true);
    expect(needsStoredImageSizeMeasurement({ id: 2, originalUrl: "/manus-storage/a", processedUrl: "/manus-storage/b", originalBytes: 12, processedBytes: 16 })).toBe(false);
  });

  it("measures only missing fields and preserves measured records", async () => {
    const listMissing = vi.fn().mockResolvedValue([{ id: 3, originalUrl: "/manus-storage/original.jpg", processedUrl: "/manus-storage/result.png", originalBytes: 0, processedBytes: 42 }]);
    const update = vi.fn().mockResolvedValue(undefined);
    const getKey = vi.fn((url: string) => url.split("/").at(-1));
    const getByteSize = vi.fn().mockResolvedValue(84);

    await expect(refreshStoredImageSizes(7, { listMissing, update, getKey, getByteSize })).resolves.toEqual({ checked: 1, updated: 1, failed: 0 });
    expect(getByteSize).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(7, 3, { originalBytes: 84, processedBytes: 42 });
  });

  it("continues measuring other records when one managed object is unavailable", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const getByteSize = vi.fn().mockImplementation((key: string) => key === "bad" ? Promise.reject(new Error("missing")) : Promise.resolve(30));
    const result = await refreshStoredImageSizes(7, {
      listMissing: vi.fn().mockResolvedValue([
        { id: 1, originalUrl: "/manus-storage/bad", processedUrl: "/manus-storage/good", originalBytes: 0, processedBytes: 0 },
        { id: 2, originalUrl: "/manus-storage/good", processedUrl: "/manus-storage/good", originalBytes: 0, processedBytes: 0 },
      ]),
      update,
      getKey: (url) => url.split("/").at(-1),
      getByteSize,
    });
    expect(result).toEqual({ checked: 2, updated: 1, failed: 1 });
    expect(update).toHaveBeenCalledWith(7, 2, { originalBytes: 30, processedBytes: 30 });
  });
});
