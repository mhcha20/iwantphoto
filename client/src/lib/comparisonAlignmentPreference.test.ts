import { describe, expect, it } from "vitest";
import { clearComparisonAlignmentPreference, COMPARISON_ALIGNMENT_PREFERENCE_KEY, loadComparisonAlignmentPreference, parseComparisonAlignmentPreference, saveComparisonAlignmentPreference } from "./comparisonAlignmentPreference";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("comparison alignment preference", () => {
  it("saves and restores the selected X, Y, and scale values", () => {
    const storage = createStorage();
    const saved = saveComparisonAlignmentPreference({ x: 1.25, y: -0.5, scale: 1.0125 }, storage);

    expect(saved).toEqual({ x: 1.25, y: -0.5, scale: 1.0125 });
    expect(storage.getItem(COMPARISON_ALIGNMENT_PREFERENCE_KEY)).not.toBeNull();
    expect(loadComparisonAlignmentPreference(storage)).toEqual(saved);
  });

  it("rejects malformed stored preferences safely", () => {
    expect(parseComparisonAlignmentPreference("not-json")).toBeNull();
    expect(parseComparisonAlignmentPreference('{"x":1}')).toBeNull();
  });

  it("clears the saved preference without affecting the current image state", () => {
    const storage = createStorage();
    saveComparisonAlignmentPreference({ x: 0.25, y: 0, scale: 1 }, storage);
    clearComparisonAlignmentPreference(storage);

    expect(loadComparisonAlignmentPreference(storage)).toBeNull();
  });
});
