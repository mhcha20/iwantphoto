export type EditorPreviewView = "single" | "compare";

export function canShowImageComparison(processedUrl?: string) {
  return Boolean(processedUrl);
}

export function shouldShowImageComparison(view: EditorPreviewView, processedUrl?: string) {
  return view === "compare" && canShowImageComparison(processedUrl);
}

export function returnToOriginalPreview() {
  return { view: "single" as const, preview: "original" as const };
}
