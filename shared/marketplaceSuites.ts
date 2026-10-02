import { formatMarketplaceDetailSpecificationOverlay, formatMarketplaceProductBriefForPrompt, type ConfirmedMarketplaceProductBrief, type MarketplaceDetailSpecificationLayout, type MarketplaceLifestyleSceneCandidate } from "./marketplaceProductBrief";

export const MARKETPLACE_CHANNELS = {
  amazon: {
    label: "Amazon 商品頁",
    recommendedSize: "1:1 · 2000×2000 工作母版",
    note: "主圖使用純白背景，沒有文字、徽章或水印。",
  },
  instagram: {
    label: "Instagram Shop",
    recommendedSize: "1:1 · 1024×1024",
    note: "目錄圖片使用方形構圖，商品需準確對應實際 SKU。",
  },
  shopee: {
    label: "Shopee",
    recommendedSize: "1:1 · 1024×1024",
    note: "以實物、清晰主體和乾淨封面作為安全基線。",
  },
  lazada_th: {
    label: "Lazada Thailand",
    recommendedSize: "1:1 · 1024×1024",
    note: "以實物、清晰主體和乾淨封面作為安全基線；上架前須核對泰國類目要求。",
  },
  shopee_th: {
    label: "Shopee Thailand",
    recommendedSize: "1:1 · 1024×1024",
    note: "以實物、清晰主體和乾淨封面作為安全基線；上架前須核對店舖與泰國類目要求。",
  },
  facebook: {
    label: "Facebook Shop",
    recommendedSize: "1:1 · 1024×1024",
    note: "目錄圖片使用方形構圖，避免促銷文字和水印。",
  },
  google: {
    label: "Google Merchant Center",
    recommendedSize: "1:1 · 1500×1500 工作母版",
    note: "AI 成品會輸出為 PNG，並嵌入 Google 所需的 IPTC AI 來源中繼資料。",
  },
} as const;

export type MarketplaceChannel = keyof typeof MARKETPLACE_CHANNELS;

export type MarketplaceImageRole = "main" | "studio" | "detail" | "lifestyle";

export const MARKETPLACE_LIFESTYLE_STYLES = {
  auto: {
    label: "按產品資料自動選擇",
    description: "由已確認用途決定最合適的克制場景。",
    prompt: "Choose one clearly recognisable, real-world non-studio setting that follows the merchant-confirmed use contexts. The setting must be visibly readable from the image alone, with a plausible surface and at least two contextual environment cues. Never substitute a seamless backdrop, neutral display plinth or isolated product shot for a real setting.",
  },
  home: {
    label: "家居",
    description: "家中檯面、收納架或生活空間。",
    prompt: "Use an unmistakably home-interior setting only when it fits the merchant-confirmed use context. Place the product plausibly on a household countertop, shelf, cabinet, side table or lived-in storage area, with at least two visible domestic cues such as cabinetry, home shelving, a wall, a lamp, a sofa, a plant or household organisation. Never use a seamless studio backdrop, neutral display plinth, isolated cutout, office workstation or outdoor scene. Keep all non-product items clearly incidental and not for sale.",
  },
  office: {
    label: "辦公室",
    description: "工作桌、書架或專業工作空間。",
    prompt: "Use an unmistakably professional office or workspace setting only when it fits the merchant-confirmed use context. Place the product plausibly on a work desk, office shelf, meeting-room credenza or organised studio work surface, with at least two visible workplace cues such as a monitor, keyboard, documents, office shelving, task lamp, desk chair or stationery. Never use a seamless studio backdrop, neutral display plinth, isolated cutout, home-living area or outdoor scene. Do not imply employment use, compatibility, performance or a product claim.",
  },
  outdoor: {
    label: "戶外",
    description: "自然日光下的戶外檯面或背景。",
    prompt: "Use an unmistakably outdoor, natural-daylight setting; never substitute a near-window or indoor scene. Place the product plausibly on an outdoor patio table, balcony ledge, garden bench, stone surface or wooden deck, and show visible environmental depth with at least two secondary outdoor cues such as foliage, a railing, outdoor masonry, a sunlit planting area or open sky. Never use a seamless studio backdrop, isolated cutout, pure/near-white background or indoor room. Keep all context non-sold and secondary; do not imply weather resistance, outdoor suitability or any performance claim. Do not show people, food, medicine consumption, animals or risky activity unless explicitly confirmed.",
  },
} as const;

