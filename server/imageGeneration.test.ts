import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ storagePut: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

import { ENV } from "./_core/env";
import { generateImage } from "./_core/imageGeneration";

const PNG_B64 = Buffer.from("fake-png-bytes").toString("base64");

describe("OpenRouter image generation", () => {
  const originalKey = ENV.openRouterApiKey;
  beforeEach(() => {
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
    const original = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#c9b79c" } })
      .composite([{ input: await sharp({ create: { width: 90, height: 100, channels: 3, background: "#2b6cb0" } }).png().toBuffer(), left: 105, top: 50 }])
      .png()
      .toBuffer();
    // First answer: an unrelated picture on green. Second answer: the subject where it belongs.
    const unrelated = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#8fbc78" } })
      .composite([{ input: await sharp({ create: { width: 20, height: 180, channels: 3, background: "#ff00ff" } }).png().toBuffer(), left: 10, top: 10 }])
      .png()
      .toBuffer();
    const good = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#8fbc78" } })
      .composite([{ input: await sharp({ create: { width: 90, height: 100, channels: 3, background: "#2b6cb0" } }).png().toBuffer(), left: 105, top: 50 }])
      .png()
      .toBuffer();
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
