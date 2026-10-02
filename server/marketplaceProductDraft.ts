import sharp from "sharp";
import { invokeLLM } from "./_core/llm";
import { EMPTY_MARKETPLACE_PRODUCT_BRIEF, normaliseBriefLines, type MarketplaceLifestyleRecommendation, type MarketplaceLifestyleSceneCandidate, type MarketplaceProductBrief, type MarketplaceProductBriefDraft } from "@shared/marketplaceProductBrief";

const PRODUCT_BRIEF_SCHEMA = {
  type: "object",
  properties: {
    brief: {
      type: "object",
      properties: {
        productName: { type: "string" },
        summary: { type: "string" },
        weight: { type: "string" },
        dimensions: { type: "string" },
        confirmedFacts: { type: "array", items: { type: "string" } },
        visualHighlights: { type: "array", items: { type: "string" } },
        usageIdeas: { type: "array", items: { type: "string" } },
        reviewQuestions: { type: "array", items: { type: "string" } },
      },
      required: ["productName", "summary", "weight", "dimensions", "confirmedFacts", "visualHighlights", "usageIdeas", "reviewQuestions"],
      additionalProperties: false,
    },
    lifestyleRecommendation: {
      type: "object",
      properties: {
        style: { type: "string", enum: ["auto", "home", "office", "outdoor"] },
        reason: { type: "string" },
        candidates: {
          type: "array",
          minItems: 2,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              style: { type: "string", enum: ["auto", "home", "office", "outdoor"] },
              title: { type: "string" },
              description: { type: "string" },
            },
            required: ["id", "style", "title", "description"],
            additionalProperties: false,
          },
        },
        avoidStyles: { type: "array", items: { type: "string", enum: ["home", "office", "outdoor"] }, maxItems: 2 },
        avoidanceReason: { type: "string" },
      },
      required: ["style", "reason", "candidates", "avoidStyles", "avoidanceReason"],
      additionalProperties: false,
    },
  },
  required: ["brief", "lifestyleRecommendation"],
  additionalProperties: false,
} as const;

type ProductReference = { buffer: Buffer; mimeType: string };

const LIFESTYLE_STYLES = ["auto", "home", "office", "outdoor"] as const;
const SPECIFIC_LIFESTYLE_STYLES = ["home", "office", "outdoor"] as const;
type LifestyleStyle = typeof LIFESTYLE_STYLES[number];

function isLifestyleStyle(value: unknown): value is LifestyleStyle {
  return typeof value === "string" && (LIFESTYLE_STYLES as readonly string[]).includes(value);
}

function isSpecificLifestyleStyle(value: unknown): value is typeof SPECIFIC_LIFESTYLE_STYLES[number] {
  return typeof value === "string" && (SPECIFIC_LIFESTYLE_STYLES as readonly string[]).includes(value);
}

const FALLBACK_SCENES: Record<LifestyleStyle, MarketplaceLifestyleSceneCandidate[]> = {
  auto: [
    { id: "auto-natural-interior", style: "auto", title: "自然日光室內一角", description: "以可辨識、克制的真實室內背景突顯產品，不預設特定用途。" },
    { id: "auto-textured-surface", style: "auto", title: "質感檯面近景", description: "以非白底的日常表面和環境深度呈現產品。" },
  ],
  home: [
    { id: "home-storage-shelf", style: "home", title: "家居收納架", description: "以整理好的家居層架或櫃面作背景，產品保持主角。" },
    { id: "home-countertop", style: "home", title: "自然光家居檯面", description: "以有家居層次的檯面及柔和自然光呈現。" },
  ],
  office: [
    { id: "office-work-desk", style: "office", title: "整潔工作桌", description: "以有工作物件深度的桌面呈現，不加入未確認配件。" },
    { id: "office-shelf", style: "office", title: "辦公收納層架", description: "以專業工作空間的層架或櫃面作克制背景。" },
  ],
  outdoor: [
    { id: "outdoor-patio", style: "outdoor", title: "自然日光露台", description: "以真實戶外檯面、欄杆或植栽深度呈現，避免室內替代。" },
    { id: "outdoor-garden", style: "outdoor", title: "花園木質檯面", description: "以可辨識的花園或木質戶外表面呈現，不宣稱產品耐候性。" },
  ],
};

function normaliseSceneCandidate(value: unknown, index: number, fallbackStyle: LifestyleStyle): MarketplaceLifestyleSceneCandidate | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<MarketplaceLifestyleSceneCandidate>;
  const style = isLifestyleStyle(raw.style) ? raw.style : fallbackStyle;
  const title = typeof raw.title === "string" ? raw.title.trim().replace(/\s+/g, " ").slice(0, 48) : "";
  const description = typeof raw.description === "string" ? raw.description.trim().replace(/\s+/g, " ").slice(0, 140) : "";
  if (!title || !description) return undefined;
  const sourceId = typeof raw.id === "string" ? raw.id.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : "";
  return { id: sourceId.slice(0, 48) || `scene-${index + 1}`, style, title, description };
}

