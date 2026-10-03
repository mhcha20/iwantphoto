/**
 * Puts an AI edit back onto the original photo's exact geometry.
 *
 * Image models redraw the whole picture, so the subject comes back a few
 * percent shifted or rescaled. We estimate that drift (uniform scale plus
 * translation) by matching the generated image against the original, then:
 * - cut-outs keep the ORIGINAL pixels and only borrow the aligned AI alpha;
 * - clean-ups keep the original everywhere except the aligned, changed area.
 * When the match is not confident we report it and the caller falls back.
 */
import sharp from "sharp";
import { keyColorToAlpha, readImageSize, type ImageSize, type KeyColor } from "./imagePostProcess";

/** Generated point (u, v) in 0..1 maps to original point 0.5 + scale * (u - 0.5) + dx (same for v / dy). */
export type Similarity = { scale: number; dx: number; dy: number };

type Plane = { data: Float32Array; width: number; height: number };
type Rgba = { data: Buffer; width: number; height: number };

const MAX_OUTPUT_LONG_SIDE = 2048;
const MIN_MATCH_SCORE = 0.6;
const MAX_SAMPLES_PER_LEVEL = 40_000;

function levelSize(size: ImageSize, longSide: number): ImageSize {
  const factor = longSide / Math.max(size.width, size.height);
  return { width: Math.max(8, Math.round(size.width * factor)), height: Math.max(8, Math.round(size.height * factor)) };
}

async function readRgba(buffer: Buffer, size: ImageSize): Promise<Rgba> {
  const data = await sharp(buffer).resize(size.width, size.height, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  return { data, width: size.width, height: size.height };
}

function luminance(image: Rgba): Plane {
  const data = new Float32Array(image.width * image.height);
  for (let i = 0; i < data.length; i++) {
    const o = i * 4;
    data[i] = 0.299 * image.data[o] + 0.587 * image.data[o + 1] + 0.114 * image.data[o + 2];
  }
  return { data, width: image.width, height: image.height };
}

function alphaPlane(image: Rgba): Plane {
  const data = new Float32Array(image.width * image.height);
  for (let i = 0; i < data.length; i++) data[i] = image.data[i * 4 + 3] / 255;
  return { data, width: image.width, height: image.height };
}

function sample(plane: Plane, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const x1 = Math.min(plane.width - 1, x0 + 1);
  const y1 = Math.min(plane.height - 1, y0 + 1);
  const row0 = y0 * plane.width;
  const row1 = y1 * plane.width;
  const top = plane.data[row0 + x0] * (1 - fx) + plane.data[row0 + x1] * fx;
  const bottom = plane.data[row1 + x0] * (1 - fx) + plane.data[row1 + x1] * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * Weighted normalized cross-correlation between generated pixels and the original
 * pixels they map to. -1 when too little of the weighted area lands inside the original.
 */
function matchScore(reference: Plane, generated: Plane, weights: Float32Array, samples: Int32Array, totalWeight: number, t: Similarity): number {
  const { width, height } = generated;
  let sw = 0, sr = 0, sg = 0, srr = 0, sgg = 0, srg = 0;
  for (let k = 0; k < samples.length; k++) {
    const i = samples[k];
    const u = ((i % width) + 0.5) / width;
    const v = (Math.floor(i / width) + 0.5) / height;
    const px = (0.5 + t.scale * (u - 0.5) + t.dx) * width - 0.5;
    const py = (0.5 + t.scale * (v - 0.5) + t.dy) * height - 0.5;
    if (px < 0 || py < 0 || px > width - 1 || py > height - 1) continue;
    const w = weights[i];
    const r = sample(reference, px, py);
    const g = generated.data[i];
    sw += w; sr += w * r; sg += w * g; srr += w * r * r; sgg += w * g * g; srg += w * r * g;
  }
  if (sw < totalWeight * 0.6) return -1;
  const cov = srg - (sr * sg) / sw;
  const varR = srr - (sr * sr) / sw;
  const varG = sgg - (sg * sg) / sw;
  if (varR <= 1e-6 || varG <= 1e-6) return -1;
  return cov / Math.sqrt(varR * varG);
}

type Level = { reference: Plane; generated: Plane; weights: Float32Array; samples: Int32Array; totalWeight: number };

function buildLevel(reference: Rgba, generated: Rgba, weights: Float32Array): Level {
  const indices: number[] = [];
  let totalWeight = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > 0.5) {
      indices.push(i);
      totalWeight += weights[i];
    }
  }
  // Matching every pixel of a large level is slow and adds little; a regular subsample is enough.
  const stride = Math.max(1, Math.ceil(indices.length / MAX_SAMPLES_PER_LEVEL));
  const samples = stride === 1 ? Int32Array.from(indices) : Int32Array.from(indices.filter((_, k) => k % stride === 0));
  let sampledWeight = 0;
  for (let k = 0; k < samples.length; k++) sampledWeight += weights[samples[k]];
  return { reference: luminance(reference), generated: luminance(generated), weights, samples, totalWeight: sampledWeight };
}

