/**
 * Image generation / editing through OpenRouter (chat completions with image output).
 *
 * Example:
 *   const { url } = await generateImage({
 *     prompt: "Remove the background",
 *     originalImages: [{ url: signedUrl, mimeType: "image/jpeg" }],
 *   });
 *
 * Reference images are fetched server-side and sent as data URLs so the result
 * does not depend on the upstream provider being able to reach our storage.
 */
import { storagePut } from "../storage";
import { ENV } from "./env";

const IMAGE_FETCH_TIMEOUT_MS = 30_000;
const IMAGE_REQUEST_TIMEOUT_MS = 180_000;

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** OpenRouter model id, e.g. "google/gemini-2.5-flash-image". Defaults to OPENROUTER_IMAGE_MODEL. */
  model?: string;
  /** Kept for call-site compatibility; OpenRouter image models choose their own quality. */
  quality?: string;
};

export type GenerateImageResponse = {
  url?: string;
  byteSize?: number;
  mimeType?: string;
};

async function toDataUrl(image: NonNullable<GenerateImageOptions["originalImages"]>[number]): Promise<string> {
  if (image.b64Json) return `data:${image.mimeType ?? "image/png"};base64,${image.b64Json}`;
  if (!image.url) throw new Error("Reference image has no url or data");
  if (image.url.startsWith("data:")) return image.url;
  const response = await fetch(image.url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Reference image fetch failed (${response.status}) via signed url`);
  const mime = image.mimeType ?? response.headers.get("content-type") ?? "image/png";
  return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
}

type OpenRouterImageResponse = {
  choices?: Array<{
    message?: {
      images?: Array<{ image_url?: { url?: string } }>;
    };
  }>;
  error?: { message?: string };
};

function parseDataUrl(value: string): { buffer: Buffer; mimeType: string } {
  const match = value.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("Image generation returned an unsupported image format");
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!ENV.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  const model = options.model ?? ENV.openRouterImageModel;
  const references = await Promise.all((options.originalImages ?? []).map(toDataUrl));

  const response = await fetch(`${ENV.openRouterBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openRouterApiKey}`,
      "HTTP-Referer": ENV.appBaseUrl,
      "X-Title": "Iwantphoto",
    },
    body: JSON.stringify({
      model,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: options.prompt },
            ...references.map(url => ({ type: "image_url", image_url: { url } })),
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(IMAGE_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail.slice(0, 500)}` : ""}`
    );
  }

  const result = (await response.json()) as OpenRouterImageResponse;
  const dataUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) {
    throw new Error(`Image generation returned no image${result.error?.message ? `: ${result.error.message}` : ""}`);
  }
  const { buffer, mimeType } = parseDataUrl(dataUrl);

  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  const { url } = await storagePut(`generated/${Date.now()}.${extension}`, buffer, mimeType);
  return { url, byteSize: buffer.length, mimeType };
}