export type MarketplaceLifestyleStyle = keyof typeof MARKETPLACE_LIFESTYLE_STYLES;

/** A style-specific corrective brief used only when a lifestyle image fails quality inspection. */
export function getMarketplaceLifestyleSceneCorrection(style: MarketplaceLifestyleStyle = "auto") {
  if (style === "home") {
    return "The merchant explicitly selected Home: use a literal, recognisable home interior with a plausible household surface and clearly visible domestic depth, such as cabinetry, home shelving, a wall, lamp, sofa, plant or household organisation. Never use an office, outdoor, seamless or isolated-product background.";
  }
  if (style === "office") {
    return "The merchant explicitly selected Office: use a literal, recognisable professional workspace with a plausible work surface and clearly visible workplace depth, such as a desk, monitor, keyboard, documents, office shelving, task lamp, desk chair or stationery. Never use a home, outdoor, seamless or isolated-product background.";
  }
  if (style === "outdoor") {
    return "The merchant explicitly selected Outdoor: use a literal outdoor natural-daylight setting with a plausible patio, balcony, garden, stone or wooden surface and clearly visible secondary outdoor depth such as foliage, railing, outdoor masonry, planting or open sky. Never use an indoor, near-window, seamless or isolated-product background.";
  }
  return "Use one clearly recognisable, real-world non-studio setting that follows the merchant-confirmed use contexts, with a plausible surface and visible environmental depth. Never use a seamless, neutral display or isolated-product background.";
}

export function isMarketplaceLifestyleStyle(value: string): value is MarketplaceLifestyleStyle {
  return value in MARKETPLACE_LIFESTYLE_STYLES;
}

export type MarketplaceFontStyle = "clean" | "editorial" | "friendly";

export type MarketplaceBrandStyle = {
  accentColor: string;
  fontStyle: MarketplaceFontStyle;
};

export type MarketplaceBrandIdentity = MarketplaceBrandStyle & {
  name?: string;
  hasLogo?: boolean;
};

export const DEFAULT_MARKETPLACE_BRAND_STYLE: MarketplaceBrandStyle = {
  accentColor: "#176BD2",
  fontStyle: "clean",
};

export const MARKETPLACE_FONT_STYLES: Record<MarketplaceFontStyle, string> = {
  clean: "簡潔無襯線",
  editorial: "高級雜誌感",
  friendly: "親和圓角",
};

export type MarketplaceSuiteItem = {
  role: MarketplaceImageRole;
  title: string;
  description: string;
  fileSuffix: string;
  generationInstruction: string;
};

