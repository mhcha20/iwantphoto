import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { isSegmentationAvailable, segmentSubject } from "./segmentation";

// Runs the real ISNet model when it has been fetched (`pnpm fetch:models`); skipped otherwise.
describe.skipIf(!isSegmentationAvailable())("ISNet segmentation (real model)", () => {
  it("separates a product from a plain background at the original size", async () => {
    const W = 600, H = 400;
    const photo = await sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="#d9d4cc"/>
      <rect x="220" y="90" width="160" height="220" rx="18" fill="#c0392b"/>
      <rect x="240" y="150" width="120" height="40" fill="#f5f5f5"/></svg>`)).png().toBuffer();

    const probability = await segmentSubject(photo, { width: W, height: H });

    expect(probability.length).toBe(W * H);
    expect(probability[200 * W + 300]).toBeGreaterThan(200);
    expect(probability[30 * W + 40]).toBeLessThan(40);
  }, 60_000);
});
