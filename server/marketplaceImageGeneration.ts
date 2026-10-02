import { generateImage, type GenerateImageOptions, type GenerateImageResponse } from "./_core/imageGeneration";

const PRIMARY_MODEL = "MODEL_GPT_IMAGE_2";
const FALLBACK_MODEL = "MODEL_GEMINI_2_5_FLASH_IMAGE_PREVIEW";

export class MarketplaceImageGenerationError extends Error {
  constructor(
    readonly primaryError: unknown,
    readonly fallbackError: unknown,
  ) {
    super("Both marketplace image generation models failed");
    this.name = "MarketplaceImageGenerationError";
  }
}

function ensureImageUrl(result: GenerateImageResponse, model: string) {
  if (!result.url) throw new Error(`${model} returned no marketplace image URL`);
  return result;
}

function asSafeDiagnostic(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = message.match(/\((\d{3})\b/)?.[1];
  if (status) return `upstream_${status}`;
  if (/timed?\s*out/i.test(message)) return "timeout";
  if (/storage|signed url|presign/i.test(message)) return "reference_access";
  if (/policy|safety|moderation/i.test(message)) return "content_policy";
  return "generation_failed";
}

/**
 * Generates a marketplace asset with GPT Image 2, then retries once with Gemini
 * only when the first provider fails. Callers keep all input references unchanged
 * so product truth and marketplace prompt guardrails stay identical.
 */
export async function generateMarketplaceImage(options: Omit<GenerateImageOptions, "model" | "quality">) {
  try {
    const image = ensureImageUrl(await generateImage({ ...options, model: PRIMARY_MODEL, quality: "medium" }), PRIMARY_MODEL);
    return { ...image, model: PRIMARY_MODEL, usedFallback: false as const };
  } catch (primaryError) {
    console.warn("[iwantphoto marketplace] primary image model failed; trying fallback", {
      diagnostic: asSafeDiagnostic(primaryError),
    });
    try {
      const image = ensureImageUrl(await generateImage({ ...options, model: FALLBACK_MODEL }), FALLBACK_MODEL);
      return { ...image, model: FALLBACK_MODEL, usedFallback: true as const };
    } catch (fallbackError) {
      throw new MarketplaceImageGenerationError(primaryError, fallbackError);
    }
  }
}

/** Safe, non-sensitive reason used for server logs and merchant-facing recovery copy. */
export function getMarketplaceImageGenerationDiagnostic(error: unknown) {
  if (error instanceof MarketplaceImageGenerationError) {
    return {
      primary: asSafeDiagnostic(error.primaryError),
      fallback: asSafeDiagnostic(error.fallbackError),
    };
  }
  return { primary: asSafeDiagnostic(error), fallback: null };
}

export function getMarketplaceImageRecoveryMessage(error: unknown) {
  const diagnostic = getMarketplaceImageGenerationDiagnostic(error);
  if (diagnostic.primary === "content_policy" || diagnostic.fallback === "content_policy") {
    return "這張參考相片暫時未能由影像服務處理。請改用清晰的實物產品相片後再試。";
  }
  if (diagnostic.primary === "reference_access" || diagnostic.fallback === "reference_access") {
    return "產品參考相片暫時未能讀取。請重新上載原始產品相片後再試。";
  }
  return "AI 暫時未能完成此張圖片；未完成圖片不會扣除額度。請稍後再試。";
}
