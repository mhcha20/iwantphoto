export type CaseStudyPresetKey = "product" | "storefront" | "food" | "property";

export type CaseStudyPreset = {
  backgroundStyle: "transparent" | "white";
  cleanupNote: string;
  label: string;
};

const presets: Record<CaseStudyPresetKey, CaseStudyPreset> = {
  product: {
    backgroundStyle: "white",
    cleanupNote: "清除紙箱、電線、收據與周邊雜物，保留產品主體。",
    label: "產品白底預設",
  },
  storefront: {
    backgroundStyle: "transparent",
    cleanupNote: "清除手推車、紙箱、垃圾袋、電線及路面干擾元素，保留店面與展示細節。",
    label: "門市清除預設",
  },
  food: {
    backgroundStyle: "transparent",
    cleanupNote: "清除餐桌上的紙巾、收據、醬料樽、餐具包裝與周邊雜物，保留食物主體。",
    label: "餐飲清除預設",
  },
  property: {
    backgroundStyle: "transparent",
    cleanupNote: "清除紙箱、衣架、購物袋、電線、風扇及個人物品，保留室內空間與自然光。",
    label: "物業清除預設",
  },
};

export function getCaseStudyPreset(key: CaseStudyPresetKey) {
  return presets[key];
}
