export function getImageAspectRatio(width: number, height: number, fallback = 4 / 3) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return fallback;
  return width / height;
}

export function getOriginalCanvasAspectRatio(originalWidth: number, originalHeight: number, fallback = 4 / 3) {
  return getImageAspectRatio(originalWidth, originalHeight, fallback);
}

export function getComparisonWidth(aspectRatio: number, maxHeight?: number) {
  if (!maxHeight) return "100%";
  return `min(100%, ${Math.round(maxHeight * aspectRatio)}px)`;
}