function normaliseLifestyleRecommendation(value: unknown): MarketplaceLifestyleRecommendation {
  const raw = value && typeof value === "object" ? value as Partial<MarketplaceLifestyleRecommendation> : undefined;
  const style = isLifestyleStyle(raw?.style) ? raw.style : "auto";
  const candidates = Array.isArray(raw?.candidates)
    ? raw.candidates.map((candidate, index) => normaliseSceneCandidate(candidate, index, style)).filter((candidate): candidate is MarketplaceLifestyleSceneCandidate => Boolean(candidate)).slice(0, 3)
    : [];
  const uniqueCandidates = candidates.filter((candidate, index) => candidates.findIndex((current) => current.id === candidate.id) === index);
  const safeCandidates = uniqueCandidates.length >= 2 ? uniqueCandidates : FALLBACK_SCENES[style];
  const primaryCandidates = safeCandidates.filter((candidate) => candidate.style === style);
  const alternativeCandidates = safeCandidates.filter((candidate) => candidate.style !== style);
  const orderedCandidates = primaryCandidates.length
    ? [...primaryCandidates, ...alternativeCandidates]
    : [FALLBACK_SCENES[style][0], ...safeCandidates].filter((candidate): candidate is MarketplaceLifestyleSceneCandidate => Boolean(candidate)).slice(0, 3);
  const avoidStyles = Array.isArray(raw?.avoidStyles)
    ? raw.avoidStyles.filter(isSpecificLifestyleStyle).filter((candidate, index, values) => values.indexOf(candidate) === index).filter((candidate) => candidate !== style).slice(0, 2)
    : [];
  return {
    style,
    reason: typeof raw?.reason === "string" ? raw.reason.trim().replace(/\s+/g, " ").slice(0, 180) : "根據目前相片與已確認用途，建議先以自動情境生成。",
    candidates: orderedCandidates,
    avoidStyles,
    avoidanceReason: avoidStyles.length && typeof raw?.avoidanceReason === "string"
      ? raw.avoidanceReason.trim().replace(/\s+/g, " ").slice(0, 160)
      : "沒有足夠可核實資料時，系統不會強制禁止其他情境；請由商戶最後確認。",
  };
}

function readDraftResponse(content: string | Array<unknown>): MarketplaceProductBriefDraft {
  if (typeof content !== "string") throw new Error("AI product brief contained no text");
  const normalizedContent = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(normalizedContent) as { brief?: Partial<MarketplaceProductBrief>; lifestyleRecommendation?: unknown };
  const brief = parsed.brief ?? {};

  return {
    brief: {
      productName: typeof brief.productName === "string" ? brief.productName.trim().slice(0, 100) : "",
      summary: typeof brief.summary === "string" ? brief.summary.trim().slice(0, 600) : "",
      weight: typeof brief.weight === "string" ? brief.weight.trim().replace(/\s+/g, " ").slice(0, 80) : "",
      dimensions: typeof brief.dimensions === "string" ? brief.dimensions.trim().replace(/\s+/g, " ").slice(0, 80) : "",
      confirmedFacts: normaliseBriefLines(Array.isArray(brief.confirmedFacts) ? brief.confirmedFacts.filter((value): value is string => typeof value === "string") : []),
      visualHighlights: normaliseBriefLines(Array.isArray(brief.visualHighlights) ? brief.visualHighlights.filter((value): value is string => typeof value === "string") : []),
      usageIdeas: normaliseBriefLines(Array.isArray(brief.usageIdeas) ? brief.usageIdeas.filter((value): value is string => typeof value === "string") : []),
      reviewQuestions: normaliseBriefLines(Array.isArray(brief.reviewQuestions) ? brief.reviewQuestions.filter((value): value is string => typeof value === "string") : []),
    },
    lifestyleRecommendation: normaliseLifestyleRecommendation(parsed.lifestyleRecommendation),
  };
}

/**
 * Creates a compact, user-editable draft from one to three actual product
 * references. Each angle remains evidence only; ambiguous differences become
 * review questions rather than an inferred catalogue claim.
 */
