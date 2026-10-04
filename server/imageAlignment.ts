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
const MAX_SAMPLES_PER_LEVEL = 20_000;
/** Enclosed holes under this share of the canvas are treated as specks the model got wrong, not real holes. */
const SMALL_HOLE_SHARE = 0.0025;
/** Detached subject fragments under this share of the canvas are stray background, not product. */
const SMALL_ISLAND_SHARE = 0.001;

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

/** Edge strength. Matching edges instead of brightness lets the subject's outline count even though the backgrounds differ. */
function gradientMagnitude(plane: Plane): Plane {
  const { width, height } = plane;
  const data = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = plane.data[i + 1] - plane.data[i - 1];
      const gy = plane.data[i + width] - plane.data[i - width];
      data[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return { data, width, height };
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

export type Signal = "luminance" | "gradient";

type Level = { reference: Plane; generated: Plane; weights: Float32Array; samples: Int32Array; totalWeight: number };

function buildLevel(reference: Rgba, generated: Rgba, weights: Float32Array, maxSamples = MAX_SAMPLES_PER_LEVEL, signal: Signal = "luminance"): Level {
  const indices: number[] = [];
  let totalWeight = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > 0.5) {
      indices.push(i);
      totalWeight += weights[i];
    }
  }
  // Matching every pixel of a large level is slow and adds little; a regular subsample is enough.
  const stride = Math.max(1, Math.ceil(indices.length / maxSamples));
  const samples = stride === 1 ? Int32Array.from(indices) : Int32Array.from(indices.filter((_, k) => k % stride === 0));
  let sampledWeight = 0;
  for (let k = 0; k < samples.length; k++) sampledWeight += weights[samples[k]];
  const plane = signal === "gradient" ? (image: Rgba) => gradientMagnitude(luminance(image)) : luminance;
  return { reference: plane(reference), generated: plane(generated), weights, samples, totalWeight: sampledWeight };
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
type Scored = Similarity & { score: number };

/**
 * Exhaustive coarse pass. Models sometimes reframe heavily (subject shrunk to ~65% and moved a
 * quarter of the frame), so scales 0.6-1.6 (log-spaced) and shifts up to 30% are tried. Several
 * distinct good candidates are kept, because at this resolution the true answer is not always first.
 */
function coarseCandidates(level: Level, keep: number): Scored[] {
  const { width, height } = level.generated;
  const shiftPx = Math.round(0.3 * Math.max(width, height));
  const all: Scored[] = [];
  for (let scale = 0.6; scale <= 1.6; scale *= 1.025) {
    for (let sy = -shiftPx; sy <= shiftPx; sy++) {
      for (let sx = -shiftPx; sx <= shiftPx; sx++) {
        const t = { scale, dx: sx / width, dy: sy / height };
        const score = matchScore(level.reference, level.generated, level.weights, level.samples, level.totalWeight, t);
        if (score > 0) all.push({ ...t, score });
      }
    }
  }
  all.sort((a, b) => b.score - a.score);
  const picked: Scored[] = [];
  for (const candidate of all) {
    const distinct = picked.every(
      (p) => Math.abs(Math.log(p.scale / candidate.scale)) > 0.05 || Math.abs(p.dx - candidate.dx) * width > 3 || Math.abs(p.dy - candidate.dy) * height > 3,
    );
    if (distinct) picked.push(candidate);
    if (picked.length === keep) break;
  }
  return picked;
}

/**
 * Coarse-to-fine search for the scale/shift that best overlays the generated image on the original.
 * `weightsFor` selects which generated pixels to trust (e.g. the cut-out subject only).
 */
export async function estimateAlignment(reference: Buffer, generated: Buffer, canvas: ImageSize, weightsFor: WeightFn, signal: Signal = "luminance"): Promise<Scored> {
  const failed = { scale: 1, dx: 0, dy: 0, score: -1 };
  const loadLevel = async (longSide: number, maxSamples: number) => {
    const size = levelSize(canvas, longSide);
    const [ref, gen] = await Promise.all([readRgba(reference, size), readRgba(generated, size)]);
    return buildLevel(ref, gen, weightsFor(gen), maxSamples, signal);
  };

  // The wide first pass tries ~60k transforms, so it uses a sparser sample.
  const coarse = await loadLevel(64, 1_500);
  if (coarse.samples.length < 32) return failed;
  const candidates = coarseCandidates(coarse, 4);
  if (!candidates.length) return failed;

  const refinements = [
    { level: await loadLevel(128, MAX_SAMPLES_PER_LEVEL), spread: 0.03, shift: 3, step: 1 },
    { level: await loadLevel(256, MAX_SAMPLES_PER_LEVEL), spread: 0.008, shift: 1.5, step: 0.5 },
    { level: await loadLevel(512, 20_000), spread: 0.003, shift: 1.5, step: 0.5 },
  ];
  let best: Scored = failed;
  for (const start of candidates) {
    let estimate: Scored = start;
    for (const pass of refinements) {
      if (pass.level.samples.length < 32) return failed;
      const scales = range(estimate.scale - pass.spread, estimate.scale + pass.spread, pass.spread / 4);
      estimate = searchAround(pass.level, estimate, scales, pass.shift, pass.step);
    }
    if (estimate.score > best.score) best = estimate;
  }
  return best;
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
 * Aligns the model's key-colour cut-out onto the original and returns its subject as a binary
 * mask in the original's frame. Undefined when the key background is unusable (caller retries);
 * `subject` is null when the drawing cannot be aligned.
 */
export async function alignModelSubject(reference: Buffer, generated: Buffer, key: KeyColor, canvas: ImageSize) {
  const keyed = await keyColorToAlpha(await sharp(generated).resize(canvas.width, canvas.height, { fit: "fill" }).png().toBuffer(), key);
  if (!keyed) return undefined;
  const alignment = await estimateAlignment(reference, keyed, canvas, (gen) => alphaPlane(gen).data);
  const cutout = await readRgba(keyed, canvas);
  if (alignment.score < MIN_MATCH_SCORE) return { subject: null, alignment, unaligned: cutout };
  const warped = warpToReference(cutout, canvas, alignment);
  sealHairlineGaps(warped);
  // The model's alpha only decides WHAT is subject. Its in-between values are not real
  // transparency: a muted key colour close to the subject (pinkish magenta vs. skin) would
  // otherwise leave the subject see-through.
  const subject = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < subject.length; i++) subject[i] = warped.data[i * 4 + 3] >= 128 ? 1 : 0;
  return { subject, alignment, unaligned: cutout };
}

/** Final cut-out: solid subject with a ~1px soft edge, every visible pixel taken from the original. */
async function renderCutout(reference: Buffer, canvas: ImageSize, subject: Uint8Array, background: "transparent" | "white", keepClear?: Uint8Array) {
  fillSmallEnclosedHoles(subject, canvas.width, canvas.height, Math.round(canvas.width * canvas.height * SMALL_HOLE_SHARE));
  if (keepClear) {
    for (let i = 0; i < subject.length; i++) if (keepClear[i]) subject[i] = 0;
    // Specks of wall texture left inside a cleared gap are now detached from the subject.
    removeSmallIslands(subject, canvas.width, canvas.height, Math.round(canvas.width * canvas.height * SMALL_ISLAND_SHARE));
  }
  const solid = Buffer.alloc(subject.length);
  for (let i = 0; i < solid.length; i++) solid[i] = subject[i] ? 255 : 0;
  const alpha = await sharp(solid, { raw: { width: canvas.width, height: canvas.height, channels: 1 } })
    .blur(0.8)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const original = await readRgba(reference, canvas);
  const result: Rgba = { data: Buffer.alloc(original.data.length), width: canvas.width, height: canvas.height };
  for (let i = 0; i < alpha.length; i++) {
    const o = i * 4;
    result.data[o] = original.data[o];
    result.data[o + 1] = original.data[o + 1];
    result.data[o + 2] = original.data[o + 2];
    result.data[o + 3] = alpha[i];
  }
  const buffer = await encodeRgba(result);
  return background === "white" ? sharp(buffer).flatten({ background: "#ffffff" }).png().toBuffer() : buffer;
}

/**
 * Cut-out from the model alone (used when no segmentation model is installed): the model drew the
 * subject on a flat key colour; its alpha is aligned onto the original and the original's own pixels
 * are kept. Returns undefined when the key background is unusable (caller retries).
 */
export async function composeCutout(reference: Buffer, generated: Buffer, key: KeyColor, background: "transparent" | "white"): Promise<ComposeResult | undefined> {
  const canvas = await outputCanvas(reference);
  const aligned = await alignModelSubject(reference, generated, key, canvas);
  if (!aligned) return undefined;
  if (!aligned.subject) {
    let buffer = await encodeRgba(aligned.unaligned);
    if (background === "white") buffer = await sharp(buffer).flatten({ background: "#ffffff" }).png().toBuffer();
    return { buffer, aligned: false, alignment: aligned.alignment };
  }
  return { buffer: await renderCutout(reference, canvas, aligned.subject, background), aligned: true, alignment: aligned.alignment };
}

const CONFIDENT_SUBJECT = 217; // 85%
const CONFIDENT_BACKGROUND = 38; // 15%

/**
 * Areas where the segmentation model is genuinely unsure (e.g. a brown paper bag inside a carrier
 * bag), as opposed to the thin band of in-between values that every soft edge has. The band is
 * removed with a morphological opening sized to the image.
 */
export function uncertainRegions(probability: Uint8Array, width: number, height: number): Uint8Array {
  const unsure = new Uint8Array(probability.length);
  for (let i = 0; i < unsure.length; i++) unsure[i] = probability[i] > CONFIDENT_BACKGROUND && probability[i] < CONFIDENT_SUBJECT ? 1 : 0;
  const radius = Math.max(2, Math.round(Math.max(width, height) / 200));
  return dilate(erode(unsure, width, height, radius), width, height, radius);
}

/**
 * Background removal from a pixel-accurate segmentation of the original. Where the segmentation is
 * genuinely unsure, the aligned model cut-out (if any) decides; solid parts the model adds next to the
 * subject are kept too, except where the segmentation confidently sees background through the subject
 * (e.g. between bag handles). Everywhere else, including every edge, the segmentation decides, so
 * outlines follow the real photo exactly.
 */
export async function composeSegmentedCutout(
  reference: Buffer,
  canvas: ImageSize,
  probability: Uint8Array,
  unsure: Uint8Array,
  modelSubject: Uint8Array | null,
  background: "transparent" | "white",
) {
  const { width, height } = canvas;
  const subject = new Uint8Array(probability.length);
  for (let i = 0; i < subject.length; i++) {
    subject[i] = unsure[i] && modelSubject ? modelSubject[i] : probability[i] >= 128 ? 1 : 0;
  }
  if (modelSubject) {
    const extra = attachedModelAdditions(subject, modelSubject, width, height);
    for (let i = 0; i < subject.length; i++) if (extra[i]) subject[i] = 1;
  }
  removeSmallIslands(subject, canvas.width, canvas.height, Math.round(canvas.width * canvas.height * SMALL_ISLAND_SHARE));
  return renderCutout(reference, canvas, subject, background, segmentedHoles(probability, await readRgba(reference, canvas)));
}

const MIN_SEGMENTED_HOLE_SHARE = 0.0001;
const MIN_HOLE_CONFIDENT_SHARE = 0.15;
const MIN_HOLE_COLOR_TOLERANCE = 24;

/**
 * Background the segmentation sees through the subject, such as the wall between a bag's handles.
 * A gap that is mostly confident background is cleared whole. In a less certain gap the confident
 * core is cleared, plus pixels with the core's colour (the same wall), so real subject parts showing
 * through it (a different colour) are still left to the model. These stay transparent even when the model
 * cut-out or hole filling would close them.
 */
function segmentedHoles(probability: Uint8Array, original: Rgba): Uint8Array {
  const { width, height, data } = original;
  const holes = new Uint8Array(probability.length);
  const seen = new Uint8Array(probability.length);
  const queue = new Int32Array(probability.length);
  const minArea = Math.round(width * height * MIN_SEGMENTED_HOLE_SHARE);
  for (let start = 0; start < probability.length; start++) {
    if (probability[start] >= 128 || seen[start]) continue;
    let head = 0, tail = 0, touchesBorder = false;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const i = queue[head++];
      const x = i % width, y = (i - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      const neighbours = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
      for (const n of neighbours) {
        if (n >= 0 && probability[n] < 128 && !seen[n]) {
          seen[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    if (touchesBorder || tail < minArea) continue;
    let confident = 0;
    const sum = [0, 0, 0];
    const squares = [0, 0, 0];
    for (let k = 0; k < tail; k++) {
      const i = queue[k];
      if (probability[i] > CONFIDENT_BACKGROUND) continue;
      confident++;
      for (let c = 0; c < 3; c++) {
        sum[c] += data[i * 4 + c];
        squares[c] += data[i * 4 + c] ** 2;
      }
    }
    if (confident < MIN_HOLE_CONFIDENT_SHARE * tail) continue;
    if (confident * 2 >= tail) {
      // Mostly confident: the whole gap is see-through, including its fringe next to a handle.
      for (let k = 0; k < tail; k++) holes[queue[k]] = 1;
      continue;
    }
    const mean = sum.map((v) => v / confident);
    const variance = squares.reduce((total, v, c) => total + Math.max(0, v / confident - mean[c] ** 2), 0);
    const tolerance = Math.max(MIN_HOLE_COLOR_TOLERANCE, 2.5 * Math.sqrt(variance));
    for (let k = 0; k < tail; k++) {
      const i = queue[k];
      if (probability[i] <= CONFIDENT_BACKGROUND) {
        holes[i] = 1;
        continue;
      }
      let distance = 0;
      for (let c = 0; c < 3; c++) distance += (data[i * 4 + c] - mean[c]) ** 2;
      if (Math.sqrt(distance) <= tolerance) holes[i] = 1;
    }
  }
  return holes;
}

/**
 * Parts of the subject the segmentation confidently missed (e.g. the crumpled top of a brown paper
 * bag it scored as background) but the aligned model cut-out includes. Only solid areas survive (the
 * thin drift band along every outline is removed by an opening), and only those touching the subject:
 * a detached blob the model drew elsewhere is more likely background than a missed part.
 */
function attachedModelAdditions(subject: Uint8Array, modelSubject: Uint8Array, width: number, height: number): Uint8Array {
  const radius = Math.max(2, Math.round(Math.max(width, height) / 200));
  const candidate = new Uint8Array(subject.length);
  for (let i = 0; i < candidate.length; i++) candidate[i] = modelSubject[i] && !subject[i] ? 1 : 0;
  const solid = dilate(erode(candidate, width, height, radius), width, height, radius);
  const near = dilate(subject, width, height, radius + 1);
  const result = new Uint8Array(subject.length);
  const queue = new Int32Array(subject.length);
  const seen = new Uint8Array(subject.length);
  for (let start = 0; start < solid.length; start++) {
    if (!solid[start] || seen[start]) continue;
    let head = 0, tail = 0, touches = false;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const i = queue[head++];
      if (near[i]) touches = true;
      const x = i % width, y = (i - x) / width;
      const neighbours = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
      for (const n of neighbours) {
        if (n >= 0 && solid[n] && !seen[n]) {
          seen[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    if (touches) for (let k = 0; k < tail; k++) result[queue[k]] = candidate[queue[k]];
  }
  return result;
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

/**
 * Fills enclosed holes smaller than `maxArea` pixels. Models sometimes paint small light parts of the
 * subject (white artwork on a bag, teeth on a printed mascot) in the background colour; those show up
 * as specks fully surrounded by subject. Larger enclosed holes, such as the space inside a bag handle,
 * are real and stay transparent. Holes touching the image border are never filled.
 */
function fillSmallEnclosedHoles(solid: Uint8Array, width: number, height: number, maxArea: number) {
  const seen = new Uint8Array(solid.length);
  const queue = new Int32Array(solid.length);
  for (let start = 0; start < solid.length; start++) {
    if (solid[start] || seen[start]) continue;
    let head = 0, tail = 0, touchesBorder = false;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const i = queue[head++];
      const x = i % width, y = (i - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      const neighbours = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
      for (const n of neighbours) {
        if (n >= 0 && !solid[n] && !seen[n]) {
          seen[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    if (!touchesBorder && tail <= maxArea) for (let k = 0; k < tail; k++) solid[queue[k]] = 1;
  }
}

/** Drops detached subject fragments smaller than `maxArea` pixels (stray bits of background the segmentation kept). */
function removeSmallIslands(solid: Uint8Array, width: number, height: number, maxArea: number) {
  const seen = new Uint8Array(solid.length);
  const queue = new Int32Array(solid.length);
  for (let start = 0; start < solid.length; start++) {
    if (!solid[start] || seen[start]) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const i = queue[head++];
      const x = i % width, y = (i - x) / width;
      const neighbours = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
      for (const n of neighbours) {
        if (n >= 0 && solid[n] && !seen[n]) {
          seen[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    if (tail <= maxArea) for (let k = 0; k < tail; k++) solid[queue[k]] = 0;
  }
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