function searchAround(level: Level, center: Similarity, scales: number[], shiftPx: number, stepPx: number) {
  let best = { ...center, score: -2 };
  const { width, height } = level.generated;
  for (const scale of scales) {
    for (let sy = -shiftPx; sy <= shiftPx + 1e-9; sy += stepPx) {
      for (let sx = -shiftPx; sx <= shiftPx + 1e-9; sx += stepPx) {
        const t = { scale, dx: center.dx + sx / width, dy: center.dy + sy / height };
        const score = matchScore(level.reference, level.generated, level.weights, level.samples, level.totalWeight, t);
        if (score > best.score) best = { ...t, score };
      }
    }
  }
  return best;
}

function range(from: number, to: number, step: number) {
  const values: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) values.push(Number(v.toFixed(5)));
  return values;
}

export type WeightFn = (generated: Rgba) => Float32Array;

/**
 * Coarse-to-fine search for the scale/shift that best overlays the generated image on the original.
 * `weightsFor` selects which generated pixels to trust (e.g. the cut-out subject only).
 */
export async function estimateAlignment(reference: Buffer, generated: Buffer, canvas: ImageSize, weightsFor: WeightFn) {
  let estimate: Similarity & { score: number } = { scale: 1, dx: 0, dy: 0, score: -2 };
  const plan = [
    { longSide: 64, scales: range(0.82, 1.2, 0.02), shift: 0.12, step: 1 },
    { longSide: 128, scales: [] as number[], shift: 2, step: 1 },
    { longSide: 256, scales: [] as number[], shift: 1.5, step: 0.5 },
    { longSide: 512, scales: [] as number[], shift: 1.5, step: 0.5 },
  ];
  for (let index = 0; index < plan.length; index++) {
    const step = plan[index];
    const size = levelSize(canvas, step.longSide);
    const [ref, gen] = await Promise.all([readRgba(reference, size), readRgba(generated, size)]);
    const level = buildLevel(ref, gen, weightsFor(gen));
    if (level.samples.length < 32) return { ...estimate, score: -1 };
    if (index === 0) {
      const shiftPx = Math.round(step.shift * Math.max(size.width, size.height));
      estimate = searchAround(level, { scale: 1, dx: 0, dy: 0 }, step.scales, shiftPx, step.step);
    } else {
      const spread = [0, 0.02, 0.006, 0.003][index];
      const scales = range(estimate.scale - spread, estimate.scale + spread, spread / 4);
      estimate = searchAround(level, estimate, scales, step.shift, step.step);
    }
  }
  return estimate;
}

/** Resamples `source` into the original's frame using the estimated drift. Pixels with no source get alpha 0. */
export function warpToReference(source: Rgba, out: ImageSize, t: Similarity): Rgba {
  const data = Buffer.alloc(out.width * out.height * 4);
  const channels: Plane[] = [0, 1, 2, 3].map((c) => {
    const plane = new Float32Array(source.width * source.height);
    for (let i = 0; i < plane.length; i++) plane[i] = source.data[i * 4 + c];
    return { data: plane, width: source.width, height: source.height };
  });
  for (let y = 0; y < out.height; y++) {
    const pv = (y + 0.5) / out.height;
    const v = 0.5 + (pv - 0.5 - t.dy) / t.scale;
    const sy = v * source.height - 0.5;
    for (let x = 0; x < out.width; x++) {
      const pu = (x + 0.5) / out.width;
      const u = 0.5 + (pu - 0.5 - t.dx) / t.scale;
      const sx = u * source.width - 0.5;
      const o = (y * out.width + x) * 4;
      if (sx < 0 || sy < 0 || sx > source.width - 1 || sy > source.height - 1) continue;
      for (let c = 0; c < 4; c++) data[o + c] = Math.round(sample(channels[c], sx, sy));
    }
  }
  return { data, width: out.width, height: out.height };
}

export async function outputCanvas(reference: Buffer): Promise<ImageSize> {
  const size = await readImageSize(reference);
  if (!size) throw new Error("Original photo could not be read");
  const factor = Math.min(1, MAX_OUTPUT_LONG_SIDE / Math.max(size.width, size.height));
  return { width: Math.round(size.width * factor), height: Math.round(size.height * factor) };
}

async function encodeRgba(image: Rgba) {
  return sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } }).png().toBuffer();
}

export type ComposeResult = { buffer: Buffer; aligned: boolean; alignment?: Similarity & { score: number } };

