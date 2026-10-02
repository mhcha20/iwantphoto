import { describe, expect, it } from "vitest";
import { normaliseMarketplaceWorkflowName, normaliseMarketplaceWorkflowSettings, parseMarketplaceWorkflowRoles } from "./marketplaceWorkflows";

describe("marketplace workflow templates", () => {
  it("normalises reusable settings without storing product material", () => {
    expect(normaliseMarketplaceWorkflowSettings({
      channel: "shopee",
      selectedRoles: ["main", "lifestyle"],
      lifestyleStyle: "home",
      projectId: 7,
      brandPresetId: 4,
      useCustomBrandStyle: false,
      brandStyle: { accentColor: "#2f7a63", fontStyle: "friendly" },
    })).toEqual({
      channel: "shopee",
      selectedRoles: ["main", "lifestyle"],
      lifestyleStyle: "home",
      projectId: 7,
      brandPresetId: 4,
      useCustomBrandStyle: false,
      brandStyle: { accentColor: "#2F7A63", fontStyle: "friendly" },
    });
  });

  it("recovers a safe role plan if stored workflow JSON is invalid", () => {
    expect(parseMarketplaceWorkflowRoles("not-json")).toEqual(["main", "studio", "detail", "lifestyle"]);
    expect(parseMarketplaceWorkflowRoles(JSON.stringify(["main", "unknown", "lifestyle"]))).toEqual(["main", "lifestyle"]);
  });

  it("compacts a workflow name before persistence", () => {
    expect(normaliseMarketplaceWorkflowName("  Thailand   home  set ")).toBe("Thailand home set");
  });
});
