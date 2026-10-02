import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

import { draftMarketplaceListingCopy } from "./marketplaceListingCopy";

describe("marketplace listing copy drafting", () => {
  it("returns five compact verified bullets from a fenced structured response", async () => {
    const payload = {
      title: "透明收納盒",
      bullets: ["透明盒身", "深色扣件", "可見密封蓋", "適合家居收納", "使用前請確認實際組合"],
      reviewNotes: ["請確認實際容量與套裝內容。"],
    };
    mocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\`` } }],
    });

    const copy = await draftMarketplaceListingCopy({
      channel: "amazon",
      productBrief: {
        productName: "透明收納盒",
        summary: "透明盒身配有深色扣件。",
        confirmedFacts: ["透明盒身", "深色扣件"],
        visualHighlights: ["可見密封蓋"],
        usageIdeas: ["家居收納"],
      },
    });

    expect(copy).toMatchObject({ channel: "amazon", title: "透明收納盒" });
    expect(copy.bullets).toHaveLength(5);
    expect(mocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5-mini",
      reasoning: { effort: "minimal" },
      response_format: expect.objectContaining({ type: "json_schema" }),
    }));
    const request = mocks.invokeLLM.mock.calls[0]?.[0];
    const userMessage = request?.messages?.find((message: { role: string }) => message.role === "user");
    expect(userMessage?.content[0]?.text).toContain("Amazon 商品頁");
  });

  it("uses Thai output and Thailand title guidance for Shopee Thailand", async () => {
    const payload = {
      title: "กล่องเก็บของใส",
      bullets: ["กล่องใส", "ตัวล็อกสีเข้ม", "ฝาปิดมองเห็นได้", "เหมาะสำหรับจัดเก็บ", "ตรวจสอบชุดสินค้าจริงก่อนเผยแพร่"],
      reviewNotes: ["โปรดยืนยันความจุและจำนวนในชุด"],
    };
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(payload) } }] });

    const copy = await draftMarketplaceListingCopy({
      channel: "shopee_th",
      productBrief: {
        productName: "กล่องเก็บของใส",
        summary: "กล่องใสพร้อมตัวล็อกสีเข้ม",
        confirmedFacts: ["กล่องใส"],
        visualHighlights: ["ฝาปิดมองเห็นได้"],
        usageIdeas: ["จัดเก็บในบ้าน"],
      },
    });

    expect(copy).toMatchObject({ channel: "shopee_th", title: "กล่องเก็บของใส" });
    const request = mocks.invokeLLM.mock.calls.at(-1)?.[0];
    expect(request?.messages?.[0]?.content).toContain("Respond only in natural, professional Thai");
    expect(request?.messages?.[0]?.content).toContain("120 characters");
  });
});