/**
 * Cut-out: the model drew the subject on a flat key colour. Its alpha is aligned onto the
 * original, and the final pixels are the original photo's own pixels (edges use the
 * model's de-spilled colours so no old background bleeds through).
 * Returns undefined when the key background is unusable (caller retries).
 */
export async function composeCutout(reference: Buffer, generated: Buffer, key: KeyColor, background: "transparent" | "white"): Promise<ComposeResult | undefined> {
  const canvas = await outputCanvas(reference);
  const keyed = await keyColorToAlpha(await sharp(generated).resize(canvas.width, canvas.height, { fit: "fill" }).png().toBuffer(), key);
  if (!keyed) return undefined;

  const alignment = await estimateAlignment(reference, keyed, canvas, (gen) => alphaPlane(gen).data);
  const cutout = await readRgba(keyed, canvas);
  let result: Rgba;
  if (alignment.score < MIN_MATCH_SCORE) {
    result = cutout;
  } else {
    const warped = warpToReference(cutout, canvas, alignment);
    sealHairlineGaps(warped);
    const original = await readRgba(reference, canvas);
    // The model's alpha only decides WHAT is subject. Its in-between values are not real
    // transparency: a muted key colour close to the subject (pinkish magenta vs. skin) would
    // otherwise leave the subject see-through. Harden it to a solid mask with a ~1px soft edge.
    const solid = Buffer.alloc(canvas.width * canvas.height);
    for (let i = 0; i < solid.length; i++) solid[i] = warped.data[i * 4 + 3] >= 128 ? 255 : 0;
    const alpha = await sharp(solid, { raw: { width: canvas.width, height: canvas.height, channels: 1 } })
      .blur(0.8)
      .extractChannel(0)
      .raw()
      .toBuffer();
    result = { data: Buffer.alloc(warped.data.length), width: canvas.width, height: canvas.height };
    for (let i = 0; i < alpha.length; i++) {
      const o = i * 4;
      result.data[o] = original.data[o];
      result.data[o + 1] = original.data[o + 1];
      result.data[o + 2] = original.data[o + 2];
      result.data[o + 3] = alpha[i];
    }
  }
  let buffer = await encodeRgba(result);
  if (background === "white") buffer = await sharp(buffer).flatten({ background: "#ffffff" }).png().toBuffer();
  return { buffer, aligned: alignment.score >= MIN_MATCH_SCORE, alignment };
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const horizontal = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = 0;
      for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius) && !on; k++) on = mask[y * width + k];
      horizontal[y * width + x] = on;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let on = 0;
      for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius) && !on; k++) on = horizontal[k * width + x];
      out[y * width + x] = on;
    }
  }
  return out;
}

function erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const inverted = mask.map((v) => (v ? 0 : 1));
  return dilate(inverted, width, height, radius).map((v) => (v ? 0 : 1));
}

/**
 * Seals hairline gaps inside the subject (e.g. an anti-aliased edge between two colours that
 * happens to look like the key background). Closing with a small radius fills gaps a few pixels
 * wide but leaves real holes, such as the space inside a bag handle, transparent.
 */
function sealHairlineGaps(rgba: Rgba, radius = 2) {
  const { width, height } = rgba;
  const solid = new Uint8Array(width * height);
  for (let i = 0; i < solid.length; i++) solid[i] = rgba.data[i * 4 + 3] >= 128 ? 1 : 0;
  const closed = erode(dilate(solid, width, height, radius), width, height, radius);
  for (let i = 0; i < solid.length; i++) if (closed[i] && !solid[i]) rgba.data[i * 4 + 3] = 255;
}

/** Per-channel gain/offset that makes `image` match `target` over the selected pixels (undoes the model's colour drift). */
function colorMatch(image: Rgba, target: Rgba, use: Uint8Array) {
  const gains = [1, 1, 1];
  const offsets = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    let n = 0, si = 0, st = 0, sii = 0, stt = 0;
    for (let i = 0; i < use.length; i++) {
      if (!use[i] || image.data[i * 4 + 3] === 0) continue;
      const a = image.data[i * 4 + c];
      const b = target.data[i * 4 + c];
      n++; si += a; st += b; sii += a * a; stt += b * b;
    }
    if (n < 100) continue;
    const mi = si / n, mt = st / n;
    const sdI = Math.sqrt(Math.max(1e-6, sii / n - mi * mi));
    const sdT = Math.sqrt(Math.max(1e-6, stt / n - mt * mt));
    gains[c] = Math.min(1.5, Math.max(0.67, sdT / sdI));
    offsets[c] = mt - gains[c] * mi;
  }
  return (value: number, c: number) => Math.max(0, Math.min(255, gains[c] * value + offsets[c]));
}

