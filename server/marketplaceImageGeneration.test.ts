import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateImage: vi.fn() }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.generateImage }));

import { ENV } from "./_core/env";
import { generateMarketplaceImage, getMarketplaceImageGenerationDiagnostic, getMarketplaceImageRecoveryMessage, MarketplaceImageGenerationError } from "./marketplaceImageGeneration";

describe("marketplace image generation resilience", () => {
  const request = { prompt: "preserve the product", originalImages: [{ url: "https://signed.example/source.png", mimeType: "image/png" }] };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the primary OpenRouter image model when the primary model succeeds", async () => {
    mocks.generateImage.mockResolvedValueOnce({ url: "/manus-storage/generated/primary.png", byteSize: 123 });

    await expect(generateMarketplaceImage(request)).resolves.toMatchObject({ url: "/manus-storage/generated/primary.png", model: ENV.openRouterImageModel, usedFallback: false });
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({ model: ENV.openRouterImageModel }));
  });

  it("retries the same reference with the fallback model after a primary failure", async () => {
    mocks.generateImage.mockRejectedValueOnce(new Error("Image generation request failed (503 Service Unavailable)"));
    mocks.generateImage.mockResolvedValueOnce({ url: "/manus-storage/generated/fallback.png", byteSize: 456 });

    await expect(generateMarketplaceImage(request)).resolves.toMatchObject({ url: "/manus-storage/generated/fallback.png", model: ENV.openRouterImageFallbackModel, usedFallback: true });
    expect(mocks.generateImage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      model: ENV.openRouterImageFallbackModel,
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
