export type MarketplaceProductBrief = {
  productName: string;
  summary: string;
  /** Merchant-confirmed product weight, distinct from shipment/package weight. */
  weight: string;
  /** Merchant-confirmed product dimensions, for example `12 × 8 × 4 cm`. */
  dimensions: string;
  confirmedFacts: string[];
  visualHighlights: string[];
  usageIdeas: string[];
  reviewQuestions: string[];
};

/** A non-factual scene suggestion derived from the submitted product references. */
export type MarketplaceLifestyleRecommendation = {
  style: "auto" | "home" | "office" | "outdoor";
  reason: string;
  candidates: MarketplaceLifestyleSceneCandidate[];
  avoidStyles: Array<"home" | "office" | "outdoor">;
  avoidanceReason: string;
};

/** A non-factual art-direction option proposed from the uploaded product references. */
export type MarketplaceLifestyleSceneCandidate = {
  id: string;
  style: "auto" | "home" | "office" | "outdoor";
  title: string;
  description: string;
};

export type MarketplaceProductBriefDraft = {
  brief: MarketplaceProductBrief;
  lifestyleRecommendation: MarketplaceLifestyleRecommendation;
};

/** Legacy confirmed briefs may not yet include optional specification fields. */
export type ConfirmedMarketplaceProductBrief = Omit<MarketplaceProductBrief, "reviewQuestions" | "weight" | "dimensions"> & {
  weight?: string;
  dimensions?: string;
};

/** Presentation direction for the third verified-detail image only. */
export const MARKETPLACE_DETAIL_SPECIFICATION_LAYOUTS = {
  auto: {
    label: "自動（建議）",
    description: "讓 AI 以最清楚、最不遮擋產品的方式排版。",
    prompt: "Choose the clearest restrained information treatment for the supplied product, keeping the product dominant and the approved text highly legible.",
  },
  side_card: {
    label: "側邊資訊卡",
    description: "產品旁放置簡潔資料卡，適合包裝或完整產品照。",
    prompt: "Place one quiet, high-legibility information card beside the product, leaving the real product unobscured and dominant. Keep the card compact and do not add decorative claims.",
  },
  dimension_guide: {
    label: "尺寸導引",
    description: "以克制尺寸導引呈現已確認的長、闊、高資料。",
    prompt: "Use a restrained dimension-guide treatment adjacent to the visible product, with only the exact approved specification text. Do not infer an arrow value, annotate a product edge, or add a measurement not supplied by the merchant.",
  },
  bottom_strip: {
    label: "底部規格列",
    description: "產品保持完整，規格集中在畫面底部。",
    prompt: "Keep the product fully visible above one compact bottom specification strip. The strip may contain only the exact approved text and no price, badge, claim or call-to-action.",
  },
} as const;

export type MarketplaceDetailSpecificationLayout = keyof typeof MARKETPLACE_DETAIL_SPECIFICATION_LAYOUTS;

export function isMarketplaceDetailSpecificationLayout(value: unknown): value is MarketplaceDetailSpecificationLayout {
  return typeof value === "string" && value in MARKETPLACE_DETAIL_SPECIFICATION_LAYOUTS;
}

export const EMPTY_MARKETPLACE_PRODUCT_BRIEF: MarketplaceProductBrief = {
  productName: "",
  summary: "",
  weight: "",
  dimensions: "",
  confirmedFacts: [],
  visualHighlights: [],
  usageIdeas: [],
  reviewQuestions: [],
};

export function normaliseBriefLines(lines: string[]) {
  return lines
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 6);
}

export function normaliseMarketplaceSpecification(value: unknown, maxLength = 80) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

export function isMarketplaceProductBriefReady(brief: ConfirmedMarketplaceProductBrief) {
  return brief.productName.trim().length > 0 && brief.summary.trim().length > 0;
}

