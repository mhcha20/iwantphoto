export function constrainComparisonPosition(value: number, minimum = 4, maximum = 96) {
  return Math.min(maximum, Math.max(minimum, value));
}
