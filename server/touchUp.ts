import sharp from "sharp";

const MAX_TOUCH_UP_SIDE = 4096;

/**
 * Checks a manually touched-up result before it replaces a saved image: it must be a real PNG
 * (the browser editor exports PNG to keep transparency) of a sensible size.
 */
export async function isValidTouchUpPng(buffer: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(buffer).metadata();
    return meta.format === "png" && Boolean(meta.width && meta.height) && meta.width! <= MAX_TOUCH_UP_SIDE && meta.height! <= MAX_TOUCH_UP_SIDE;
  } catch {
    return false;
  }
}
