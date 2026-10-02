import { DEFAULT_COMPARISON_ALIGNMENT, updateComparisonAlignment, type ComparisonAlignment } from "./imageAlignment";

export const COMPARISON_ALIGNMENT_PREFERENCE_KEY = "iwantphoto.comparison-alignment-preference.v1";

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem" | "removeItem">;

export function parseComparisonAlignmentPreference(value: string | null): ComparisonAlignment | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ComparisonAlignment>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number" || typeof parsed.scale !== "number") return null;
    return updateComparisonAlignment(DEFAULT_COMPARISON_ALIGNMENT, parsed);
  } catch {
    return null;
  }
}

export function loadComparisonAlignmentPreference(storage?: StorageReader): ComparisonAlignment | null {
  if (!storage) return null;
  try {
    return parseComparisonAlignmentPreference(storage.getItem(COMPARISON_ALIGNMENT_PREFERENCE_KEY));
  } catch {
    return null;
  }
}

export function saveComparisonAlignmentPreference(alignment: ComparisonAlignment, storage?: StorageWriter) {
  const normalized = updateComparisonAlignment(DEFAULT_COMPARISON_ALIGNMENT, alignment);
  if (storage) {
    try {
      storage.setItem(COMPARISON_ALIGNMENT_PREFERENCE_KEY, JSON.stringify(normalized));
    } catch {
      // A blocked browser storage setting should not stop local image editing.
    }
  }
  return normalized;
}

export function clearComparisonAlignmentPreference(storage?: StorageWriter) {
  if (!storage) return;
  try {
    storage.removeItem(COMPARISON_ALIGNMENT_PREFERENCE_KEY);
  } catch {
    // A blocked browser storage setting should not stop local image editing.
  }
}