const sharedItems: Record<MarketplaceImageRole, Omit<MarketplaceSuiteItem, "title" | "description">> = {
  main: {
    role: "main",
    fileSuffix: "main",
    generationInstruction: "ROLE: CATALOG MAIN. Create the compliant catalog main image: show the exact complete sellable set from the reference, with every visible sold item included together in one clear group shot. Do not duplicate a product, create unseen pieces, or imply a pack count unless the exact pieces and arrangement are visually verifiable in the reference. Keep it fully visible, centred, with comfortable safe margins on a pure white RGB 255/255/255 background. This role alone must use the isolated white catalog treatment. No overlay text, badge, watermark, border, price, promotion, claim, logo overlay, extra prop, or second product view.",
  },
  studio: {
    role: "studio",
    fileSuffix: "studio",
    generationInstruction: "ROLE: STUDIO SUPPORTING IMAGE. Create a clearly different commercial studio photograph of the exact supplied product. Use a deliberate three-quarter or side-facing camera angle, a softly lit pale-stone, warm-grey, muted-colour or textured studio background, and a realistic contact shadow. The background must be visibly different from the pure-white catalog main image; do not return a front-on isolated bottle/product on a white seamless background. Keep the product fully visible and dominant. Do not add overlay text, badges, prices, claims, watermarks, extra sellable products, or unavailable accessories.",
  },
  detail: {
    role: "detail",
    fileSuffix: "detail",
    generationInstruction: "ROLE: VERIFIED DETAIL. Create a tight editorial close-up or restrained supplementary information composition of one real, visually verifiable part of the supplied product: for example its label, cap, material, texture, seam, control, construction or packaging finish. The product or selected detail must remain dominant and visibly closer than a full-product catalog view. This must not be another full product on a blank white background. When the confirmed brief includes approved callouts or the role-specific verified specification instruction supplies exact values, an information-card layout is allowed only for this third supplementary image. Otherwise use no text. Do not invent hidden features, certification, measurements, claims, text, logos, extra accessories, or product variants not evident in the source reference or confirmed brief.",
  },
  lifestyle: {
    role: "lifestyle",
    fileSuffix: "lifestyle",
    generationInstruction: "ROLE: LIFESTYLE SCENE. Create a clearly recognisable, believable real-world use or ownership setting for the exact supplied product. This is not a white-background product shot. Place the product naturally on a context-appropriate surface or in a subtle setting that follows the merchant-confirmed use contexts; show environmental depth, natural directional light and a visible non-white setting around the product. The product must remain sharply identifiable and visually dominant. Generic background objects may appear only as non-sold context and must not be presented as included accessories, a bundle, a health outcome, or a product claim. Do not add people, hands, food, medicine, children, animals or sensitive activities unless they are explicitly supported by the confirmed brief. Do not add overlay text, price, call-to-action, promotion, warranty, brand overlay, watermarks, claims, unavailable accessories, or product features not confirmed by the source reference.",
  },
};

const copy: Record<MarketplaceChannel, Record<MarketplaceImageRole, Pick<MarketplaceSuiteItem, "title" | "description">>> = {
  amazon: {
    main: { title: "合規白底主圖", description: "純白主圖，適合作為 MAIN image。" },
    studio: { title: "完整套裝輔助圖", description: "以乾淨棚拍展示完整銷售組合。" },
    detail: { title: "核實賣點圖", description: "展示可見細節；只使用你確認的資料作補充資訊。" },
    lifestyle: { title: "使用情境圖", description: "以克制場景說明商品使用情境。" },
  },
  instagram: {
    main: { title: "目錄白底主圖", description: "方形、清晰且準確代表銷售 SKU。" },
    studio: { title: "完整套裝圖", description: "支援商品頁的完整產品視覺。" },
    detail: { title: "核實賣點圖", description: "讓顧客檢視真實細節及已確認資料。" },
    lifestyle: { title: "商店情境圖", description: "展示真實產品在情境中的樣貌。" },
  },
  shopee: {
    main: { title: "封面白底主圖", description: "突顯實物與清晰主體的正方形封面。" },
    studio: { title: "完整套裝圖", description: "補充實物的完整銷售組合。" },
    detail: { title: "核實賣點圖", description: "展示可核對的材質、部件及已確認資料。" },
    lifestyle: { title: "使用場景圖", description: "以不誤導配件的情境呈現商品。" },
  },
  lazada_th: {
    main: { title: "泰國店舖封面圖", description: "以清晰方形構圖突出實物及完整銷售組合。" },
    studio: { title: "完整套裝圖", description: "補充實物的完整銷售組合。" },
    detail: { title: "核實賣點圖", description: "展示可核對的材質、部件及已確認資料。" },
    lifestyle: { title: "使用場景圖", description: "以不誤導配件的情境呈現商品。" },
  },
  shopee_th: {
    main: { title: "泰國店舖封面圖", description: "以清晰方形構圖突出實物及完整銷售組合。" },
    studio: { title: "完整套裝圖", description: "補充實物的完整銷售組合。" },
    detail: { title: "核實賣點圖", description: "展示可核對的材質、部件及已確認資料。" },
    lifestyle: { title: "使用場景圖", description: "以不誤導配件的情境呈現商品。" },
  },
  facebook: {
    main: { title: "Shop 主商品圖", description: "正方形目錄主圖，清楚展示完整 SKU。" },
    studio: { title: "完整套裝圖", description: "補充主圖以展示完整銷售組合。" },
    detail: { title: "核實賣點圖", description: "清楚呈現可見材質、構造及確認資料。" },
    lifestyle: { title: "使用情境圖", description: "適合放在商品相簿的生活化視覺。" },
  },
  google: {
    main: { title: "Merchant 主圖", description: "乾淨主商品圖，適合 image_link。" },
    studio: { title: "完整套裝補充圖", description: "作為 additional_image_link 候選。" },
    detail: { title: "核實賣點補充圖", description: "展示可驗證的商品細節及確認資料。" },
    lifestyle: { title: "Lifestyle 候選圖", description: "方形、無 CTA 的情境候選圖。" },
  },
};

