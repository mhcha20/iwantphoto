import type { MarketplaceChannel } from "./marketplaceSuites";

export type ThailandMarketplacePlatform = Extract<MarketplaceChannel, "lazada_th" | "shopee_th">;

export type ThailandMarketplaceListingFields = {
  description: string;
  categoryPath: string;
  brand: string;
  packageWeightKg: string;
  packageLengthCm: string;
  packageWidthCm: string;
  packageHeightCm: string;
  variation: string;
  whatsInTheBox: string;
  categoryAttributes: string;
};

export type ThailandMarketplaceFieldDefinition = {
  key: keyof ThailandMarketplaceListingFields;
  label: string;
  placeholder: string;
  helper: string;
  maxLength: number;
  required?: boolean;
};

export type ThailandMarketplaceListingRequirements = {
  platform: ThailandMarketplacePlatform;
  label: string;
  titleLimit: number;
  descriptionLimit: number;
  titleHint: string;
  descriptionHint: string;
  verificationNote: string;
  sourceUrl: string;
  fields: ThailandMarketplaceFieldDefinition[];
};

const sharedShippingFields: ThailandMarketplaceFieldDefinition[] = [
  { key: "packageWeightKg", label: "น้ำหนักพัสดุ (กก.)", placeholder: "เช่น 0.35", helper: "填寫連同包裝的實際重量；物流計費及類目要求以 Seller Center 為準。", maxLength: 24 },
  { key: "packageLengthCm", label: "ความยาวพัสดุ (ซม.)", placeholder: "เช่น 20", helper: "填寫連同包裝的實際長度。", maxLength: 24 },
  { key: "packageWidthCm", label: "ความกว้างพัสดุ (ซม.)", placeholder: "เช่น 14", helper: "填寫連同包裝的實際闊度。", maxLength: 24 },
  { key: "packageHeightCm", label: "ความสูงพัสดุ (ซม.)", placeholder: "เช่น 8", helper: "填寫連同包裝的實際高度。", maxLength: 24 },
];

