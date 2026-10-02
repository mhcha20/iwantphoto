import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateImage: vi.fn() }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.generateImage }));

import { generateMarketplaceImage, getMarketplaceImageGenerationDiagnostic, getMarketplaceImageRecoveryMessage, MarketplaceImageGenerationError } from "./marketplaceImageGeneration";

describe("marketplace image generation resilience", () => {
  const request = { prompt: "preserve the product", originalImages: [{ url: "https://signed.example/source.png", mimeType: "image/png" }] };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses GPT Image 2 when the primary model succeeds", async () => {
    mocks.generateImage.mockResolvedValueOnce({ url: "/manus-storage/generated/primary.png", byteSize: 123 });

    await expect(generateMarketplaceImage(request)).resolves.toMatchObject({ url: "/manus-storage/generated/primary.png", model: "MODEL_GPT_IMAGE_2", usedFallback: false });
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({ model: "MODEL_GPT_IMAGE_2", quality: "medium" }));
  });

  it("retries the same reference with the fallback model after a primary failure", async () => {
    mocks.generateImage.mockRejectedValueOnce(new Error("Image generation request failed (503 Service Unavailable)"));
    mocks.generateImage.mockResolvedValueOnce({ url: "/manus-storage/generated/fallback.png", byteSize: 456 });

    await expect(generateMarketplaceImage(request)).resolves.toMatchObject({ url: "/manus-storage/generated/fallback.png", model: "MODEL_GEMINI_2_5_FLASH_IMAGE_PREVIEW", usedFallback: true });
    expect(mocks.generateImage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      model: "MODEL_GEMINI_2_5_FLASH_IMAGE_PREVIEW",
      originalImages: request.originalImages,
    }));
  });

  it("provides a safe recovery message after both models fail", async () => {
    mocks.generateImage.mockRejectedValueOnce(new Error("Image generation request failed (503 Service Unavailable)"));
    mocks.generateImage.mockRejectedValueOnce(new Error("Image generation request failed (429 Too Many Requests)"));

    await expect(generateMarketplaceImage(request)).rejects.toBeInstanceOf(MarketplaceImageGenerationError);
    const error = new MarketplaceImageGenerationError(new Error("Image generation request failed (503 Service Unavailable)"), new Error("Image generation request failed (429 Too Many Requests)"));
    expect(getMarketplaceImageGenerationDiagnostic(error)).toEqual({ primary: "upstream_503", fallback: "upstream_429" });
    expect(getMarketplaceImageRecoveryMessage(error)).toContain("未完成圖片不會扣除額度");
  });
});
