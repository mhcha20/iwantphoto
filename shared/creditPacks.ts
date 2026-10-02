export const CREDIT_PACKS = {
  flex_25: {
    key: "flex_25",
    name: "Flex 25",
    credits: 25,
    priceHkd: 90,
    priceId: "price_1UGgTgIrIlUINMylqdFNLMK6",
    audience: "偶爾交付或單次活動",
    coverage: "香港",
    pricePerCreditHkd: 3.6,
  },
  value_100: {
    key: "value_100",
    name: "Value 100",
    credits: 100,
    priceHkd: 320,
    priceId: "price_1UGgTiIrIlUINMylY6bezPU5",
    audience: "季節性上架或短期推廣",
    coverage: "香港",
    pricePerCreditHkd: 3.2,
  },
  studio_250: {
    key: "studio_250",
    name: "Studio 250",
    credits: 250,
    priceHkd: 740,
    priceId: "price_1UGgTlIrIlUINMylJU4w7A3p",
    audience: "專案交付或高峰期處理",
    coverage: "香港",
    pricePerCreditHkd: 2.96,
  },
} as const;

export type CreditPackKey = keyof typeof CREDIT_PACKS;

export function isCreditPackKey(value: string): value is CreditPackKey {
  return value in CREDIT_PACKS;
}

export function getCreditPackForStripePrice(priceId: string | null | undefined) {
  return Object.values(CREDIT_PACKS).find((pack) => pack.priceId === priceId) ?? null;
}
