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
