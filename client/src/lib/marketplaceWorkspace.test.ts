import { describe, expect, it } from "vitest";
import { getMarketplaceWorkspaceStage, getMarketplaceWorkspaceStepState } from "./marketplaceWorkspace";

describe("marketplace focused workspace", () => {
  it("keeps a new product in the shortest useful step", () => {
    expect(getMarketplaceWorkspaceStage({ referenceCount: 0, hasConfirmedProduct: false, isGenerating: false, hasResult: false })).toBe("upload");
    expect(getMarketplaceWorkspaceStage({ referenceCount: 1, hasConfirmedProduct: false, isGenerating: false, hasResult: false })).toBe("review");
    expect(getMarketplaceWorkspaceStage({ referenceCount: 1, hasConfirmedProduct: true, isGenerating: false, hasResult: false })).toBe("generate");
  });

  it("keeps generation and results visibly ahead of optional editing", () => {
    expect(getMarketplaceWorkspaceStage({ referenceCount: 1, hasConfirmedProduct: true, isGenerating: true, hasResult: false })).toBe("generate");
    expect(getMarketplaceWorkspaceStage({ referenceCount: 1, hasConfirmedProduct: true, isGenerating: false, hasResult: true })).toBe("result");
    expect(getMarketplaceWorkspaceStepState("review", "upload")).toBe("complete");
    expect(getMarketplaceWorkspaceStepState("review", "review")).toBe("current");
    expect(getMarketplaceWorkspaceStepState("review", "generate")).toBe("upcoming");
  });
});
