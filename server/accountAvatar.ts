import sharp from "sharp";
import { TRPCError } from "@trpc/server";

export const MAX_ACCOUNT_AVATAR_BYTES = 2 * 1024 * 1024;
export const ACCOUNT_AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function decodeAccountAvatar(dataUrl: string, declaredMimeType: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "頭像格式不正確，請重新選擇檔案。" });
  const mimeType = match[1] || declaredMimeType;
  if (!ACCOUNT_AVATAR_MIME_TYPES.includes(mimeType as typeof ACCOUNT_AVATAR_MIME_TYPES[number])) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "頭像請使用 PNG、JPG 或 WEBP 檔案。" });
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_ACCOUNT_AVATAR_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "頭像必須小於 2 MB。" });
  }
  return buffer;
}

export async function createAccountAvatar(dataUrl: string, declaredMimeType: string) {
  const source = decodeAccountAvatar(dataUrl, declaredMimeType);
  try {
    const output = await sharp(source, { failOn: "error" })
      .rotate()
      .resize({ width: 256, height: 256, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
    const metadata = await sharp(output).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Avatar dimensions unavailable");
    return { buffer: output, mimeType: "image/webp" as const, width: metadata.width, height: metadata.height };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_REQUEST", message: "未能讀取頭像，請改用另一張 PNG、JPG 或 WEBP 圖片。" });
  }
}
