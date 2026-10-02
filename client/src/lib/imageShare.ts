const extensionByMimeType: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "jpg",
  "image/heif": "jpg",
};

export function createOutputFileName(originalFileName: string | undefined, mimeType: string) {
  const baseName = (originalFileName || "iwantphoto-image")
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "") || "iwantphoto-image";

  const extension = extensionByMimeType[mimeType] || "png";
  return `iwantphoto-${baseName}.${extension}`;
}

export async function imageUrlToShareFile(url: string, originalFileName?: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Image download failed before sharing.");
  }

  const blob = await response.blob();
  const type = blob.type || "image/png";
  return new File([blob], createOutputFileName(originalFileName, type), { type });
}

export function canUseNativeFileShare(files: File | File[], navigatorLike: Pick<Navigator, "share" | "canShare"> | undefined = typeof navigator !== "undefined" ? navigator : undefined) {
  const shareFiles = Array.isArray(files) ? files : [files];
  if (!shareFiles.length || !navigatorLike?.share) return false;
  if (!navigatorLike.canShare) return true;
  return navigatorLike.canShare({ files: shareFiles });
}
