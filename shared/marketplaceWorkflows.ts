import {
  DEFAULT_MARKETPLACE_BRAND_STYLE,
  MARKETPLACE_LIFESTYLE_STYLES,
  getMarketplaceSuiteSelection,
  isMarketplaceChannel,
  normaliseMarketplaceBrandStyle,
  type MarketplaceBrandStyle,
  type MarketplaceChannel,
  type MarketplaceImageRole,
  type MarketplaceLifestyleStyle,
} from "./marketplaceSuites";

export const MARKETPLACE_WORKFLOW_NAME_MAX_LENGTH = 60;

export type MarketplaceWorkflowSettings = {
  channel: MarketplaceChannel;
  selectedRoles: MarketplaceImageRole[];
  lifestyleStyle: MarketplaceLifestyleStyle;
  projectId: number | null;
  brandPresetId: number | null;
  useCustomBrandStyle: boolean;
  brandStyle: MarketplaceBrandStyle;
};

export type MarketplaceWorkflow = MarketplaceWorkflowSettings & {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export function normaliseMarketplaceWorkflowName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normaliseMarketplaceWorkflowSettings(input: Partial<MarketplaceWorkflowSettings>): MarketplaceWorkflowSettings {
  const selectedRoles = getMarketplaceSuiteSelection(input.selectedRoles);
  return {
    channel: input.channel && isMarketplaceChannel(input.channel) ? input.channel : "amazon",
    selectedRoles,
    lifestyleStyle: input.lifestyleStyle && input.lifestyleStyle in MARKETPLACE_LIFESTYLE_STYLES ? input.lifestyleStyle : "auto",
    projectId: typeof input.projectId === "number" && input.projectId > 0 ? input.projectId : null,
    brandPresetId: typeof input.brandPresetId === "number" && input.brandPresetId > 0 ? input.brandPresetId : null,
    useCustomBrandStyle: Boolean(input.useCustomBrandStyle),
    brandStyle: normaliseMarketplaceBrandStyle(input.brandStyle ?? DEFAULT_MARKETPLACE_BRAND_STYLE),
  };
}

export function parseMarketplaceWorkflowRoles(value: string): MarketplaceImageRole[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? getMarketplaceSuiteSelection(parsed.filter((role): role is MarketplaceImageRole => ["main", "studio", "detail", "lifestyle"].includes(role))) : getMarketplaceSuiteSelection();
  } catch {
    return getMarketplaceSuiteSelection();
  }
}
