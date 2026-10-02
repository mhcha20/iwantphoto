import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { GOOGLE_MERCHANT_DIGITAL_SOURCE_TYPE, buildGoogleMerchantAiXmp, embedGoogleMerchantAiMetadata, fetchGeneratedImageBytes } from "./googleMerchantMetadata";

describe("Google Merchant Center AI image metadata", () => {
  it("builds an IPTC Extension XMP packet with the trained AI source type", () => {
    const xmp = buildGoogleMerchantAiXmp();

    expect(xmp).toContain("Iptc4xmpExt:DigitalSourceType");
    expect(xmp).toContain(GOOGLE_MERCHANT_DIGITAL_SOURCE_TYPE);
    expect(xmp).toContain("trainedAlgorithmicMedia");
  });

  it("encodes a Google export as PNG with readable IPTC DigitalSourceType metadata", async () => {
    const generatedImage = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 240, g: 240, b: 240 } },
    }).png().toBuffer();

    const taggedImage = await embedGoogleMerchantAiMetadata(generatedImage);
    const metadata = await sharp(taggedImage.buffer).metadata();

    expect(taggedImage.mimeType).toBe("image/png");
    expect(taggedImage.byteSize).toBe(taggedImage.buffer.length);
    expect(taggedImage.digitalSourceType).toBe(GOOGLE_MERCHANT_DIGITAL_SOURCE_TYPE);
    expect(metadata.format).toBe("png");
    expect(metadata.xmpAsString).toContain("Iptc4xmpExt:DigitalSourceType");
    expect(metadata.xmpAsString).toContain(GOOGLE_MERCHANT_DIGITAL_SOURCE_TYPE);
  });

  it("returns a recoverable error rather than a raw URL parsing exception for invalid app configuration", async () => {
    await expect(fetchGeneratedImageBytes("/manus-storage/generated/output.png", "iwantphoto.com"))
      .rejects.toThrow("Generated image is temporarily unavailable for Google export");
  });
});
