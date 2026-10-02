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
