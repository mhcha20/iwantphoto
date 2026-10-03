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
import { composeCleanup, composeCutout } from "../imageAlignment";
import { fitToReferenceCanvas, keyColorToAlpha, nearestSupportedAspectRatio, readImageSize, toUprightImage, type KeyColor } from "../imagePostProcess";
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
  /**
   * Edit-in-place mode: ask for the first reference's aspect ratio and, after generation,
   * crop/scale the result back to that canvas (never enlarging past the model output).
   */
  matchReferenceCanvas?: boolean;
  /**
   * The prompt asked for a flat key-colour background; convert it to real transparency.
   * Throws when the result does not have a usable key background.
   */
  keyColor?: KeyColor;
  /**
   * Edit the first reference in place. The model's redraw drifts a few percent, so the result is
   * re-aligned to the original: cut-outs keep the original pixels with the model's alpha, clean-ups
   * keep the original everywhere except what the model changed. `selectionIndex` points at a brush mask reference.
   */
  inPlace?:
    | { kind: "cutout"; keyColor: KeyColor; background: "transparent" | "white" }
    | { kind: "cleanup"; selectionIndex?: number };
};

export type GenerateImageResponse = {
  url?: string;
  byteSize?: number;
  mimeType?: string;
};

type ReferenceImage = NonNullable<GenerateImageOptions["originalImages"]>[number];

async function readReference(image: ReferenceImage): Promise<{ bytes: Buffer; mime: string }> {
  if (image.b64Json) return { bytes: Buffer.from(image.b64Json, "base64"), mime: image.mimeType ?? "image/png" };
  if (!image.url) throw new Error("Reference image has no url or data");
  if (image.url.startsWith("data:")) {
    const match = image.url.match(/^data:([^;,]+)[^,]*;base64,([\s\S]+)$/);
    if (!match) throw new Error("Reference image data URL is not base64 encoded");
    return { bytes: Buffer.from(match[2], "base64"), mime: image.mimeType ?? match[1] };
  }
  const response = await fetch(image.url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Reference image fetch failed (${response.status}) via signed url`);
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mime: image.mimeType ?? response.headers.get("content-type") ?? "image/png",
  };
}

async function loadReference(image: ReferenceImage): Promise<{ dataUrl: string; bytes: Buffer }> {
  const { bytes, mime } = await readReference(image);
  // Phone photos carry an EXIF rotation; send upright pixels so the model and the canvas match what the user sees.
  const upright = await toUprightImage(bytes);
  return { dataUrl: `data:${mime};base64,${upright.toString("base64")}`, bytes: upright };
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

export class TransparentCutoutError extends Error {}
/** The model reframed the photo too much to put the edit back on the original; worth one more try. */
export class UnalignedEditError extends Error {}

async function generateImageOnce(options: GenerateImageOptions, finalAttempt = true): Promise<GenerateImageResponse> {
  if (!ENV.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  const model = options.model ?? ENV.openRouterImageModel;
  const references = await Promise.all((options.originalImages ?? []).map(loadReference));
  const referenceSize = (options.matchReferenceCanvas || options.inPlace) && references[0] ? await readImageSize(references[0].bytes) : undefined;

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
      ...(referenceSize && model.startsWith("google/")
        ? { image_config: { aspect_ratio: nearestSupportedAspectRatio(referenceSize) } }
        : {}),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: options.prompt },
            ...references.map(({ dataUrl }) => ({ type: "image_url", image_url: { url: dataUrl } })),
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
  const parsed = parseDataUrl(dataUrl);
  let buffer = parsed.buffer;
  let mimeType = parsed.mimeType;

  if (options.inPlace) {
    const original = references[0]?.bytes;
    if (!original) throw new Error("In-place edit needs the original photo as the first reference");
    const edit = options.inPlace;
    const composed = edit.kind === "cutout"
      ? await composeCutout(original, buffer, edit.keyColor, edit.background)
      : await composeCleanup(original, buffer, edit.selectionIndex === undefined ? undefined : references[edit.selectionIndex]?.bytes);
    if (!composed) throw new TransparentCutoutError("Transparent cut-out failed: no clean key background in the generated image");
    if (!composed.aligned && !finalAttempt) {
      throw new UnalignedEditError(`Model output could not be aligned (score ${composed.alignment?.score?.toFixed(2)})`);
    }
    if (!composed.aligned) {
      console.warn("[iwantphoto edit] model output could not be aligned to the original after retrying; using it as returned", {
        kind: edit.kind,
        score: composed.alignment?.score,
      });
    }
    buffer = composed.buffer;
    mimeType = "image/png";
  } else if (referenceSize || options.keyColor) {
    if (referenceSize) buffer = await fitToReferenceCanvas(buffer, referenceSize);
    if (options.keyColor) {
      const keyed = await keyColorToAlpha(buffer, options.keyColor);
      if (!keyed) throw new TransparentCutoutError("Transparent cut-out failed: no clean key background in the generated image");
      buffer = keyed;
    }
    mimeType = "image/png";
  }

  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  const { url } = await storagePut(`generated/${Date.now()}.${extension}`, buffer, mimeType);
  return { url, byteSize: buffer.length, mimeType };
}

const EDIT_ATTEMPTS = 2;

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!options.keyColor && !options.inPlace) return generateImageOnce(options);
  // Models occasionally ignore the flat-background instruction or reframe the photo heavily;
  // a second try usually fixes it. On the last try an unaligned edit is accepted as returned.
  let lastError: unknown;
  for (let attempt = 0; attempt < EDIT_ATTEMPTS; attempt++) {
    try {
      return await generateImageOnce(options, attempt === EDIT_ATTEMPTS - 1);
    } catch (error) {
      lastError = error;
      if (!(error instanceof TransparentCutoutError) && !(error instanceof UnalignedEditError)) throw error;
      console.warn("[iwantphoto edit] retrying image edit", { attempt: attempt + 1, reason: (error as Error).message });
    }
  }
  throw lastError;
}
