export type ComparisonAlignment = {
  x: number;
  y: number;
  scale: number;
};

export const DEFAULT_COMPARISON_ALIGNMENT: ComparisonAlignment = { x: 0, y: 0, scale: 1 };

const MAX_OFFSET_PERCENT = 20;
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.2;

export function updateComparisonAlignment(alignment: ComparisonAlignment, updates: Partial<ComparisonAlignment>): ComparisonAlignment {
  return {
    x: Math.max(-MAX_OFFSET_PERCENT, Math.min(MAX_OFFSET_PERCENT, updates.x ?? alignment.x)),
    y: Math.max(-MAX_OFFSET_PERCENT, Math.min(MAX_OFFSET_PERCENT, updates.y ?? alignment.y)),
    scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number((updates.scale ?? alignment.scale).toFixed(4)))),
  };
}

export function adjustComparisonAlignment(
  alignment: ComparisonAlignment,
  horizontalDelta: number,
  verticalDelta: number,
): ComparisonAlignment {
  return updateComparisonAlignment(alignment, { x: alignment.x + horizontalDelta, y: alignment.y + verticalDelta });
}

export function adjustComparisonScale(alignment: ComparisonAlignment, scaleDelta: number): ComparisonAlignment {
  return updateComparisonAlignment(alignment, { scale: alignment.scale + scaleDelta });
}

export function getComparisonAlignmentTransform(alignment: ComparisonAlignment) {
  return `translate(${alignment.x}%, ${alignment.y}%) scale(${alignment.scale})`;
}
