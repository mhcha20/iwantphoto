export const COMPACT_HOME_DEFAULTS = {
  visibleCaseCount: 1,
  collapsedCaseCount: 3,
  workflowStepCount: 3,
} as const;

export function shouldUseCollapsedMarketingContent(expanded: boolean) {
  return !expanded;
}
