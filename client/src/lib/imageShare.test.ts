import { describe, expect, it, vi } from "vitest";
import { canUseNativeFileShare, createOutputFileName, imageUrlToShareFile } from "./imageShare";

describe("image sharing helpers", () => {
  it("creates safe output names while preserving Chinese filenames", () => {
    expect(createOutputFileName("產品 主圖.heic", "image/png")).toBe("iwantphoto-產品-主圖.png");
    expect(createOutputFileName("", "image/jpeg")).toBe("iwantphoto-iwantphoto-image.jpg");
  });

  it("converts an image URL into a file for native sharing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    } as Response);

    const file = await imageUrlToShareFile("/manus-storage/result.png", "tribute photo.jpg");

    expect(fetchMock).toHaveBeenCalledWith("/manus-storage/result.png");
    expect(file.name).toBe("iwantphoto-tribute-photo.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBe(11);
    fetchMock.mockRestore();
  });

  it("checks whether the browser can share one or many image files directly", () => {
    const first = new File(["x"], "first.png", { type: "image/png" });
    const second = new File(["y"], "second.png", { type: "image/png" });
    const navigatorLike = {
      share: vi.fn(),
      canShare: vi.fn().mockReturnValue(true),
    } as unknown as Pick<Navigator, "share" | "canShare">;

    expect(canUseNativeFileShare([first, second], navigatorLike)).toBe(true);
    expect(navigatorLike.canShare).toHaveBeenCalledWith({ files: [first, second] });
  });

  it("falls back when the browser cannot share image files", () => {
    const image = new File(["x"], "product.png", { type: "image/png" });
    const navigatorLike = {
      share: vi.fn(),
      canShare: vi.fn().mockReturnValue(false),
    } as unknown as Pick<Navigator, "share" | "canShare">;

    expect(canUseNativeFileShare(image, navigatorLike)).toBe(false);
    expect(canUseNativeFileShare(image, undefined)).toBe(false);
  });

  it("accepts the complete four-image marketplace set for one native share sheet", () => {
    const files = ["main", "studio", "detail", "lifestyle"].map((role) => new File([role], `product-${role}.png`, { type: "image/png" }));
    const navigatorLike = {
      share: vi.fn(),
      canShare: vi.fn().mockReturnValue(true),
    } as unknown as Pick<Navigator, "share" | "canShare">;

    expect(canUseNativeFileShare(files, navigatorLike)).toBe(true);
    expect(navigatorLike.canShare).toHaveBeenCalledWith({ files });
  });
});
