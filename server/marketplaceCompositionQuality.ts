import sharp from "sharp";
import { invokeLLM } from "./_core/llm";
import { getMarketplaceLifestyleSceneCorrection, MARKETPLACE_LIFESTYLE_STYLES, type MarketplaceImageRole, type MarketplaceLifestyleStyle } from "@shared/marketplaceSuites";

export type MarketplaceCompositionAssessment = {
  whiteRatio: number;
  edgeWhiteRatio: number;
  signature: string;
  shouldRetry: boolean;
  warning?: string;
  correction?: string;
};

export type MarketplaceLifestyleSceneAssessment = {
  sceneClearlyVisible: boolean;
  matchesSelectedStyle: boolean;
  looksLikeStudioOrIsolatedProduct: boolean;
  conciseReason: string;
};

const SAMPLE_SIZE = 48;

function pixelIsNearWhite(red: number, green: number, blue: number) {
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  return high >= 228 && high - low <= 24;
}

function signatureDistance(left: string, right: string) {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  let differences = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) differences += 1;
  }
  return differences / Math.max(1, left.length);
}

function roleCorrection(role: MarketplaceImageRole, reason: "white" | "duplicate", lifestyleStyle?: MarketplaceLifestyleStyle) {
  const duplicateLead = reason === "duplicate"
    ? "Do not reproduce the camera framing, crop, lighting or background of the earlier output."
    : "Do not return an isolated front-facing product on a pure or near-white seamless background.";

  if (role === "studio") {
    return `${duplicateLead} Use a visibly different three-quarter camera angle and a softly lit, non-white studio setting with realistic depth and contact shadow.`;
  }
  if (role === "detail") {
    return `${duplicateLead} Create a tight close-up of one real visible label, cap, material, texture or construction detail so that the product detail fills most of the canvas.`;
  }
  if (role === "lifestyle") {
    const settingInstruction = getMarketplaceLifestyleSceneCorrection(lifestyleStyle ?? "auto");
    return `${duplicateLead} ${settingInstruction} Keep the exact product dominant.`;
  }
  return "Keep the compliant catalog main-image composition.";
}

function getTextResponseContent(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isLifestyleSceneAssessment(value: unknown): value is MarketplaceLifestyleSceneAssessment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketplaceLifestyleSceneAssessment>;
  return typeof candidate.sceneClearlyVisible === "boolean"
    && typeof candidate.matchesSelectedStyle === "boolean"
    && typeof candidate.looksLikeStudioOrIsolatedProduct === "boolean"
    && typeof candidate.conciseReason === "string";
}

