import sharp from "sharp";

export const GOOGLE_MERCHANT_DIGITAL_SOURCE_TYPE = "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";

/**
 * Google Merchant Center requires generated images to carry IPTC
 * DigitalSourceType=trainedAlgorithmicMedia. The IPTC Extension XMP property
 * is embedded into a PNG output so that the downloadable and stored asset
 * retains the disclosure independently of the UI.
 */
export function buildGoogleMerchantAiXmp() {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Iwantphoto">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
      Iptc4xmpExt:DigitalSourceType="${GOOGLE_MERCHANT_DIGITAL_SOURCE_TYPE}" />
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export type GoogleMerchantAiImage = {
  buffer: Buffer;
  mimeType: "image/png";
  byteSize: number;
  digitalSourceType: typeof GOOGLE_MERCHANT_DIGITAL_SOURCE_TYPE;
};

/**
 * Re-encodes an AI-generated image as PNG and embeds the required XMP/IPTC
 * disclosure. It intentionally fails closed: callers must not publish an
 * untagged Google Merchant Center asset if source retrieval or encoding fails.
 */
export async function embedGoogleMerchantAiMetadata(source: Buffer): Promise<GoogleMerchantAiImage> {
  if (!source.length) throw new Error("Generated image contains no bytes");

  const buffer = await sharp(source, { failOn: "error" })
    .png()
    .withXmp(buildGoogleMerchantAiXmp())
    .toBuffer();

  if (!buffer.length) throw new Error("Unable to encode Google Merchant Center image");

  return {
    buffer,
    mimeType: "image/png",
    byteSize: buffer.length,
    digitalSourceType: GOOGLE_MERCHANT_DIGITAL_SOURCE_TYPE,
  };
}

export async function fetchGeneratedImageBytes(imageUrl: string, appBaseUrl: string): Promise<Buffer> {
  let url: string;
  try {
    const base = new URL(appBaseUrl);
    if (base.protocol !== "https:" && base.protocol !== "http:") throw new Error("unsupported base protocol");
    const resolved = new URL(imageUrl, base);
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") throw new Error("unsupported image protocol");
    url = resolved.toString();
  } catch {
    // This normally represents a deployment configuration issue. Avoid leaking
    // a raw URL-parser error to merchants through the suite error path.
    throw new Error("Generated image is temporarily unavailable for Google export");
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to retrieve generated image (${response.status})`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("Generated image contains no bytes");
  return buffer;
}

export async function createGoogleMerchantAiImage(input: { imageUrl: string; appBaseUrl: string }): Promise<GoogleMerchantAiImage> {
  const source = await fetchGeneratedImageBytes(input.imageUrl, input.appBaseUrl);
  return embedGoogleMerchantAiMetadata(source);
}
