import { describe, expect, it } from "vitest";
import { appendMarketplaceRevisionInstruction, MARKETPLACE_DRAFT_REVISION_SHORTCUTS } from "./marketplaceDraftRevision";

describe("marketplace draft revision shortcuts", () => {
  it("offers the concise, professional, medical-language, and cross-border translation shortcuts", () => {
    expect(MARKETPLACE_DRAFT_REVISION_SHORTCUTS.map((shortcut) => shortcut.label)).toEqual(expect.arrayContaining(["更精簡", "改專業語氣", "移除醫療字眼", "翻譯成英文", "翻譯成簡體中文", "翻譯成日文", "翻譯成泰文"]));
  });

  it("adds a selected shortcut without overwriting the merchant request", () => {
    const shortcut = MARKETPLACE_DRAFT_REVISION_SHORTCUTS[0]?.instruction ?? "";
    expect(appendMarketplaceRevisionInstruction("保留瓶身顏色", shortcut)).toContain("保留瓶身顏色\n");
  });

  it("keeps the revision instruction within its server-side length limit", () => {
    expect(appendMarketplaceRevisionInstruction("x".repeat(499), "更多資料")).toHaveLength(500);
  });
});