export function formatMarketplaceProductBriefForPrompt(brief?: ConfirmedMarketplaceProductBrief) {
  if (!brief) {
    return "The merchant has not supplied a confirmed product brief. Do not infer specifications, package contents, dimensions, claims, compatibility, certifications, material, capacity, safety, or copy beyond what is visually certain in the reference photograph.";
  }

  const facts = normaliseBriefLines(brief.confirmedFacts);
  const highlights = normaliseBriefLines(brief.visualHighlights);
  const useCases = normaliseBriefLines(brief.usageIdeas);
  const weight = normaliseMarketplaceSpecification(brief.weight);
  const dimensions = normaliseMarketplaceSpecification(brief.dimensions);

  return [
    "The merchant has reviewed and confirmed this product brief. It is a constraint, not permission to invent further facts.",
    `Confirmed product name: ${brief.productName.trim() || "Not supplied"}.`,
    `Confirmed description: ${brief.summary.trim() || "Not supplied"}.`,
    `Merchant-confirmed product weight: ${weight || "Not supplied"}.`,
    `Merchant-confirmed product dimensions: ${dimensions || "Not supplied"}.`,
    `Confirmed factual details: ${facts.length ? facts.join(" | ") : "None supplied"}.`,
    `Approved callouts for an additional information image only: ${highlights.length ? highlights.join(" | ") : "None supplied"}.`,
    `Approved use contexts: ${useCases.length ? useCases.join(" | ") : "None supplied"}.`,
    "Never place text, labels, measurements, claims, badges, logos, prices, discounts, certification, warranty, or call-to-action on the catalog main image. On an information image, render only short approved callout wording from the approved callouts above. Weight and dimensions may appear only when the role-specific verified specification overlay instruction explicitly permits the exact merchant-confirmed wording. Do not add or paraphrase any other product claim, number, unit or fact. If any approved wording cannot be rendered accurately, omit it and create a clean visual detail image instead.",
  ].join(" ");
}

/** Returns only the exact merchant-confirmed lines permitted in the third asset. */
export function getMarketplaceDetailSpecificationLines(brief?: ConfirmedMarketplaceProductBrief) {
  const weight = normaliseMarketplaceSpecification(brief?.weight);
  const dimensions = normaliseMarketplaceSpecification(brief?.dimensions);
  return [weight ? `重量：${weight}` : "", dimensions ? `尺寸：${dimensions}` : ""].filter(Boolean);
}

/** Applies the merchant-confirmed numeric specifications only to the third detail asset. */
export function formatMarketplaceDetailSpecificationOverlay(
  brief?: ConfirmedMarketplaceProductBrief,
  requestedLayout: MarketplaceDetailSpecificationLayout = "auto",
) {
  const approvedLines = getMarketplaceDetailSpecificationLines(brief);

  if (!approvedLines.length) {
    return "No merchant-confirmed product weight or dimensions were supplied. Do not render any weight, measurements, arrows, dimension guide, numeric units or specification overlay in this image.";
  }

  const layout = isMarketplaceDetailSpecificationLayout(requestedLayout) ? requestedLayout : "auto";
  const layoutInstruction = MARKETPLACE_DETAIL_SPECIFICATION_LAYOUTS[layout].prompt;

  return [
    "VERIFIED SPECIFICATION OVERLAY — this applies to the third VERIFIED DETAIL image only.",
    "Create a clean supplementary product-information composition that keeps the real product clearly visible and dominant.",
    `Render these exact merchant-confirmed Traditional Chinese lines, without translation, rounding, abbreviation, reordering or extra numbers: ${approvedLines.join(" | ")}.`,
    `Merchant-selected layout: ${MARKETPLACE_DETAIL_SPECIFICATION_LAYOUTS[layout].label}. ${layoutInstruction}`,
    "Do not add prices, discounts, performance claims, certifications, capacity, package contents, extra dimensions, arrow labels, brand taglines or any unconfirmed wording.",
  ].join(" ");
}
