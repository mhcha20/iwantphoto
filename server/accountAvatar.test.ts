import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createAccountAvatar, decodeAccountAvatar } from "./accountAvatar";

async function asDataUrl(width: number, height: number) {
  const source = await sharp({ create: { width, height, channels: 3, background: "#176bd2" } }).jpeg().toBuffer();
  return `data:image/jpeg;base64,${source.toString("base64")}`;
}

describe("account avatar normalization", () => {
  it("re-encodes a supported account avatar as bounded WebP while preserving its ratio", async () => {
    const avatar = await createAccountAvatar(await asDataUrl(640, 320), "image/jpeg");
    expect(avatar.mimeType).toBe("image/webp");
    expect(avatar.width).toBe(256);
    expect(avatar.height).toBe(128);
    expect(avatar.buffer.length).toBeGreaterThan(0);
  });

  it("rejects unsupported image MIME types", () => {
    const invalid = `data:image/gif;base64,${Buffer.from("gif").toString("base64")}`;
    expect(() => decodeAccountAvatar(invalid, "image/gif")).toThrow("頭像請使用 PNG、JPG 或 WEBP 檔案。");
  });
});
