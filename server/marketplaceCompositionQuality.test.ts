import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

import { assessMarketplaceComposition, assessMarketplaceLifestyleScene, inspectMarketplaceCompositionFromUrl } from "./marketplaceCompositionQuality";

async function makeImage(input: { background: string; foreground?: string; inset?: number }) {
  const width = 256;
  const height = 256;
  const inset = input.inset ?? 62;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${input.background}"/>${input.foreground ? `<rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" rx="20" fill="${input.foreground}"/>` : ""}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("marketplace composition quality", () => {
  it("asks for a new lifestyle scene when the result is nearly a white catalog shot", async () => {
    const assessment = await assessMarketplaceComposition({
      role: "lifestyle",
      imageBuffer: await makeImage({ background: "#ffffff", foreground: "#6a4a30", inset: 92 }),
    });

    expect(assessment.shouldRetry).toBe(true);
    expect(assessment.whiteRatio).toBeGreaterThan(0.84);
    expect(assessment.warning).toContain("情境圖");
    expect(assessment.correction).toContain("real-world non-studio setting");
  });

  it("rejects a light-neutral lifestyle backdrop even when a large product lowers the overall white ratio", async () => {
    const assessment = await assessMarketplaceComposition({
      role: "lifestyle",
      lifestyleStyle: "outdoor",
      imageBuffer: await makeImage({ background: "#F2F0EB", foreground: "#6A4A30", inset: 54 }),
    });

    expect(assessment.whiteRatio).toBeGreaterThan(0.6);
    expect(assessment.edgeWhiteRatio).toBeGreaterThan(0.82);
    expect(assessment.shouldRetry).toBe(true);
    expect(assessment.correction).toContain("merchant explicitly selected Outdoor");
    expect(assessment.correction).toContain("literal outdoor natural-daylight setting");
  });

  it("allows a scene with an environment that differs from a catalog shot", async () => {
    const assessment = await assessMarketplaceComposition({
      role: "lifestyle",
      imageBuffer: await makeImage({ background: "#426148", foreground: "#d8a762", inset: 76 }),
    });

    expect(assessment.shouldRetry).toBe(false);
    expect(assessment.whiteRatio).toBeLessThan(0.1);
  });

  it("asks for a new supplementary composition when it duplicates another generated output", async () => {
    const imageBuffer = await makeImage({ background: "#546f99", foreground: "#d8a762" });
    const first = await assessMarketplaceComposition({ role: "studio", imageBuffer });
    const repeat = await assessMarketplaceComposition({
      role: "studio",
      imageBuffer,
      priorSignatures: [first.signature],
    });

    expect(repeat.shouldRetry).toBe(true);
    expect(repeat.warning).toContain("過於相似");
    expect(repeat.correction).toContain("three-quarter camera angle");
  });

  it("checks that a lifestyle image visibly matches the selected setting", async () => {
    mocks.invokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        sceneClearlyVisible: true,
        matchesSelectedStyle: false,
        looksLikeStudioOrIsolatedProduct: false,
        conciseReason: "Visible living-room setting, not an office workspace.",
      }) } }],
    });

    const assessment = await assessMarketplaceLifestyleScene({
      imageBuffer: await makeImage({ background: "#47685C", foreground: "#D8A762" }),
      lifestyleStyle: "office",
    });

    expect(assessment).toMatchObject({ sceneClearlyVisible: true, matchesSelectedStyle: false });
    expect(mocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5-mini",
      response_format: expect.objectContaining({ type: "json_schema" }),
    }));
  });

  it("requests a free retry when visual inspection finds the wrong selected scene", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(await makeImage({ background: "#47685C", foreground: "#D8A762" }))));
    mocks.invokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        sceneClearlyVisible: true,
        matchesSelectedStyle: false,
        looksLikeStudioOrIsolatedProduct: false,
        conciseReason: "The visible setting looks domestic rather than professional.",
      }) } }],
    });

    const assessment = await inspectMarketplaceCompositionFromUrl({
      imageUrl: "https://example.test/scene.png",
      role: "lifestyle",
      lifestyleStyle: "office",
    });

    expect(assessment).toMatchObject({ shouldRetry: true });
    expect(assessment?.warning).toContain("未能清楚呈現");
    expect(assessment?.correction).toContain("explicitly selected Office");
    vi.unstubAllGlobals();
  });

  it("fails open when the optional semantic checker is unavailable", async () => {
    mocks.invokeLLM.mockRejectedValueOnce(new Error("vision provider unavailable"));

    await expect(assessMarketplaceLifestyleScene({
      imageBuffer: await makeImage({ background: "#47685C", foreground: "#D8A762" }),
      lifestyleStyle: "home",
    })).resolves.toBeUndefined();
  });
});
