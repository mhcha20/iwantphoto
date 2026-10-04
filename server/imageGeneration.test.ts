import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storagePut: vi.fn(),
  segmentationAvailable: false,
  segmentSubject: vi.fn(),
}));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
// Tests that exercise the model-only path run without a segmentation model, as on a server without it.
vi.mock("./segmentation", () => ({
  isSegmentationAvailable: () => mocks.segmentationAvailable,
  segmentSubject: mocks.segmentSubject,
}));

import { ENV } from "./_core/env";
import { generateImage } from "./_core/imageGeneration";

const PNG_B64 = Buffer.from("fake-png-bytes").toString("base64");

describe("OpenRouter image generation", () => {
  const originalKey = ENV.openRouterApiKey;
  beforeEach(() => {
    mocks.segmentationAvailable = false;
    ENV.openRouterApiKey = "sk-or-test";
    mocks.storagePut.mockResolvedValue({ key: "generated/x.png", url: "/manus-storage/generated/x.png" });
  });
  afterEach(() => {
    ENV.openRouterApiKey = originalKey;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("sends reference images as data URLs and stores the returned image", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.startsWith("https://signed.example/")) {
        return new Response(Buffer.from("source-bytes"), { status: 200, headers: { "content-type": "image/jpeg" } });
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${PNG_B64}` } }] } }] }),
        { status: 200 },
      );
    }));

    const result = await generateImage({
      prompt: "remove the background",
      originalImages: [{ url: "https://signed.example/source.jpg", mimeType: "image/jpeg" }],
      model: "google/gemini-2.5-flash-image",
    });

    const body = JSON.parse(String(calls[1].init?.body));
    expect(calls[1].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(body.model).toBe("google/gemini-2.5-flash-image");
    expect(body.modalities).toEqual(["image", "text"]);
    expect(body.messages[0].content[0]).toEqual({ type: "text", text: "remove the background" });
    expect(body.messages[0].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(new Headers(calls[1].init?.headers).get("authorization")).toBe("Bearer sk-or-test");
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringMatching(/^generated\/\d+\.png$/), expect.any(Buffer), "image/png");
    expect(result).toEqual({ url: "/manus-storage/generated/x.png", byteSize: Buffer.from(PNG_B64, "base64").length, mimeType: "image/png" });
  });

  it("keeps a phone portrait photo portrait: upright reference, 3:4 hint and portrait output", async () => {
    // Stored landscape 400x300 + EXIF orientation 6 = displayed as a 300x400 portrait.
    const portrait = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#888" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    // The model answers with a slightly larger 3:4 image.
    const generated = await sharp({ create: { width: 864, height: 1152, channels: 3, background: "#fff" } }).png().toBuffer();
    let requestBody: any;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${generated.toString("base64")}` } }] } }] }),
        { status: 200 },
      );
    }));

    await generateImage({
      prompt: "remove the background",
      originalImages: [{ b64Json: portrait.toString("base64"), mimeType: "image/jpeg" }],
      model: "google/gemini-2.5-flash-image",
      matchReferenceCanvas: true,
    });

    expect(requestBody.image_config).toEqual({ aspect_ratio: "3:4" });
    const sent = Buffer.from(requestBody.messages[0].content[1].image_url.url.split(",")[1], "base64");
    const sentMeta = await sharp(sent).metadata();
    expect({ width: sentMeta.width, height: sentMeta.height }).toEqual({ width: 300, height: 400 });
    const stored = await sharp(mocks.storagePut.mock.calls[0][1]).metadata();
    expect({ width: stored.width, height: stored.height }).toEqual({ width: 300, height: 400 });
  });

  it("in-place cut-out: stores the original's pixels at the original geometry even when the model drifts", async () => {
    const W = 600, H = 400;
    const box = { x: 210, y: 120, w: 150, h: 170 };
    const draw = (background: string) =>
      sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="${background}"/>
        <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#2b6cb0"/>
        <rect x="${box.x + 15}" y="${box.y + 40}" width="${box.w - 30}" height="20" fill="#f6ad55"/>
        <rect x="${box.x + 15}" y="${box.y + 110}" width="${box.w - 30}" height="20" fill="#e2e8f0"/></svg>`)).png().toBuffer();
    const original = await draw("#c9b79c");
    // The model returns the subject on green, 8% larger and shifted left 4%, at a different resolution.
    const { warpToReference } = await import("./imageAlignment");
    const raw = await sharp(await draw("#8fbc78")).ensureAlpha().raw().toBuffer();
    const drifted = warpToReference({ data: raw, width: W, height: H }, { width: 768, height: 512 }, { scale: 1.08, dx: -0.04, dy: 0 });
    const generated = await sharp(drifted.data, { raw: { width: 768, height: 512, channels: 4 } }).flatten({ background: "#8fbc78" }).png().toBuffer();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${generated.toString("base64")}` } }] } }] }),
      { status: 200 },
    )));

    await generateImage({
      prompt: "cut out the box",
      originalImages: [{ b64Json: original.toString("base64"), mimeType: "image/png" }],
      inPlace: { kind: "cutout", keyColor: "green", background: "transparent" },
    });

    const { data, info } = await sharp(mocks.storagePut.mock.calls[0][1]).raw().toBuffer({ resolveWithObject: true });
    expect({ width: info.width, height: info.height }).toEqual({ width: W, height: H });
    const alphaAt = (x: number, y: number) => data[(y * W + x) * 4 + 3];
    // Opaque exactly where the box is in the ORIGINAL, transparent just outside it.
    expect(alphaAt(box.x + 6, box.y + 6)).toBe(255);
    expect(alphaAt(box.x + box.w - 6, box.y + box.h - 6)).toBe(255);
    expect(alphaAt(box.x - 6, box.y + 50)).toBe(0);
    expect(alphaAt(box.x + box.w + 6, box.y + 50)).toBe(0);
  });

  it("asks the model again when its first edit cannot be aligned to the original", async () => {
    // A textured subject (stripes), as real products are; a flat colour gives nothing to match.
    const subject = (background: string) =>
      sharp(Buffer.from(`<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="${background}"/>
        <rect x="105" y="50" width="90" height="100" fill="#2b6cb0"/>
        <rect x="112" y="65" width="76" height="10" fill="#f6ad55"/><rect x="112" y="95" width="76" height="10" fill="#e2e8f0"/>
        <rect x="112" y="125" width="76" height="10" fill="#fc8181"/></svg>`)).png().toBuffer();
    const original = await subject("#c9b79c");
    // First answer: an unrelated picture on green. Second answer: the subject where it belongs.
    const unrelated = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#8fbc78" } })
      .composite([{ input: await sharp({ create: { width: 20, height: 180, channels: 3, background: "#ff00ff" } }).png().toBuffer(), left: 10, top: 10 }])
      .png()
      .toBuffer();
    const good = await subject("#8fbc78");
    const answers = [unrelated, good];
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${answers.shift()!.toString("base64")}` } }] } }] }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await generateImage({
      prompt: "cut out",
      originalImages: [{ b64Json: original.toString("base64"), mimeType: "image/png" }],
      inPlace: { kind: "cutout", keyColor: "green", background: "transparent" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.storagePut).toHaveBeenCalledTimes(1);
  });

  it("fails (and stores nothing) when no attempt can be aligned, instead of shipping a misplaced edit", async () => {
    const original = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#c9b79c" } })
      .composite([{ input: await sharp({ create: { width: 90, height: 100, channels: 3, background: "#2b6cb0" } }).png().toBuffer(), left: 105, top: 50 }])
      .png()
      .toBuffer();
    const unrelated = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#8fbc78" } })
      .composite([{ input: await sharp({ create: { width: 20, height: 180, channels: 3, background: "#ff00ff" } }).png().toBuffer(), left: 10, top: 10 }])
      .png()
      .toBuffer();
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${unrelated.toString("base64")}` } }] } }] }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { UnalignedEditError } = await import("./_core/imageEditErrors");

    await expect(generateImage({
      prompt: "cut out",
      originalImages: [{ b64Json: original.toString("base64"), mimeType: "image/png" }],
      inPlace: { kind: "cutout", keyColor: "green", background: "transparent" },
    })).rejects.toBeInstanceOf(UnalignedEditError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  describe("segmentation-led cut-out", () => {
    const W = 200, H = 160;
    const box = { x: 60, y: 40, w: 80, h: 90 };
    const photo = () =>
      sharp({ create: { width: W, height: H, channels: 3, background: "#c9b79c" } })
        .composite([{ input: Buffer.from(`<svg width="${box.w}" height="${box.h}" xmlns="http://www.w3.org/2000/svg"><rect width="${box.w}" height="${box.h}" fill="#2b6cb0"/><rect x="8" y="20" width="${box.w - 16}" height="12" fill="#f6ad55"/><rect x="8" y="55" width="${box.w - 16}" height="12" fill="#e2e8f0"/></svg>`), left: box.x, top: box.y }])
        .png()
        .toBuffer();
    /** Segmentation that is sure about the box and (optionally) unsure about a patch to its right. */
    const probability = (unsurePatch: boolean) => {
      const p = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const inBox = x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
        const inPatch = unsurePatch && x >= box.x + box.w && x < box.x + box.w + 30 && y >= box.y + 20 && y < box.y + 60;
        p[y * W + x] = inBox ? 250 : inPatch ? 120 : 3;
      }
      return p;
    };
    const alphaAt = async (x: number, y: number) => {
      const { data } = await sharp(mocks.storagePut.mock.calls[0][1]).raw().toBuffer({ resolveWithObject: true });
      return data[(y * W + x) * 4 + 3];
    };

    beforeEach(() => {
      mocks.segmentationAvailable = true;
    });

    it("trusts a confident segmentation on its own and never calls the image model", async () => {
      const original = await photo();
      mocks.segmentSubject.mockResolvedValue(probability(false));
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await generateImage({
        prompt: "cut out",
        originalImages: [{ b64Json: original.toString("base64"), mimeType: "image/png" }],
        inPlace: { kind: "cutout", keyColor: "green", background: "transparent" },
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(await alphaAt(box.x + 5, box.y + 5)).toBe(255);
      expect(await alphaAt(box.x - 5, box.y + 5)).toBe(0);
    });

    it("asks the image model only about the unsure area and keeps the original pixels", async () => {
      const original = await photo();
      mocks.segmentSubject.mockResolvedValue(probability(true));
      // The model says the unsure patch IS subject: box plus patch, drawn on green, perfectly placed.
      const drawn = await sharp({ create: { width: W, height: H, channels: 3, background: "#8fbc78" } })
        .composite([
          { input: await sharp(original).extract({ left: box.x, top: box.y, width: box.w, height: box.h }).toBuffer(), left: box.x, top: box.y },
          { input: await sharp({ create: { width: 30, height: 40, channels: 3, background: "#7a4b2a" } }).png().toBuffer(), left: box.x + box.w, top: box.y + 20 },
        ])
        .png()
        .toBuffer();
      const fetchMock = vi.fn(async () => new Response(
        JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${drawn.toString("base64")}` } }] } }] }),
        { status: 200 },
      ));
      vi.stubGlobal("fetch", fetchMock);

      await generateImage({
        prompt: "cut out",
        originalImages: [{ b64Json: original.toString("base64"), mimeType: "image/png" }],
        inPlace: { kind: "cutout", keyColor: "green", background: "transparent" },
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await alphaAt(box.x + box.w + 15, box.y + 40)).toBe(255);
      expect(await alphaAt(box.x - 5, box.y + 5)).toBe(0);
    });

    it("still returns the segmentation cut-out when the image model fails", async () => {
      const original = await photo();
      mocks.segmentSubject.mockResolvedValue(probability(true));
      vi.stubGlobal("fetch", vi.fn(async () => new Response("busy", { status: 503, statusText: "Service Unavailable" })));
      vi.spyOn(console, "warn").mockImplementation(() => undefined);

      await generateImage({
        prompt: "cut out",
        originalImages: [{ b64Json: original.toString("base64"), mimeType: "image/png" }],
        inPlace: { kind: "cutout", keyColor: "green", background: "transparent" },
      });

      expect(await alphaAt(box.x + 5, box.y + 5)).toBe(255);
      // The unsure patch falls back to the segmentation's own call (below 50% → background).
      expect(await alphaAt(box.x + box.w + 15, box.y + 40)).toBe(0);
    });
  });

  it("fails clearly when the provider returns no image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 })));
    await expect(generateImage({ prompt: "x" })).rejects.toThrow(/returned no image/);
  });

  it("reports upstream HTTP status so the marketplace fallback can classify it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("busy", { status: 503, statusText: "Service Unavailable" })));
    await expect(generateImage({ prompt: "x" })).rejects.toThrow(/\(503 Service Unavailable\)/);
  });

  it("requires an API key", async () => {
    ENV.openRouterApiKey = "";
    await expect(generateImage({ prompt: "x" })).rejects.toThrow(/OPENROUTER_API_KEY/);
  });
});
