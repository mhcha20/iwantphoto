import { describe, expect, it } from "vitest";
import { formatMarketplaceDimensions, parseMarketplaceDimensions } from "./marketplaceDimensions";

describe("marketplace structured dimensions", () => {
  it("parses legacy confirmed dimensions into editable length width height and unit fields", () => {
    expect(parseMarketplaceDimensions("12 × 8 × 4 cm")).toEqual({
      length: "12",
      width: "8",
      height: "4",
      unit: "cm",
      isStructured: true,
    });
    expect(parseMarketplaceDimensions("10x7X2.5mm")).toEqual(expect.objectContaining({
      length: "10",
      width: "7",
      height: "2.5",
      unit: "mm",
      isStructured: true,
    }));
  });

  it("formats only a complete merchant-confirmed L × W × H value", () => {
    expect(formatMarketplaceDimensions({ length: "12", width: "8", height: "4", unit: "cm" })).toBe("12 × 8 × 4 cm");
    expect(formatMarketplaceDimensions({ length: "12", width: "8", height: "", unit: "cm" })).toBe("");
  });

  it("does not silently reinterpret an existing non-structured dimension note", () => {
    expect(parseMarketplaceDimensions("尺寸待確認")).toEqual({
      length: "",
      width: "",
      height: "",
      unit: "cm",
      isStructured: false,
    });
  });
});
