import { invokeLLM } from "./_core/llm";
import { MARKETPLACE_CHANNELS, type MarketplaceChannel } from "@shared/marketplaceSuites";
import { normaliseBriefLines, type ConfirmedMarketplaceProductBrief } from "@shared/marketplaceProductBrief";
import { normaliseMarketplaceListingCopy, type MarketplaceListingCopy } from "@shared/marketplaceListingCopy";
import { getThailandMarketplaceListingRequirements } from "@shared/thailandMarketplaceListing";

const LISTING_COPY_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    bullets: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
    reviewNotes: { type: "array", items: { type: "string" } },
  },
  required: ["title", "bullets", "reviewNotes"],
  additionalProperties: false,
} as const;

function readListingCopyResponse(content: string | Array<unknown>, channel: MarketplaceChannel): MarketplaceListingCopy {
  if (typeof content !== "string") throw new Error("AI listing copy contained no text");
  const normalizedContent = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return normaliseMarketplaceListingCopy(JSON.parse(normalizedContent) as Partial<MarketplaceListingCopy>, channel);
}

export async function draftMarketplaceListingCopy(input: { channel: MarketplaceChannel; productBrief: ConfirmedMarketplaceProductBrief }) {
  const { channel, productBrief } = input;
  const facts = normaliseBriefLines(productBrief.confirmedFacts);
  const highlights = normaliseBriefLines(productBrief.visualHighlights);
  const useCases = normaliseBriefLines(productBrief.usageIdeas);
  const channelLabel = MARKETPLACE_CHANNELS[channel].label;
  const thailandRequirements = getThailandMarketplaceListingRequirements(channel);
  const languageInstruction = thailandRequirements
    ? `Respond only in natural, professional Thai as the required JSON schema. Keep the title at or below ${thailandRequirements.titleLimit} characters. ${thailandRequirements.titleHint} ${thailandRequirements.descriptionHint}`
    : "Respond only in Traditional Chinese as the required JSON schema.";

  const result = await invokeLLM({
    model: "gpt-5-mini",
    reasoning: { effort: "minimal" },
    messages: [
      {
        role: "system",
        content: `You write conservative listing-copy drafts for e-commerce merchants. ${languageInstruction} Every statement must be traceable to the merchant-approved brief. Do not infer dimensions, capacity, materials, package count, compatibility, safety, certifications, performance, prices, delivery, discounts, warranties, rankings, competitors, brands, trademarks, labels, accessories or product claims. Do not include emojis, calls-to-action, hashtags, promotional language or marketplace-policy guarantees. Make the title compact and descriptive. Produce exactly five concise bullets. If the merchant supplied fewer than five distinct facts, use neutral factual restatements rather than introducing a claim. Put any ambiguity or needed merchant verification into reviewNotes rather than the title or bullets.`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: [
            `Create a draft for ${channelLabel}.`,
            `Confirmed product name: ${productBrief.productName.trim()}.`,
            `Confirmed description: ${productBrief.summary.trim()}.`,
            `Confirmed factual details: ${facts.length ? facts.join(" | ") : "None supplied"}.`,
            `Merchant-approved supplementary callouts: ${highlights.length ? highlights.join(" | ") : "None supplied"}.`,
            `Merchant-approved contexts: ${useCases.length ? useCases.join(" | ") : "None supplied"}.`,
            "Return a title and exactly five bullets using only these confirmed details, followed by concise review notes when merchant verification remains necessary.",
          ].join("\n") },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "marketplace_listing_copy",
        strict: true,
        schema: LISTING_COPY_SCHEMA,
      },
    },
  });

  const copy = readListingCopyResponse(result.choices[0]?.message.content ?? "", channel);
  if (!copy.title || copy.bullets.length !== 5) throw new Error("AI listing copy was incomplete");
  return copy;
}
