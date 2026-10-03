import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { fitToReferenceCanvas, keyColorToAlpha, nearestSupportedAspectRatio, pickKeyColor } from "./imagePostProcess";

async function solid(width: number, height: number, background: string) {
  return sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();
}

/** A blue square on a muted green field, like a real model "green screen". */
async function subjectOnGreen(width: number, height: number) {
  const square = await solid(Math.round(width / 3), Math.round(height / 3), "#2b6cb0");
  return sharp({ create: { width, height, channels: 3, background: "#8fbc78" } })
    .composite([{ input: square, left: Math.round(width / 3), top: Math.round(height / 3) }])
    .png()
    .toBuffer();
}

describe("nearestSupportedAspectRatio", () => {
  it("maps canvases onto the ratios image models accept", () => {
    expect(nearestSupportedAspectRatio({ width: 1200, height: 800 })).toBe("3:2");
    expect(nearestSupportedAspectRatio({ width: 800, height: 1200 })).toBe("2:3");
    expect(nearestSupportedAspectRatio({ width: 1000, height: 1000 })).toBe("1:1");
    expect(nearestSupportedAspectRatio({ width: 1920, height: 1080 })).toBe("16:9");
  });
});

describe("fitToReferenceCanvas", () => {
  it("centre-crops aspect drift and never enlarges past the model output", async () => {
    const square = await solid(1024, 1024, "#ffffff");
    const fitted = await sharp(await fitToReferenceCanvas(square, { width: 3000, height: 2000 })).metadata();
    expect({ width: fitted.width, height: fitted.height }).toEqual({ width: 1024, height: 683 });
  });

  it("downsizes to the original resolution when the original is smaller", async () => {
    const big = await solid(1248, 832, "#ffffff");
    const fitted = await sharp(await fitToReferenceCanvas(big, { width: 600, height: 400 })).metadata();
    expect({ width: fitted.width, height: fitted.height }).toEqual({ width: 600, height: 400 });
  });
});

describe("keyColorToAlpha", () => {
  it("turns the measured background transparent and keeps the subject opaque", async () => {
    const keyed = await keyColorToAlpha(await subjectOnGreen(300, 300), "green");
    expect(keyed).toBeDefined();
    const { data, info } = await sharp(keyed!).raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    expect(alphaAt(5, 5)).toBe(0);
    expect(alphaAt(150, 150)).toBe(255);
  });

  it("refuses an image whose border is not a key-colour background", async () => {
    expect(await keyColorToAlpha(await solid(100, 100, "#2b6cb0"), "green")).toBeUndefined();
    expect(await keyColorToAlpha(await solid(100, 100, "#9bc27d"), "magenta")).toBeUndefined();
  });
});

describe("pickKeyColor", () => {
  it("avoids the key colour that the product itself uses", async () => {
    expect(await pickKeyColor(await solid(64, 64, "#00ff00"))).toBe("magenta");
    expect(await pickKeyColor(await solid(64, 64, "#ff00ff"))).toBe("green");
    expect(await pickKeyColor(await solid(64, 64, "#2b6cb0"))).toBe("green");
  });
});
