import { describe, expect, it } from "vitest";
import { getMarketplaceProjectQuickCreateState } from "./marketplaceProjectQuickCreate";

describe("marketplace inline project creation", () => {
  it("enables a manual creation action only for a valid normalized name while retaining optional client context", () => {
    expect(getMarketplaceProjectQuickCreateState({ name: "  秋季   新品上架 ", clientName: "  Juno   Store ", description: "  日系   秋裝  " })).toEqual({
      name: "秋季 新品上架",
      clientName: "Juno Store",
      description: "日系 秋裝",
      canCreate: true,
    });
    expect(getMarketplaceProjectQuickCreateState({ name: "   " })).toMatchObject({ name: "", clientName: null, description: null, canCreate: false });
  });
});
