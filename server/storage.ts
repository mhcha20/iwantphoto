// Preconfigured storage helpers for Manus WebDev templates
// Uploads via Forge Server presigned URL to S3 (PUT direct).
// Downloads return /manus-storage/{key} paths served via 307 redirect.

import { ENV } from "./_core/env";

const FALLBACK_APP_BASE_URL = "https://iwantphoto.com";

function getSafeAbsoluteUrl(value: string, purpose: "app base" | "Forge endpoint"): URL {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("unsupported protocol");
    return parsed;
  } catch {
    throw new Error(`${purpose} configuration is invalid`);
  }
}

function getSafeAppBaseUrl(): URL {
  try {
    return getSafeAbsoluteUrl(ENV.appBaseUrl, "app base");
  } catch {
    // A deployment setting must never turn a relative managed-storage path into
    // an opaque URL-constructor exception for a customer. Do not log image URLs
    // or user payloads here.
    console.warn("[iwantphoto storage] invalid app base URL configuration; using canonical storage origin");
    return new URL(FALLBACK_APP_BASE_URL);
  }
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  try {
    const parsedForgeUrl = getSafeAbsoluteUrl(forgeUrl, "Forge endpoint");
    return { forgeUrl: parsedForgeUrl.toString().replace(/\/+$/, ""), forgeKey };
  } catch {
    throw new Error("Image storage service is temporarily unavailable");
  }
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));

  // 1. Get presigned PUT URL from Forge
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  try {
    getSafeAbsoluteUrl(s3Url, "Forge endpoint");
  } catch {
    throw new Error("Image storage service returned an invalid upload URL");
  }

  // 2. PUT file directly to S3
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  try {
    getSafeAbsoluteUrl(url, "Forge endpoint");
    return url;
  } catch {
    throw new Error("Image storage service returned an invalid download URL");
  }
}

/** Extracts a project-managed storage key without allowing arbitrary remote URLs. */
export function getManagedStorageKey(storageUrl: string): string | undefined {
  const appBaseUrl = getSafeAppBaseUrl();
  let parsed: URL;
  try {
    parsed = new URL(storageUrl, appBaseUrl);
  } catch {
    console.warn("[iwantphoto storage] rejected malformed managed storage URL");
    return undefined;
  }
  if (/^https?:\/\//i.test(storageUrl) && parsed.origin !== appBaseUrl.origin) return undefined;
  const prefix = "/manus-storage/";
  if (!parsed.pathname.startsWith(prefix)) return undefined;
  let key: string;
  try {
    key = decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    console.warn("[iwantphoto storage] rejected malformed managed storage path encoding");
    return undefined;
  }
  return key && !key.includes("..") ? key : undefined;
}

/** Reads an S3 object's Content-Length through a short-lived project-signed URL. */
export async function storageGetByteSize(relKey: string): Promise<number> {
  const signedUrl = await storageGetSignedUrl(relKey);
  // A signed GET URL is portable across S3-compatible providers. Requesting
  // one byte avoids downloading an entire legacy asset just to read its size.
  const response = await fetch(signedUrl, { headers: { Range: "bytes=0-0" } });
  if (!response.ok) throw new Error(`Storage size lookup failed (${response.status})`);
  const contentRange = response.headers.get("content-range");
  const rangeSize = contentRange?.match(/\/(\d+)$/)?.[1];
  const byteSize = Number(rangeSize ?? response.headers.get("content-length"));
  if (!Number.isSafeInteger(byteSize) || byteSize < 0) throw new Error("Storage object returned no valid Content-Length");
  return byteSize;
}