export function isMarketplaceChannel(value: string): value is MarketplaceChannel {
  return value in MARKETPLACE_CHANNELS;
}

export function getMarketplaceSuite(channel: MarketplaceChannel): MarketplaceSuiteItem[] {
  return (Object.keys(sharedItems) as MarketplaceImageRole[]).map((role) => ({
    ...sharedItems[role],
    ...copy[channel][role],
  }));
}

export function getMarketplaceSuiteSelection(selectedRoles?: MarketplaceImageRole[]) {
  const allRoles = Object.keys(sharedItems) as MarketplaceImageRole[];
  if (!selectedRoles?.length) return allRoles;
  return allRoles.filter((role) => selectedRoles.includes(role));
}

export function getMarketplaceSuiteCreditCost(selectedRoles?: MarketplaceImageRole[]) {
  return getMarketplaceSuiteSelection(selectedRoles).length;
}

export function normaliseMarketplaceBrandStyle(style?: Partial<MarketplaceBrandStyle>): MarketplaceBrandStyle {
  const accentColor = style?.accentColor?.trim();
  return {
    accentColor: accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor.toUpperCase() : DEFAULT_MARKETPLACE_BRAND_STYLE.accentColor,
    fontStyle: style?.fontStyle && style.fontStyle in MARKETPLACE_FONT_STYLES ? style.fontStyle : DEFAULT_MARKETPLACE_BRAND_STYLE.fontStyle,
  };
}