export const THAILAND_MARKETPLACE_LISTING_REQUIREMENTS: Record<ThailandMarketplacePlatform, ThailandMarketplaceListingRequirements> = {
  lazada_th: {
    platform: "lazada_th",
    label: "Lazada Thailand",
    titleLimit: 255,
    descriptionLimit: 3000,
    titleHint: "Lazada Open Platform 的 Create Product 文件列明商品名稱上限為 255 個字元。",
    descriptionHint: "建議保留重要、可核實資料於前段；避免宣稱、價格、折扣或未核實的規格。",
    verificationNote: "最終須在 Lazada Thailand Seller Center 選擇末級類目並核對該類目的必填 Attributes、品牌、變款及物流設定。",
    sourceUrl: "https://open.lazada.com/apps/doc/doc?docId=120949&nodeId=30720",
    fields: [
      { key: "description", label: "รายละเอียดสินค้า", placeholder: "ภาษาไทย：描述已核實的產品資料、包裝及可接受的使用情境。", helper: "建議泰文商品描述；請只保留已確認內容。", maxLength: 3000, required: true },
      { key: "categoryPath", label: "หมวดหมู่ (ระดับสุดท้าย)", placeholder: "例如：Home & Living > Storage", helper: "需在 Seller Center 選擇實際可用的最末級類目。", maxLength: 180, required: true },
      { key: "brand", label: "แบรนด์", placeholder: "例如：No Brand／已核實品牌", helper: "部分類目或品牌清單可能要求指定值；勿猜測商標。", maxLength: 100 },
      { key: "whatsInTheBox", label: "สิ่งที่มีในกล่อง", placeholder: "例如：1 x 商品本體", helper: "只填寫實際可驗證的盒內物品及數量。", maxLength: 500 },
      { key: "variation", label: "ตัวเลือกสินค้า", placeholder: "例如：สี：ดำ；ขนาด：M", helper: "如有顏色／尺寸等變款，填寫實際變款名稱及值。", maxLength: 240 },
      { key: "categoryAttributes", label: "คุณลักษณะตามหมวดหมู่", placeholder: "例如：材質、型號等（以 Seller Center 類目清單為準）", helper: "類目 Attributes 由平台決定；沒有核實資料時留空並在 Seller Center 補齊。", maxLength: 1000 },
      ...sharedShippingFields,
    ],
  },
  shopee_th: {
    platform: "shopee_th",
    label: "Shopee Thailand",
    titleLimit: 120,
    descriptionLimit: 3000,
    titleHint: "以 120 個字元作安全工作目標；Shopee 的實際限制會按店舖、類目及市場由 Seller Center／get_item_limit 決定。",
    descriptionHint: "以 3,000 個字元作工作上限；保持泰文、清晰分段並只列已核實的產品資料。",
    verificationNote: "最終須在 Shopee Thailand Seller Center 核對該店舖的 get_item_limit、末級類目、必填 Attributes、品牌、寄送天數及物流渠道。",
    sourceUrl: "https://open.shopee.com/developer-guide/209",
    fields: [
      { key: "description", label: "รายละเอียดสินค้า", placeholder: "ภาษาไทย：描述已核實的產品資料、包裝及可接受的使用情境。", helper: "建議泰文商品描述；請只保留已確認內容。", maxLength: 3000, required: true },
      { key: "categoryPath", label: "หมวดหมู่ (ระดับสุดท้าย)", placeholder: "例如：Home & Living > Storage", helper: "只可使用該店舖可上架的最末級類目。", maxLength: 180, required: true },
      { key: "brand", label: "แบรนด์", placeholder: "例如：No Brand／已核實品牌", helper: "品牌是否必填及可用值須按類目／店舖清單核對。", maxLength: 100 },
      { key: "variation", label: "ตัวเลือกสินค้า", placeholder: "例如：สี：ดำ；ขนาด：M", helper: "如有變款，填寫實際變款名稱及可售值；不同變款的物流資料或有差異。", maxLength: 240 },
      { key: "categoryAttributes", label: "คุณลักษณะตามหมวดหมู่", placeholder: "例如：材質、型號等（以 Seller Center 類目清單為準）", helper: "Shopee 的必填 Attributes 按末級類目而異，不能由 AI 猜測。", maxLength: 1000 },
      ...sharedShippingFields,
    ],
  },
};

export function isThailandMarketplacePlatform(channel: MarketplaceChannel): channel is ThailandMarketplacePlatform {
  return channel === "lazada_th" || channel === "shopee_th";
}

export function getThailandMarketplaceListingRequirements(channel: MarketplaceChannel) {
  return isThailandMarketplacePlatform(channel) ? THAILAND_MARKETPLACE_LISTING_REQUIREMENTS[channel] : null;
}

export function emptyThailandMarketplaceListingFields(): ThailandMarketplaceListingFields {
  return {
    description: "",
    categoryPath: "",
    brand: "",
    packageWeightKg: "",
    packageLengthCm: "",
    packageWidthCm: "",
    packageHeightCm: "",
    variation: "",
    whatsInTheBox: "",
    categoryAttributes: "",
  };
}

export function normaliseThailandMarketplaceListingFields(input: Partial<ThailandMarketplaceListingFields> | null | undefined, channel: MarketplaceChannel) {
  const requirements = getThailandMarketplaceListingRequirements(channel);
  if (!requirements) return null;
  const empty = emptyThailandMarketplaceListingFields();
  return Object.fromEntries(Object.entries(empty).map(([key, fallback]) => {
    const field = requirements.fields.find((definition) => definition.key === key);
    const maxLength = field?.maxLength ?? 1000;
    const value = input?.[key as keyof ThailandMarketplaceListingFields];
    return [key, typeof value === "string" ? value.trim().slice(0, maxLength) : fallback];
  })) as ThailandMarketplaceListingFields;
}

export function getThailandMarketplaceListingCharacterStatus(channel: MarketplaceChannel, field: "title" | "description", value: string) {
  const requirements = getThailandMarketplaceListingRequirements(channel);
  if (!requirements) return null;
  const limit = field === "title" ? requirements.titleLimit : requirements.descriptionLimit;
  const length = Array.from(value).length;
  return { length, limit, remaining: Math.max(0, limit - length), overLimit: length > limit };
}
