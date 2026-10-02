import { describe, expect, it } from "vitest";
import { getMarketplaceBrandPreviewCopy, getMarketplaceResultFileName, getMarketplaceRoleRequestPlan, getMarketplaceSuiteCreditCopy, mergeMarketplaceSuiteResult } from "./marketplaceSuite";

describe("marketplace suite interface helpers", () => {
  it("uses a clear four-credit disclosure", () => {
    expect(getMarketplaceSuiteCreditCopy()).toContain("4");
    expect(getMarketplaceSuiteCreditCopy(["main", "detail"])).toContain("2");
  });

  it("creates deterministic output download names", () => {
    expect(getMarketplaceResultFileName("tote-bag.jpg", "lifestyle")).toBe("iwantphoto-tote-bag-lifestyle.png");
  });

  it("summarises customer brand choices for a preview", () => {
    expect(getMarketplaceBrandPreviewCopy({ accentColor: "#2F7A63", fontStyle: "editorial" })).toContain("高級雜誌感");
  });

  it("splits a selected suite into bounded one-role requests in the merchant's order", () => {
    expect(getMarketplaceRoleRequestPlan(["main", "studio", "detail", "lifestyle"])).toEqual([
      ["main"],
      ["studio"],
      ["detail"],
      ["lifestyle"],
    ]);
  });

  it("replaces only the retried failed role while retaining completed assets", () => {
    const merged = mergeMarketplaceSuiteResult({
      channel: "amazon",
      outputs: [{ role: "main", title: "主圖", description: "", url: "/main.png" }],
      failures: [{ role: "detail", title: "賣點圖", message: "暫時失敗" }],
    }, {
      channel: "amazon",
      outputs: [{ role: "detail", title: "賣點圖", description: "", url: "/detail.png", specificationLines: ["重量：180 g"] }],
      failures: [],
    });
    expect(merged.outputs).toEqual(expect.arrayContaining([expect.objectContaining({ role: "main" }), expect.objectContaining({ role: "detail", url: "/detail.png" })]));
    expect(merged.outputs.find((output) => output.role === "detail")?.specificationLines).toEqual(["重量：180 g"]);
    expect(merged.failures).toEqual([]);
  });
});
