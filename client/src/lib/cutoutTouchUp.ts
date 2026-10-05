export type TouchUpTool = "restore" | "erase";

export type Point = { x: number; y: number };

/**
 * URL the editor can draw onto a canvas and read back. Stored results (`/manus-storage/...`) normally
 * redirect to the bucket on another origin, which would taint the canvas, so they are requested inline.
 */
export function touchUpSourceUrl(url: string) {
  if (!url.startsWith("/manus-storage/")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}inline=1`;
}

/** Pixel rectangle covered by a round brush stroke from `from` to `to`, clamped to the canvas. */
export function strokeBounds(from: Point, to: Point, radius: number, width: number, height: number) {
  const left = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius - 1));
  const top = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius - 1));
  const right = Math.min(width, Math.ceil(Math.max(from.x, to.x) + radius + 1));
  const bottom = Math.min(height, Math.ceil(Math.max(from.y, to.y) + radius + 1));
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** Whether a result has any see-through pixel, i.e. erasing should make pixels transparent rather than white. */
export function hasTransparency(alpha: ArrayLike<number>, stride = 4, offset = 3) {
  for (let i = offset; i < alpha.length; i += stride) if (alpha[i] < 255) return true;
  return false;
}

export const MAX_TOUCH_UP_UNDO = 15;
