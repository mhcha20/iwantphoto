import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { composeCleanup, composeCutout, warpToReference } from "./imageAlignment";

const W = 1200;
const H = 800;
// The subject (a blue box with stripes and a label) in the original photo.
const SUBJECT = { x: 420, y: 250, w: 300, h: 330 };

function scene(options: { withTag: boolean; subjectOnly?: boolean; background?: string }) {
  const bg = options.subjectOnly
    ? `<rect width="${W}" height="${H}" fill="${options.background}"/>`
    : `<rect width="${W}" height="${H}" fill="#c9b79c"/>
       ${Array.from({ length: 40 }, (_, i) => `<rect x="${(i * 97) % W}" y="${(i * 53) % H}" width="${30 + (i % 5) * 9}" height="${12 + (i % 3) * 7}" fill="#${(0x9a8a70 + i * 0x030201).toString(16).slice(0, 6)}"/>`).join("")}
       <rect y="600" width="${W}" height="200" fill="#8a7a62"/>`;
  const tag = options.withTag ? `<rect x="80" y="110" width="210" height="70" fill="#f5e663"/><text x="185" y="157" font-size="34" text-anchor="middle" fill="#222" font-family="sans-serif">SALE $9</text>` : "";
  const s = SUBJECT;
  const subject = `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="24" fill="#2b6cb0"/>
    ${Array.from({ length: 6 }, (_, i) => `<rect x="${s.x + 20}" y="${s.y + 30 + i * 45}" width="${s.w - 40}" height="14" fill="#${["e2e8f0", "f6ad55", "fc8181"][i % 3]}"/>`).join("")}
    <text x="${s.x + s.w / 2}" y="${s.y + 190}" font-size="48" text-anchor="middle" fill="#fff" font-family="sans-serif">COFFEE</text>`;
  return sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${bg}${options.subjectOnly ? "" : tag}${subject}</svg>`)).png().toBuffer();
}

/** Simulates the model's redraw: shrinks 7%, shifts right 3% / up 2%, changes resolution, tints and softens. */
async function simulateModel(image: Buffer, outWidth: number) {
  const raw = await sharp(image).ensureAlpha().raw().toBuffer();
  const outHeight = Math.round((outWidth * H) / W);
  const drifted = warpToReference({ data: raw, width: W, height: H }, { width: outWidth, height: outHeight }, { scale: 0.93, dx: 0.03, dy: -0.02 });
  return sharp(drifted.data, { raw: { width: outWidth, height: outHeight, channels: 4 } })
    .flatten({ background: "#8fbc78" })
    .modulate({ brightness: 1.04 })
    .blur(0.6)
    .png()
    .toBuffer();
}

describe("composeCutout", () => {
  it("recovers the model's drift and returns the subject at its original position", async () => {
    const original = await scene({ withTag: true });
    const generated = await simulateModel(await scene({ withTag: false, subjectOnly: true, background: "#8fbc78" }), 1024);

    const result = await composeCutout(original, generated, "green", "transparent");
    expect(result?.aligned).toBe(true);
    // Inverse of the simulated drift: scale 1/0.93, shift -(0.03, -0.02)/0.93.
    expect(result!.alignment!.scale).toBeCloseTo(1 / 0.93, 2);
    expect(result!.alignment!.dx).toBeCloseTo(-0.03 / 0.93, 2);
    expect(result!.alignment!.dy).toBeCloseTo(0.02 / 0.93, 2);

    const { data, info } = await sharp(result!.buffer).raw().toBuffer({ resolveWithObject: true });
    expect({ width: info.width, height: info.height }).toEqual({ width: W, height: H });
    // Compare the cut-out's opaque area with the true subject box (rounded corners excluded by an inset).
    let inside = 0, insideOpaque = 0, outside = 0, outsideOpaque = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const opaque = data[(y * W + x) * 4 + 3] > 128;
        const s = SUBJECT;
        const inBox = x >= s.x + 8 && x < s.x + s.w - 8 && y >= s.y + 8 && y < s.y + s.h - 8;
        const farOut = x < s.x - 6 || x >= s.x + s.w + 6 || y < s.y - 6 || y >= s.y + s.h + 6;
        if (inBox) { inside++; if (opaque) insideOpaque++; }
        if (farOut) { outside++; if (opaque) outsideOpaque++; }
      }
    }
    expect(insideOpaque / inside).toBeGreaterThan(0.99);
    expect(outsideOpaque / outside).toBeLessThan(0.002);
    // Solid subject pixels are the original's own pixels (untinted).
    const originalRaw = await sharp(original).ensureAlpha().raw().toBuffer();
    const centre = ((SUBJECT.y + 100) * W + SUBJECT.x + 150) * 4;
    expect([data[centre], data[centre + 1], data[centre + 2]]).toEqual([originalRaw[centre], originalRaw[centre + 1], originalRaw[centre + 2]]);
  });

  it("keeps real holes (like the space inside a bag handle) transparent", async () => {
    const hole = { x: 520, y: 330, w: 100, h: 60 };
    const withHole = (background: string, holeFill: string) =>
      sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="${background}"/>
        <rect x="${SUBJECT.x}" y="${SUBJECT.y}" width="${SUBJECT.w}" height="${SUBJECT.h}" fill="#2b6cb0"/>
        <rect x="${SUBJECT.x + 20}" y="${SUBJECT.y + 200}" width="${SUBJECT.w - 40}" height="40" fill="#f6ad55"/>
        <rect x="${hole.x}" y="${hole.y}" width="${hole.w}" height="${hole.h}" fill="${holeFill}"/></svg>`)).png().toBuffer();
    const original = await withHole("#c9b79c", "#c9b79c");
    const generated = await simulateModel(await withHole("#8fbc78", "#8fbc78"), 1024);
    const result = await composeCutout(original, generated, "green", "transparent");
    expect(result?.aligned).toBe(true);
    const { data } = await sharp(result!.buffer).raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * W + x) * 4 + 3];
    expect(alphaAt(hole.x + hole.w / 2, hole.y + hole.h / 2)).toBe(0);
    expect(alphaAt(SUBJECT.x + 40, SUBJECT.y + 40)).toBe(255);
  });

  it("flattens onto white for the white-background style", async () => {
    const original = await scene({ withTag: true });
    const generated = await simulateModel(await scene({ withTag: false, subjectOnly: true, background: "#8fbc78" }), 1024);
    const result = await composeCutout(original, generated, "green", "white");
    const { data, info } = await sharp(result!.buffer).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]);
  });
});

