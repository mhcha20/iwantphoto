export type MarketplaceWorkspaceStage = "upload" | "review" | "generate" | "result";

export function getMarketplaceWorkspaceStage(input: {
  referenceCount: number;
  hasConfirmedProduct: boolean;
  isGenerating: boolean;
  hasResult: boolean;
}): MarketplaceWorkspaceStage {
  if (input.hasResult) return "result";
  if (input.isGenerating) return "generate";
  if (input.referenceCount === 0) return "upload";
  if (!input.hasConfirmedProduct) return "review";
  return "generate";
}

export function getMarketplaceWorkspaceStepState(stage: MarketplaceWorkspaceStage, step: "upload" | "review" | "generate") {
  const order = { upload: 0, review: 1, generate: 2, result: 3 } as const;
  const stepOrder = order[step];
  const currentOrder = order[stage];
  if (currentOrder > stepOrder) return "complete" as const;
  if (currentOrder === stepOrder) return "current" as const;
  return "upcoming" as const;
}
