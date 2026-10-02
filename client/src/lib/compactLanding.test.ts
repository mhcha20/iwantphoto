import { describe, expect, it } from "vitest";
import { COMPACT_HOME_DEFAULTS, shouldUseCollapsedMarketingContent } from "./compactLanding";

describe("compact landing layout", () => {
  it("keeps one immediate case and moves supplemental content behind progressive disclosure", () => {
    expect(COMPACT_HOME_DEFAULTS).toMatchObject({ visibleCaseCount: 1, collapsedCaseCount: 3, workflowStepCount: 3 });
    expect(shouldUseCollapsedMarketingContent(false)).toBe(true);
    expect(shouldUseCollapsedMarketingContent(true)).toBe(false);
  });
});