describe("composeCleanup", () => {
  it("replaces only the removed object and keeps the rest of the original pixel for pixel", async () => {
    const original = await scene({ withTag: true });
    const generated = await simulateModel(await scene({ withTag: false }), 1024);

    const result = await composeCleanup(original, generated);
    expect(result.aligned).toBe(true);
    const out = await sharp(result.buffer).removeAlpha().raw().toBuffer();
    const orig = await sharp(original).removeAlpha().raw().toBuffer();
    const at = (buf: Buffer, x: number, y: number) => [buf[(y * W + x) * 3], buf[(y * W + x) * 3 + 1], buf[(y * W + x) * 3 + 2]];

    // The yellow tag is gone.
    const [r, g, b] = at(out, 185, 125);
    expect(r > 200 && g > 200 && b < 140).toBe(false);
    // Far from the tag, the original is untouched.
    let changed = 0, total = 0;
    for (let y = 300; y < H; y += 3) {
      for (let x = 0; x < W; x += 3) {
        total++;
        const a = at(out, x, y), o = at(orig, x, y);
        if (Math.abs(a[0] - o[0]) + Math.abs(a[1] - o[1]) + Math.abs(a[2] - o[2]) > 3) changed++;
      }
    }
    expect(changed / total).toBeLessThan(0.01);
  });

  it("falls back to the model output when it cannot find a confident match", async () => {
    const original = await scene({ withTag: true });
    const unrelated = await sharp({ create: { width: 1024, height: 683, channels: 3, background: "#333" } }).png().toBuffer();
    const result = await composeCleanup(original, unrelated);
    expect(result.aligned).toBe(false);
  });
});