/**
 * Clean-up: align the model's version, then take its pixels only where it actually changed
 * something (and, if the user brushed a selection, near that selection). Everything else stays
 * the original photo, pixel for pixel.
 */
export async function composeCleanup(reference: Buffer, generated: Buffer, selection?: Buffer): Promise<ComposeResult> {
  const canvas = await outputCanvas(reference);
  const gen = await readRgba(generated, canvas);
  const genPng = await encodeRgba(gen);

  // Work grid for masks: long side 256.
  const grid = levelSize(canvas, 256);
  const brushed = selection
    ? alphaPlane(await readRgba(selection, grid)).data.reduce((m, a, i) => ((m[i] = a > 0.1 ? 1 : 0), m), new Uint8Array(grid.width * grid.height))
    : undefined;
  const brushedNear = brushed ? dilate(brushed, grid.width, grid.height, 6) : undefined;

  const alignment = await estimateAlignment(reference, genPng, canvas, (g) => {
    const weights = new Float32Array(g.width * g.height).fill(1);
    if (!brushedNear) return weights;
    // Ignore the area being edited when matching; it is supposed to differ.
    const scaleX = grid.width / g.width;
    const scaleY = grid.height / g.height;
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        if (brushedNear[Math.min(grid.height - 1, Math.floor(y * scaleY)) * grid.width + Math.min(grid.width - 1, Math.floor(x * scaleX))]) weights[y * g.width + x] = 0;
      }
    }
    return weights;
  });
  if (alignment.score < MIN_MATCH_SCORE) return { buffer: genPng, aligned: false, alignment };

  // Find what changed, on the small grid.
  const original = await readRgba(reference, canvas);
  const warped = warpToReference(gen, canvas, alignment);
  const originalSmall = await readRgba(await encodeRgba(original), grid);
  const warpedSmall = await readRgba(await encodeRgba(warped), grid);
  const outside = new Uint8Array(grid.width * grid.height).fill(1);
  if (brushedNear) for (let i = 0; i < outside.length; i++) outside[i] = brushedNear[i] ? 0 : 1;
  const matchSmall = colorMatch(warpedSmall, originalSmall, outside);
  const changed = new Uint8Array(grid.width * grid.height);
  for (let i = 0; i < changed.length; i++) {
    if (warpedSmall.data[i * 4 + 3] === 0) continue;
    let diff = 0;
    for (let c = 0; c < 3; c++) diff = Math.max(diff, Math.abs(matchSmall(warpedSmall.data[i * 4 + c], c) - originalSmall.data[i * 4 + c]));
    changed[i] = diff > 40 ? 1 : 0;
  }
  // Drop isolated speckles (texture noise from the redraw), then grow the real changes a little.
  const cleaned = new Uint8Array(changed.length);
  for (let y = 1; y < grid.height - 1; y++) {
    for (let x = 1; x < grid.width - 1; x++) {
      let count = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) count += changed[(y + oy) * grid.width + x + ox];
      cleaned[y * grid.width + x] = count >= 5 ? 1 : 0;
    }
  }
  let region = dilate(cleaned, grid.width, grid.height, 3);
  if (brushed) {
    const nearSelection = dilate(brushed, grid.width, grid.height, 20);
    const selected = dilate(brushed, grid.width, grid.height, 3);
    for (let i = 0; i < region.length; i++) region[i] = selected[i] || (region[i] && nearSelection[i]) ? 1 : 0;
  }
  const coverage = region.reduce((sum, v) => sum + v, 0) / region.length;
  if (coverage > 0.6) region = new Uint8Array(region.length).fill(1);

  // Feathered full-size blend mask.
  const maskSmall = Buffer.from(region.map((v) => v * 255));
  const blend = await sharp(maskSmall, { raw: { width: grid.width, height: grid.height, channels: 1 } })
    .resize(canvas.width, canvas.height, { fit: "fill" })
    .blur(Math.max(0.5, (canvas.width / grid.width) * 1.5))
    .extractChannel(0)
    .raw()
    .toBuffer();

  const outsideFull = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < outsideFull.length; i++) outsideFull[i] = blend[i] < 8 ? 1 : 0;
  const match = colorMatch(warped, original, outsideFull);
  const result: Rgba = { data: Buffer.alloc(original.data.length), width: canvas.width, height: canvas.height };
  for (let i = 0; i < blend.length; i++) {
    const o = i * 4;
    const m = warped.data[o + 3] === 0 ? 0 : blend[i] / 255;
    for (let c = 0; c < 3; c++) result.data[o + c] = Math.round(original.data[o + c] * (1 - m) + match(warped.data[o + c], c) * m);
    result.data[o + 3] = 255;
  }
  return { buffer: await encodeRgba(result), aligned: true, alignment };
}
