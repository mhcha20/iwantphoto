export type ImagePreviewMode = "original" | "processed";

export function selectImagePreviewUrl(
  originalUrl: string | undefined,
  processedUrl: string | undefined,
  mode: ImagePreviewMode,
) {
  if (mode === "processed" && processedUrl) return processedUrl;
  return originalUrl;
}
