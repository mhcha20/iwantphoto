// S3-compatible object storage (Railway Bucket, R2, B2, MinIO, AWS S3).
// Stored URLs stay `/manus-storage/{key}` so existing database rows keep working;
// the proxy in _core/storageProxy.ts redirects them to short-lived signed URLs.

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

const FALLBACK_APP_BASE_URL = "https://iwantphoto.com";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function getSafeAbsoluteUrl(value: string, purpose: "app base"): URL {
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

let cachedClient: S3Client | undefined;

function getS3() {
  if (!ENV.s3Bucket || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey) {
    throw new Error("Storage config missing: set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
  }
  cachedClient ??= new S3Client({
    region: ENV.s3Region,
    ...(ENV.s3Endpoint ? { endpoint: ENV.s3Endpoint } : {}),
    // Railway/R2/MinIO style endpoints are not virtual-host addressable.
    forcePathStyle: Boolean(ENV.s3Endpoint),
    credentials: { accessKeyId: ENV.s3AccessKeyId, secretAccessKey: ENV.s3SecretAccessKey },
  });
  return { client: cachedClient, bucket: ENV.s3Bucket };
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
  const { client, bucket } = getS3();
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : data;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { client, bucket } = getS3();
  const key = normalizeKey(relKey);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: SIGNED_URL_TTL_SECONDS });
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

/** Reads an S3 object's Content-Length with a HEAD request. */
export async function storageGetByteSize(relKey: string): Promise<number> {
  const { client, bucket } = getS3();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: normalizeKey(relKey) }));
  const byteSize = Number(head.ContentLength);
  if (!Number.isSafeInteger(byteSize) || byteSize < 0) throw new Error("Storage object returned no valid Content-Length");
  return byteSize;
}