/** Best-effort semantic validation for the one lifestyle asset in a suite. */
export async function assessMarketplaceLifestyleScene(input: {
  imageBuffer: Buffer;
  lifestyleStyle?: MarketplaceLifestyleStyle;
}): Promise<MarketplaceLifestyleSceneAssessment | undefined> {
  try {
    const preview = await sharp(input.imageBuffer)
      .rotate()
      .resize(768, 768, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 76, mozjpeg: true })
      .toBuffer();
    const style = input.lifestyleStyle ?? "auto";
    const response = await invokeLLM({
      model: "gpt-5-mini",
      max_tokens: 320,
      reasoning: { effort: "minimal" },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "marketplace_lifestyle_scene_check",
          strict: true,
          schema: {
            type: "object",
            properties: {
              sceneClearlyVisible: { type: "boolean" },
              matchesSelectedStyle: { type: "boolean" },
              looksLikeStudioOrIsolatedProduct: { type: "boolean" },
              conciseReason: { type: "string" },
            },
            required: ["sceneClearlyVisible", "matchesSelectedStyle", "looksLikeStudioOrIsolatedProduct", "conciseReason"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content: "Assess only visible composition. Do not infer product specifications, claims, accessories or performance. Return only the requested JSON.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `This is a marketplace lifestyle image. The merchant selected: ${MARKETPLACE_LIFESTYLE_STYLES[style].label}. Decide whether the image visibly shows a recognisable real-world scene and whether it matches that selected style. A seamless studio backdrop, neutral display plinth, isolated product cutout, white/near-white catalog treatment or a scene belonging to a different selected style must fail. For Automatic, accept any clearly recognisable real-world non-studio setting. Keep the reason concise and describe only visible composition.`,
            },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${preview.toString("base64")}`, detail: "low" } },
          ],
        },
      ],
    });
    const content = getTextResponseContent(response.choices[0]?.message.content);
    const parsed: unknown = JSON.parse(content);
    return isLifestyleSceneAssessment(parsed) ? parsed : undefined;
  } catch (error) {
    console.warn("[iwantphoto marketplace] lifestyle visual quality check unavailable", {
      category: error instanceof Error && /json/i.test(error.message) ? "invalid_response" : "provider_unavailable",
    });
    return undefined;
  }
}

export async function assessMarketplaceComposition(input: {
  imageBuffer: Buffer;
  role: MarketplaceImageRole;
  lifestyleStyle?: MarketplaceLifestyleStyle;
  priorSignatures?: string[];
}): Promise<MarketplaceCompositionAssessment> {
  const rgb = await sharp(input.imageBuffer)
    .rotate()
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  let nearWhitePixels = 0;
  let edgeNearWhitePixels = 0;
  let edgePixels = 0;
  const grayscale: number[] = [];
  for (let offset = 0; offset < rgb.length; offset += 3) {
    const red = rgb[offset] ?? 0;
    const green = rgb[offset + 1] ?? 0;
    const blue = rgb[offset + 2] ?? 0;
    const isNearWhite = pixelIsNearWhite(red, green, blue);
    if (isNearWhite) nearWhitePixels += 1;
    const pixelIndex = offset / 3;
    const x = pixelIndex % SAMPLE_SIZE;
    const y = Math.floor(pixelIndex / SAMPLE_SIZE);
    const isEdge = x < 6 || x >= SAMPLE_SIZE - 6 || y < 6 || y >= SAMPLE_SIZE - 6;
    if (isEdge) {
      edgePixels += 1;
      if (isNearWhite) edgeNearWhitePixels += 1;
    }
    grayscale.push(Math.round(red * 0.299 + green * 0.587 + blue * 0.114));
  }

  const average = grayscale.reduce((sum, value) => sum + value, 0) / grayscale.length;
  const signature = grayscale.map((value) => (value >= average ? "1" : "0")).join("");
  const whiteRatio = nearWhitePixels / grayscale.length;
  const edgeWhiteRatio = edgeNearWhitePixels / Math.max(1, edgePixels);
  const duplicate = input.priorSignatures?.some((prior) => signatureDistance(prior, signature) < 0.035) ?? false;
  const whiteThreshold = input.role === "lifestyle" ? 0.6 : input.role === "detail" ? 0.88 : 0.95;
  const shouldRejectWhiteTreatment = input.role !== "main" && (whiteRatio >= whiteThreshold || (input.role === "lifestyle" && edgeWhiteRatio >= 0.82));

  if (duplicate) {
    return {
      whiteRatio,
      edgeWhiteRatio,
      signature,
      shouldRetry: true,
      warning: "此圖片與另一張套組成品過於相似，未能清楚呈現指定構圖。",
      correction: roleCorrection(input.role, "duplicate", input.lifestyleStyle),
    };
  }

  if (shouldRejectWhiteTreatment) {
    return {
      whiteRatio,
      edgeWhiteRatio,
      signature,
      shouldRetry: true,
      warning: input.role === "lifestyle"
        ? "情境圖仍過於像白底主圖，未能呈現足夠的真實場景。"
        : "這張輔助圖片仍過於像白底主圖，未能清楚呈現指定構圖。",
      correction: roleCorrection(input.role, "white", input.lifestyleStyle),
    };
  }

  return { whiteRatio, edgeWhiteRatio, signature, shouldRetry: false };
}

export function getMarketplaceRoleCompositionCorrection(role: MarketplaceImageRole, lifestyleStyle?: MarketplaceLifestyleStyle) {
  return roleCorrection(role, "duplicate", lifestyleStyle);
}

/** The generated asset is optional quality-checked; a failed inspection never discards a completed model output. */
export async function inspectMarketplaceCompositionFromUrl(input: {
  imageUrl: string;
  role: MarketplaceImageRole;
  lifestyleStyle?: MarketplaceLifestyleStyle;
  priorSignatures?: string[];
}) {
  try {
    const response = await fetch(input.imageUrl);
    if (!response.ok) return undefined;
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 25 * 1024 * 1024) return undefined;
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    if (!imageBuffer.length || imageBuffer.length > 25 * 1024 * 1024) return undefined;
    const assessment = await assessMarketplaceComposition({ imageBuffer, role: input.role, lifestyleStyle: input.lifestyleStyle, priorSignatures: input.priorSignatures });
    if (input.role !== "lifestyle" || assessment.shouldRetry) return assessment;

    const scene = await assessMarketplaceLifestyleScene({ imageBuffer, lifestyleStyle: input.lifestyleStyle });
    const scenePassed = scene?.sceneClearlyVisible && scene.matchesSelectedStyle && !scene.looksLikeStudioOrIsolatedProduct;
    if (scene && !scenePassed) {
      return {
        ...assessment,
        shouldRetry: true,
        warning: "情境圖未能清楚呈現你選擇的場景，系統已要求以相同產品免費重新建立一次。",
        correction: roleCorrection("lifestyle", "white", input.lifestyleStyle),
      };
    }
    return assessment;
  } catch {
    return undefined;
  }
}