export function buildMarketplaceImagePrompt(input: { channel: MarketplaceChannel; item: MarketplaceSuiteItem; productNote?: string; productBrief?: ConfirmedMarketplaceProductBrief; detailSpecificationLayout?: MarketplaceDetailSpecificationLayout; brandStyle?: MarketplaceBrandStyle; brandIdentity?: MarketplaceBrandIdentity; referenceImageCount?: number; lifestyleStyle?: MarketplaceLifestyleStyle; lifestyleScene?: MarketplaceLifestyleSceneCandidate; avoidLifestyleStyles?: MarketplaceLifestyleStyle[]; compositionCorrection?: string; redesignInstruction?: string }) {
  const channel = MARKETPLACE_CHANNELS[input.channel];
  const channelInstruction = input.channel === "google"
    ? "Do not render any platform requirement, AI disclosure, IPTC label, or metadata as visible image content."
    : channel.note;
  const legacyProductNote = input.productNote?.trim()
    ? `The merchant supplied this factual product note: "${input.productNote.trim()}". Treat it only as a factual constraint; do not add any unconfirmed feature, copy, measurement, claim, accessory, package item, or variant.`
    : "No factual product note was supplied. Do not infer or invent specifications, variants, package contents, or claims.";
  const productBrief = formatMarketplaceProductBriefForPrompt(input.productBrief);
  const detailSpecificationOverlay = input.item.role === "detail"
    ? formatMarketplaceDetailSpecificationOverlay(input.productBrief, input.detailSpecificationLayout)
    : "No specification overlay is permitted for this role.";
  const brandStyle = normaliseMarketplaceBrandStyle(input.brandIdentity ?? input.brandStyle);
  const referenceInstruction = input.referenceImageCount && input.referenceImageCount > 1
    ? `The merchant supplied ${input.referenceImageCount} reference photos of the same SKU from different angles. Reconcile every view before generating: retain the consistent product shape, construction, label placement, colour, components and sold-item count across views. Do not treat a different angle as a separate product or merge conflicting details.`
    : "Only one product reference photograph was supplied, so preserve only what can be verified from that view.";
  const canUseLogo = input.item.role !== "main" && input.channel !== "google" && input.brandIdentity?.hasLogo;
  const brandInstruction = input.item.role === "main"
    ? "Do not apply the merchant brand colour, font style, brand name or decorative identity to the catalog main image."
    : `For this supplementary image only, use ${brandStyle.accentColor} as a restrained visual accent where appropriate and use a ${MARKETPLACE_FONT_STYLES[brandStyle.fontStyle]} typography direction if verified callout text is allowed. ${canUseLogo ? "The last supplied reference is the merchant's approved logo. It may appear only once, small and unobtrusive, on a dedicated supplementary accent area; reproduce it faithfully without changing its lettering, shape or colours. Never use the logo as a product label or claim." : "Do not invent a brand name, logo, tagline, product claim or extra text."} ${input.channel === "google" ? "Google Merchant Center assets must not include a brand overlay, so do not render any logo." : ""}`;

  const compositionCorrection = input.compositionCorrection?.trim()
    ? `The first attempt was rejected because it did not satisfy the requested composition. ${input.compositionCorrection.trim()} Change the camera framing and surrounding scene as required for this role while preserving the exact same product identity.`
    : "";
  const lifestyleStyle = input.item.role === "lifestyle"
    ? `The merchant selected this lifestyle style: ${MARKETPLACE_LIFESTYLE_STYLES[input.lifestyleStyle ?? "auto"].label}. ${MARKETPLACE_LIFESTYLE_STYLES[input.lifestyleStyle ?? "auto"].prompt}`
    : "";
  const selectedLifestyleScene = input.item.role === "lifestyle" && input.lifestyleScene
    ? `The merchant selected this non-factual scene direction: ${input.lifestyleScene.title}. ${input.lifestyleScene.description} Treat it only as art direction for the non-sold environment, surface, light and camera context. Do not treat it as evidence of a product use, included accessory, capability or product claim.`
    : "";
  const avoidedLifestyleStyles = input.item.role === "lifestyle" && input.avoidLifestyleStyles?.length
    ? `Avoid these unrelated setting categories for this image: ${input.avoidLifestyleStyles.map((style) => MARKETPLACE_LIFESTYLE_STYLES[style].label).join(", ")}. Do not substitute one of them when fulfilling the selected scene direction.`
    : "";
  const redesignInstruction = input.redesignInstruction?.trim()
    ? `The merchant asks to redesign this one image as follows: "${input.redesignInstruction.trim()}". Treat this only as an art-direction request for framing, lighting, background, non-sold context or presentation. Never treat it as proof of a product specification, package count, claim, certification, accessory, logo, text, translated label or a different SKU. Keep every verified aspect of the supplied product unchanged; if the request conflicts with the role rules or available evidence, follow the role rules and preserve the source-facing product view.`
    : "";

  return `Create one ${channel.label} ready product image from the supplied product photograph. This is a commercial product-photography rendition, not a request to reproduce the source photo unchanged. Render an exact 1:1 square e-commerce canvas. Use the uploaded product as the sole visual source of truth: preserve its real shape, product category, proportions, material, colour, texture, labels, meaningful visible text, packaging, quantity, accessories, and scale. You may change only the camera framing, lighting, background and non-sold environment needed to fulfil the requested role. Do not substitute, rebrand, translate, beautify, distort, hallucinate unseen sides, or invent a different SKU. If a requested composition would require an unknown product detail, keep the known source-facing view rather than inventing it. ${referenceInstruction} ${legacyProductNote} ${productBrief} ${input.item.generationInstruction} ${detailSpecificationOverlay} ${lifestyleStyle} ${selectedLifestyleScene} ${avoidedLifestyleStyles} ${redesignInstruction} ${compositionCorrection} ${brandInstruction} Keep the product naturally lit and in sharp focus. Ensure no part of the actual product is unintentionally clipped. ${channelInstruction} The result is an AI-produced asset and requires a final merchant review against the real SKU and current marketplace/category policy before publication.`;
}

export const MARKETPLACE_SUITE_CREDIT_COST = 4;