export async function draftMarketplaceProductBrief(input: {
  references: ProductReference[];
  currentBrief?: MarketplaceProductBrief;
  revisionInstruction?: string;
}) {
  const references = input.references.slice(0, 3);
  if (!references.length) return { brief: EMPTY_MARKETPLACE_PRODUCT_BRIEF, lifestyleRecommendation: normaliseLifestyleRecommendation(undefined) };
  const compactImages = await Promise.all(references.map(async (reference) => sharp(reference.buffer, { failOn: "error" })
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()));
  const imageInputs = compactImages.filter((image) => image.length).map((image) => ({
    type: "image_url" as const,
    image_url: { url: `data:image/jpeg;base64,${image.toString("base64")}`, detail: "low" as const },
  }));
  if (!imageInputs.length) return { brief: EMPTY_MARKETPLACE_PRODUCT_BRIEF, lifestyleRecommendation: normaliseLifestyleRecommendation(undefined) };
  const revisionInstruction = input.revisionInstruction?.trim().slice(0, 500) ?? "";
  const currentBrief = input.currentBrief;
  const currentBriefContext = currentBrief
    ? [
      "Here is the current editable draft. It is unverified working text, not evidence. Retain it only when it agrees with the supplied images or the merchant's revision request:",
      `Current name: ${currentBrief.productName.trim() || "(empty)"}`,
      `Current summary: ${currentBrief.summary.trim() || "(empty)"}`,
      `Current product weight: ${currentBrief.weight?.trim() || "(empty)"}`,
      `Current product dimensions: ${currentBrief.dimensions?.trim() || "(empty)"}`,
      `Current visible facts: ${normaliseBriefLines(currentBrief.confirmedFacts).join(" | ") || "(empty)"}`,
      `Current visual callouts: ${normaliseBriefLines(currentBrief.visualHighlights).join(" | ") || "(empty)"}`,
      `Current usage contexts: ${normaliseBriefLines(currentBrief.usageIdeas).join(" | ") || "(empty)"}`,
      `Current review questions: ${normaliseBriefLines(currentBrief.reviewQuestions).join(" | ") || "(empty)"}`,
    ].join("\n")
    : "";
  const revisionContext = revisionInstruction
    ? `The merchant asks for this revision: ${revisionInstruction}\nApply the request only when it is supported by the images or provides clearly stated copy preference. Never treat a request as proof of a product claim, dosage, capacity, certification, ingredient, compatibility, package count or safety statement. Put unsupported requested facts into reviewQuestions instead.`
    : "";

  const result = await invokeLLM({
    model: "gemini-3-flash-preview",
    // Gemini includes internal reasoning in its token budget. A short 900-token
    // ceiling can truncate a valid JSON-schema response before its closing brace.
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: "You create a conservative product-brief draft for an e-commerce merchant. By default, respond in Traditional Chinese. If the merchant explicitly asks to translate the brief into English, Simplified Chinese, Japanese, or Thai, translate every editable brief field into that requested language, including review questions; do not mix languages. Keep every lifestyleRecommendation field in Traditional Chinese because it is workspace guidance, not product copy. Treat every image as evidence, not a catalogue. The images may show the same SKU from different angles; reconcile only clearly consistent visible details. Never invent dimensions, weight, capacity, material, safety, medical, temperature, compatibility, certification, package count, included accessory, product claim, brand, logo, label text or use case. Return weight and dimensions as separate editable strings only when the exact value and unit are plainly printed and unambiguous in the supplied image or merchant-provided current draft. Never estimate from pixels, product category or comparison objects. Otherwise return an empty string for that field and add a short review question asking the merchant to confirm it. If a fact is unclear or images conflict, do not state it as true; add a short review question instead. Keep the product name neutral and descriptive. The summary must be concise. confirmedFacts must contain only plainly visible observations. visualHighlights must contain only visual features a merchant can verify before publishing. usageIdeas must be cautious scene suggestions, not performance claims. Also provide lifestyleRecommendation. Choose its primary style (home, office, outdoor, or auto) only from the visible product, merchant-confirmed use contexts and whether placing it there would be plausible. Choose auto whenever evidence is ambiguous or a specific setting would imply an unverified use. Provide 2 or 3 candidate scene concepts. Every candidate must be a visibly distinct scene subtype within a plausible style; its title and description describe only non-sold environment, camera context and light, never a product claim or unseen accessory. Provide avoidStyles only for Home, Office or Outdoor when a setting is clearly inappropriate based on the product's visibly plausible context; do not prohibit based on stereotypes or unknown performance. avoidanceReason must be short and non-factual. This is an editable draft and the merchant must confirm every field before image generation. A merchant may request a revised writing style, a translation, or corrections. Honor the writing request while maintaining every evidence and product-safety restriction.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: [`Review these ${imageInputs.length} uploaded reference photo${imageInputs.length === 1 ? "" : "s"} of one product SKU and return the conservative editable product brief.`, currentBriefContext, revisionContext].filter(Boolean).join("\n\n") },
          ...imageInputs,
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "marketplace_product_brief",
        strict: true,
        schema: PRODUCT_BRIEF_SCHEMA,
      },
    },
  });

  return readDraftResponse(result.choices[0]?.message.content ?? "");
}
