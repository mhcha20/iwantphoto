import sharp from "sharp";

export type KeyColor = "green" | "magenta";
const KEY_RGB: Record<KeyColor, [number, number, number]> = { green: [0, 255, 0], magenta: [255, 0, 255] };

/** Prompt wording for the flat key background that is later converted to real alpha. */
export const KEY_COLOR_PROMPT: Record<KeyColor, string> = {
  green: "a perfectly flat, solid, uniform pure green (#00FF00) background with no gradient, texture, vignette, floor, reflection or shadow",
  magenta: "a perfectly flat, solid, uniform pure magenta (#FF00FF) background with no gradient, texture, vignette, floor, reflection or shadow",
};

export type ImageSize = { width: number; height: number };

// Aspect ratios accepted by Gemini image models through `image_config.aspect_ratio`.
const SUPPORTED_ASPECT_RATIOS: Array<[string, number]> = [
  ["1:1", 1], ["2:3", 2 / 3], ["3:2", 3 / 2], ["3:4", 3 / 4], ["4:3", 4 / 3],
  ["4:5", 4 / 5], ["5:4", 5 / 4], ["9:16", 9 / 16], ["16:9", 16 / 9], ["21:9", 21 / 9],
];

export function nearestSupportedAspectRatio({ width, height }: ImageSize): string {
  const target = width / height;
  let best = SUPPORTED_ASPECT_RATIOS[0];
  for (const candidate of SUPPORTED_ASPECT_RATIOS) {
    if (Math.abs(Math.log(candidate[1] / target)) < Math.abs(Math.log(best[1] / target))) best = candidate;
  }
  return best[0];
}

export async function readImageSize(buffer: Buffer): Promise<ImageSize | undefined> {
  try {
    const { width, height } = await sharp(buffer).metadata();
    return width && height ? { width, height } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the key colour that the source photo uses least, so keying the
 * generated flat background cannot eat into the product itself.
 */
export async function pickKeyColor(source: Buffer): Promise<KeyColor> {
  const { data } = await sharp(source).removeAlpha().resize(96, 96, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const score: Record<KeyColor, number> = { green: 0, magenta: 0 };
  for (let i = 0; i + 2 < data.length; i += 3) {
    for (const key of ["green", "magenta"] as const) {
      const [kr, kg, kb] = KEY_RGB[key];
      const distance = Math.hypot(data[i] - kr, data[i + 1] - kg, data[i + 2] - kb);
      if (distance < 150) score[key] += 1;
    }
  }
  return score.green <= score.magenta ? "green" : "magenta";
}

/**
 * Makes the generated image match the original canvas: centre-crops any aspect
 * drift, then scales to the original resolution, never enlarging beyond what the
 * model produced.
 */
export async function fitToReferenceCanvas(image: Buffer, reference: ImageSize): Promise<Buffer> {
  const meta = await sharp(image).metadata();
  if (!meta.width || !meta.height) return image;
  const refAspect = reference.width / reference.height;
  const outAspect = meta.width / meta.height;

  let pipeline = sharp(image);
  let width = meta.width;
  let height = meta.height;
  if (Math.abs(outAspect - refAspect) / refAspect > 0.01) {
    if (outAspect > refAspect) width = Math.round(meta.height * refAspect);
    else height = Math.round(meta.width / refAspect);
    pipeline = pipeline.extract({
      left: Math.floor((meta.width - width) / 2),
      top: Math.floor((meta.height - height) / 2),
      width,
      height,
    });
  }
  const scale = Math.min(1, reference.width / width, reference.height / height);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(targetWidth / refAspect));
  return pipeline.resize(targetWidth, targetHeight, { fit: "fill" }).png().toBuffer();
}

function median(values: number[]) {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Models never paint the exact requested key colour, so measure the real background from the image border. */
function sampleBorderColor(data: Buffer, width: number, height: number): { color: [number, number, number]; uniformShare: number } {
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  const take = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    r.push(data[i]);
    g.push(data[i + 1]);
    b.push(data[i + 2]);
  };
  const step = Math.max(1, Math.floor(Math.max(width, height) / 400));
  for (let x = 0; x < width; x += step) {
    take(x, 0);
    take(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    take(0, y);
    take(width - 1, y);
  }
  const color: [number, number, number] = [median(r), median(g), median(b)];
  let close = 0;
  for (let i = 0; i < r.length; i++) {
    if (Math.hypot(r[i] - color[0], g[i] - color[1], b[i] - color[2]) < 60) close++;
  }
  return { color, uniformShare: close / r.length };
}

/** Models paint a muted tint (e.g. rgb(155,194,125)), so test the hue rather than the exact colour. */
function leansTowardKey([r, g, b]: [number, number, number], key: KeyColor) {
  return key === "green" ? g > r + 25 && g > b + 25 : r > g + 40 && b > g + 40;
}

/**
 * Converts the generated flat key-colour background into a real alpha channel
 * with soft edges and spill removal. Returns undefined when the border is not a
 * plausible key background, so the caller can fail instead of shipping a bad cut-out.
 */
export async function keyColorToAlpha(image: Buffer, key: KeyColor): Promise<Buffer | undefined> {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { color, uniformShare } = sampleBorderColor(data, info.width, info.height);
  const [br, bg, bb] = color;
  // The border must be a mostly uniform field leaning toward the key colour; otherwise the subject touches the edge or the model ignored the instruction.
  if (!leansTowardKey(color, key) || uniformShare < 0.6) return undefined;

  const FULLY_TRANSPARENT_BELOW = 30;
  const FULLY_OPAQUE_ABOVE = 90;
  for (let i = 0; i < data.length; i += 4) {
    const distance = Math.hypot(data[i] - br, data[i + 1] - bg, data[i + 2] - bb);
    const alpha = Math.min(1, Math.max(0, (distance - FULLY_TRANSPARENT_BELOW) / (FULLY_OPAQUE_ABOVE - FULLY_TRANSPARENT_BELOW)));
    data[i + 3] = Math.round(alpha * 255);
    if (alpha > 0 && alpha < 1) {
      // Edge pixels carry a tint of the key colour; pull it back toward neutral.
      if (key === "green") {
        data[i + 1] = Math.min(data[i + 1], Math.max(data[i], data[i + 2]));
      } else {
        const spill = Math.min(data[i], data[i + 2]) - data[i + 1];
        if (spill > 0) {
          data[i] -= spill;
          data[i + 2] -= spill;
        }
      }
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
