import { getManagedStorageKey, storageGetByteSize } from "./storage";

export type StoredImageSizeRecord = {
  id: number;
  originalUrl: string;
  processedUrl: string;
  originalBytes: number;
  processedBytes: number;
};

type StoredImageSizeDependencies = {
  listMissing: (userId: number, limit: number) => Promise<StoredImageSizeRecord[]>;
  update: (userId: number, imageId: number, sizes: { originalBytes: number; processedBytes: number }) => Promise<void>;
  getKey?: typeof getManagedStorageKey;
  getByteSize?: typeof storageGetByteSize;
};

export function needsStoredImageSizeMeasurement(record: StoredImageSizeRecord) {
  return record.originalBytes <= 0 || record.processedBytes <= 0;
}

async function measureUrl(storageUrl: string, getKey: typeof getManagedStorageKey, getByteSize: typeof storageGetByteSize) {
  const key = getKey(storageUrl);
  if (!key) throw new Error("Saved image is not stored in managed project storage");
  return getByteSize(key);
}

/**
 * Repairs legacy records created before file byte metering was introduced.
 * Only zero-byte fields are measured; recorded values are never overwritten.
 */
export async function refreshStoredImageSizes(userId: number, dependencies: StoredImageSizeDependencies, limit = 60) {
  const records = await dependencies.listMissing(userId, limit);
  const getKey = dependencies.getKey ?? getManagedStorageKey;
  const getByteSize = dependencies.getByteSize ?? storageGetByteSize;
  let updated = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const [originalBytes, processedBytes] = await Promise.all([
        record.originalBytes > 0 ? record.originalBytes : measureUrl(record.originalUrl, getKey, getByteSize),
        record.processedBytes > 0 ? record.processedBytes : measureUrl(record.processedUrl, getKey, getByteSize),
      ]);
      await dependencies.update(userId, record.id, { originalBytes, processedBytes });
      updated += 1;
    } catch (error) {
      console.warn("[iwantphoto storage] could not measure legacy saved image", { imageId: record.id, error });
      failed += 1;
    }
  }

  return { checked: records.length, updated, failed };
}
