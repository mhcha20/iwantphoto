import { ACCOUNT_PLANS, type AccountPlan } from "./plans";

export const STORAGE_ADD_ONS = {
  archive_50: {
    key: "archive_50",
    name: "Media Archive 50 GB",
    capacityGb: 50,
    monthlyPrice: 50,
    priceId: "price_1UGgwyIrIlUINMylAcTu9fqv",
    tagline: "適合保存較長期的產品圖、活動照片與客戶交付。",
  },
  archive_200: {
    key: "archive_200",
    name: "Media Archive 200 GB",
    capacityGb: 200,
    monthlyPrice: 150,
    priceId: "price_1UGgx8IrIlUINMylFisUc37Y",
    tagline: "適合持續累積相片的日常商業工作流程。",
  },
  archive_1000: {
    key: "archive_1000",
    name: "Media Archive 1 TB",
    capacityGb: 1000,
    monthlyPrice: 640,
    priceId: "price_1UGgxHIrIlUINMylpVDeoM2J",
    tagline: "適合多專案、多店舖或長期保留的大量素材。",
  },
} as const;

export type StorageAddOnKey = keyof typeof STORAGE_ADD_ONS;

export function getStorageAddOnForStripePrice(priceId: string | null | undefined) {
  return Object.values(STORAGE_ADD_ONS).find((addOn) => addOn.priceId === priceId) ?? null;
}

export function isStorageAddOnKey(value: string): value is StorageAddOnKey {
  return value in STORAGE_ADD_ONS;
}

export function bytesFromGigabytes(gigabytes: number) {
  return gigabytes * 1024 * 1024 * 1024;
}

export function storageAllowanceBytes(plan: AccountPlan, addOnGb: number) {
  return bytesFromGigabytes(ACCOUNT_PLANS[plan].includedStorageGb + Math.max(0, addOnGb));
}

export function formatStorageBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const gigabytes = bytes / (1024 * 1024 * 1024);
  if (gigabytes >= 1) return `${Number(gigabytes.toFixed(gigabytes >= 10 ? 1 : 2))} GB`;
  return `${Math.max(1, Math.ceil(bytes / (1024 * 1024)))} MB`;
}
