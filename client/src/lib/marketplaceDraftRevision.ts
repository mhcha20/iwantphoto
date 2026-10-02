export type MarketplaceDraftRevisionShortcut = {
  label: string;
  instruction: string;
};

export const MARKETPLACE_DRAFT_REVISION_SHORTCUTS: MarketplaceDraftRevisionShortcut[] = [
  {
    label: "更精簡",
    instruction: "請把產品名稱和描述改得更精簡，保留已核實且相片可見的重點。",
  },
  {
    label: "改專業語氣",
    instruction: "請改為專業、客觀的商業語氣，不加入宣傳、保證或誇大字眼。",
  },
  {
    label: "移除醫療字眼",
    instruction: "請移除或改寫任何醫療、治療、健康功效或疾病相關字眼；未能確認的內容請列為待核對事項。",
  },
  {
    label: "翻譯成英文",
    instruction: "請把產品名稱、描述、核實資料、賣點資料、使用情境及待核對事項全部翻譯成專業、自然的英文；不要加入原文沒有的規格、功效或聲稱。",
  },
  {
    label: "翻譯成簡體中文",
    instruction: "請把產品名稱、描述、核實資料、賣點資料、使用情境及待核對事項全部翻譯成自然的簡體中文；不要加入原文沒有的規格、功效或聲稱。",
  },
  {
    label: "翻譯成日文",
    instruction: "請把產品名稱、描述、核實資料、賣點資料、使用情境及待核對事項全部翻譯成自然、專業的日文；不要加入原文沒有的規格、功效或聲稱。",
  },
  {
    label: "翻譯成泰文",
    instruction: "請把產品名稱、描述、核實資料、賣點資料、使用情境及待核對事項全部翻譯成自然、專業的泰文；不要加入原文沒有的規格、功效或聲稱。",
  },
  {
    label: "只保留可見資料",
    instruction: "請只保留相片中清楚可見的產品資料，其餘內容改列為待核對事項。",
  },
];

export function appendMarketplaceRevisionInstruction(current: string, shortcut: string, maxLength = 500) {
  const existing = current.trim();
  const next = existing ? `${existing}\n${shortcut}` : shortcut;
  return next.slice(0, maxLength);
}
