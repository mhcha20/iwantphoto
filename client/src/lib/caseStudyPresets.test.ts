import { describe, expect, it } from "vitest";
import { getCaseStudyPreset } from "./caseStudyPresets";

describe("getCaseStudyPreset", () => {
  it("prepares a white-background workflow for product images", () => {
    expect(getCaseStudyPreset("product")).toMatchObject({
      backgroundStyle: "white",
      label: "產品白底預設",
    });
  });

  it.each(["storefront", "food", "property"] as const)("prepares a cleanup instruction for %s images", (key) => {
    const preset = getCaseStudyPreset(key);
    expect(preset.backgroundStyle).toBe("transparent");
    expect(preset.cleanupNote.length).toBeGreaterThan(12);
  });
});
