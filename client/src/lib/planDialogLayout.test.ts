import { describe, expect, it } from "vitest";
import { PLAN_DIALOG_CONTAINER_CLASS, PLAN_DIALOG_SCROLL_BODY_CLASS, supportsCompletePlanDialogView } from "./planDialogLayout";

describe("mobile plan dialog layout", () => {
  it("keeps the dialog inside the small viewport and makes its content independently scrollable", () => {
    expect(supportsCompletePlanDialogView(PLAN_DIALOG_CONTAINER_CLASS, PLAN_DIALOG_SCROLL_BODY_CLASS)).toBe(true);
    expect(PLAN_DIALOG_CONTAINER_CLASS).toContain("max-h-[calc(100svh-1rem)]");
    expect(PLAN_DIALOG_SCROLL_BODY_CLASS).toContain("overflow-y-auto");
  });
});
