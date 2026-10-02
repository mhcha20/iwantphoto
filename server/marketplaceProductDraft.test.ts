import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

import { draftMarketplaceProductBrief } from "./marketplaceProductDraft";

describe("AI marketplace product brief drafting", () => {
  it("returns a compact editable draft from a fenced JSON response and keeps uncertain facts as questions", async () => {
    const payload = {
      brief: {
        productName: "透明收納盒",
        summary: "透明盒身配有深色扣件。",
        weight: "680 g",
        dimensions: "18 × 13 × 7 cm",
        confirmedFacts: ["透明盒身", "深色扣件"],
        visualHighlights: ["可見扣件設計"],
        usageIdeas: ["家居收納情境"],
        reviewQuestions: ["請確認是否包含多個尺寸或不同容量。"],
      },
      lifestyleRecommendation: {
        style: "home",
        reason: "產品可見收納用途，適合家居收納位置。",
        candidates: [
          { id: "home-shelf", style: "home", title: "家居收納架", description: "整理好的層架與柔和自然光。" },
          { id: "home-counter", style: "home", title: "家居檯面", description: "有櫃體深度的日常檯面。" },
        ],
        avoidStyles: ["outdoor"],
        avoidanceReason: "相片未有戶外使用資料。",
      },
    };
    mocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\`` } }],
    });

    const tinyPng = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 240, g: 240, b: 240 } },
    }).png().toBuffer();
    const draft = await draftMarketplaceProductBrief({ references: [
      { buffer: tinyPng, mimeType: "image/png" },
      { buffer: tinyPng, mimeType: "image/png" },
    ] });

    expect(draft).toMatchObject({
      brief: {
        productName: "透明收納盒",
        weight: "680 g",
        dimensions: "18 × 13 × 7 cm",
        confirmedFacts: ["透明盒身", "深色扣件"],
        reviewQuestions: ["請確認是否包含多個尺寸或不同容量。"],
      },
      lifestyleRecommendation: {
        style: "home",
        reason: "產品可見收納用途，適合家居收納位置。",
        candidates: expect.arrayContaining([expect.objectContaining({ id: "home-shelf", title: "家居收納架" })]),
        avoidStyles: ["outdoor"],
      },
    });
    expect(mocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-3-flash-preview",
      max_tokens: 4096,
      response_format: expect.objectContaining({ type: "json_schema" }),
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "user", content: expect.arrayContaining([expect.objectContaining({ type: "image_url" })]) }),
      ]),
    }));
    const request = mocks.invokeLLM.mock.calls[0]?.[0];
    expect(request?.response_format?.json_schema?.schema.properties.lifestyleRecommendation.properties.candidates.minItems).toBe(2);
    expect(request?.response_format?.json_schema?.schema.properties.lifestyleRecommendation.properties.candidates.maxItems).toBe(3);
    expect(request?.response_format?.json_schema?.schema.properties.brief.required).toEqual(expect.arrayContaining(["weight", "dimensions"]));
    expect(request?.messages?.[0]?.content).toContain("Never estimate from pixels");
    const userMessage = request?.messages?.find((message: { role: string }) => message.role === "user");
    expect(userMessage?.content.filter((part: { type: string }) => part.type === "image_url")).toHaveLength(2);
  });

  it("includes the merchant revision request while keeping unsupported product facts guarded", async () => {
    const payload = {
      brief: {
        productName: "維生素 D3 膳食補充劑",
        summary: "深棕色瓶身配有綠色瓶蓋。",
        confirmedFacts: ["深棕色瓶身", "綠色瓶蓋"],
        visualHighlights: ["正面可見雙語標籤"],
        usageIdeas: [],
        reviewQuestions: ["請確認每瓶實際錠數。"],
      },
      lifestyleRecommendation: { style: "auto", reason: "未有足夠資料支持指定使用場景。" },
    };
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(payload) } }] });
    const tinyPng = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 240, g: 240, b: 240 } } }).png().toBuffer();

    await draftMarketplaceProductBrief({
      references: [{ buffer: tinyPng, mimeType: "image/png" }],
      currentBrief: { ...payload.brief, reviewQuestions: [] },
      revisionInstruction: "名稱改得較簡潔，並刪除未能確認的健康功效。",
    });

    const request = mocks.invokeLLM.mock.calls.at(-1)?.[0];
    const userMessage = request?.messages?.find((message: { role: string }) => message.role === "user");
    const promptText = userMessage?.content.find((part: { type: string }) => part.type === "text")?.text as string;
    expect(promptText).toContain("名稱改得較簡潔");
    expect(promptText).toContain("Current name: 維生素 D3 膳食補充劑");
    expect(promptText).toContain("unsupported requested facts into reviewQuestions");
  });

  it("allows an explicit cross-border translation request without relaxing evidence safeguards", async () => {
    const payload = {
      brief: {
        productName: "Vitamin D3 Supplement",
        summary: "A dark brown bottle with a green cap.",
        confirmedFacts: ["Dark brown bottle"],
        visualHighlights: ["Bilingual label visible"],
        usageIdeas: [],
        reviewQuestions: ["Confirm the tablet count per bottle."],
      },
      lifestyleRecommendation: { style: "auto", reason: "Use context is not visible." },
    };
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(payload) } }] });
    const tinyPng = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 240, g: 240, b: 240 } } }).png().toBuffer();

    await draftMarketplaceProductBrief({
      references: [{ buffer: tinyPng, mimeType: "image/png" }],
      revisionInstruction: "請把產品名稱、描述及待核對事項全部翻譯成日文。",
    });

    const request = mocks.invokeLLM.mock.calls.at(-1)?.[0];
    expect(request?.messages?.[0]?.content).toContain("English, Simplified Chinese, Japanese, or Thai");
    const userMessage = request?.messages?.find((message: { role: string }) => message.role === "user");
    const promptText = userMessage?.content.find((part: { type: string }) => part.type === "text")?.text as string;
    expect(promptText).toContain("翻譯成日文");
    expect(request?.response_format?.json_schema?.schema).toBeDefined();
  });

  it("falls back to Automatic when a model response contains an invalid scene recommendation", async () => {
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      brief: { productName: "玻璃容器", summary: "透明容器。", confirmedFacts: ["透明"], visualHighlights: [], usageIdeas: [], reviewQuestions: [] },
      lifestyleRecommendation: { style: "showroom", reason: 42 },
    }) } }] });
    const tinyPng = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 240, g: 240, b: 240 } } }).png().toBuffer();

    const draft = await draftMarketplaceProductBrief({ references: [{ buffer: tinyPng, mimeType: "image/png" }] });

    expect(draft.lifestyleRecommendation).toMatchObject({
      style: "auto",
      reason: "根據目前相片與已確認用途，建議先以自動情境生成。",
      avoidStyles: [],
      candidates: [
        { id: "auto-natural-interior", style: "auto" },
        { id: "auto-textured-surface", style: "auto" },
      ],
    });
  });
});
