export const MARKETPLACE_DIMENSION_UNITS = ["mm", "cm", "m", "in"] as const;

export type MarketplaceDimensionUnit = typeof MARKETPLACE_DIMENSION_UNITS[number];

export type MarketplaceDimensionInput = {
  length: string;
  width: string;
  height: string;
  unit: MarketplaceDimensionUnit;
  isStructured: boolean;
};

const STRUCTURED_DIMENSIONS = /^\s*([0-9]+(?:\.\d+)?)\s*(?:×|x|X)\s*([0-9]+(?:\.\d+)?)\s*(?:×|x|X)\s*([0-9]+(?:\.\d+)?)\s*(mm|cm|m|in)\s*$/i;

function normaliseNumber(value: string) {
  return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 12);
}

export function parseMarketplaceDimensions(value: string | undefined | null): MarketplaceDimensionInput {
  const source = value?.trim() ?? "";
  const match = source.match(STRUCTURED_DIMENSIONS);
  if (!match) {
    return { length: "", width: "", height: "", unit: "cm", isStructured: !source };
  }

  const unit = match[4]?.toLowerCase();
  return {
    length: match[1] ?? "",
    width: match[2] ?? "",
    height: match[3] ?? "",
    unit: MARKETPLACE_DIMENSION_UNITS.includes(unit as MarketplaceDimensionUnit) ? unit as MarketplaceDimensionUnit : "cm",
    isStructured: true,
  };
}

export function formatMarketplaceDimensions(input: Omit<MarketplaceDimensionInput, "isStructured">) {
  const length = normaliseNumber(input.length);
  const width = normaliseNumber(input.width);
  const height = normaliseNumber(input.height);
  const unit = MARKETPLACE_DIMENSION_UNITS.includes(input.unit) ? input.unit : "cm";
  return length && width && height ? `${length} × ${width} × ${height} ${unit}` : "";
}
