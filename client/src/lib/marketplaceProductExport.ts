import type { MarketplaceChannel } from "@shared/marketplaceSuites";
import type { MarketplaceProductBrief } from "@shared/marketplaceProductBrief";
import type { MarketplaceListingCopy } from "@shared/marketplaceListingCopy";
import { getThailandMarketplaceListingRequirements, normaliseThailandMarketplaceListingFields } from "@shared/thailandMarketplaceListing";

export type MarketplaceProductExport = {
  channel: MarketplaceChannel;
  sku?: string;
  brief: MarketplaceProductBrief;
  listingCopy: MarketplaceListingCopy | null;
  exportedAt?: Date;
};

type ExportRow = { section: string; field: string; value: string };

function safeCell(value: string) {
  const normalized = value.replace(/\r?\n/g, "\n").trim();
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function lines(lines: string[]) { return lines.join("；"); }

export function getMarketplaceProductExportRows({ channel, brief, listingCopy, exportedAt = new Date() }: MarketplaceProductExport): ExportRow[] {
  const rows: ExportRow[] = [
    { section: "匯出資料", field: "生成時間", value: exportedAt.toLocaleString("zh-HK") },
    { section: "匯出資料", field: "目標平台", value: channel },
    { section: "產品資料", field: "產品名稱", value: brief.productName },
    { section: "產品資料", field: "產品描述", value: brief.summary },
    { section: "產品資料", field: "產品重量", value: brief.weight },
    { section: "產品資料", field: "產品尺寸", value: brief.dimensions },
    { section: "產品資料", field: "確認資料", value: lines(brief.confirmedFacts) },
    { section: "產品資料", field: "可用於賣點圖的核實資料", value: lines(brief.visualHighlights) },
    { section: "產品資料", field: "可接受的使用情境", value: lines(brief.usageIdeas) },
    { section: "產品資料", field: "待核對事項", value: lines(brief.reviewQuestions) },
  ];

  if (listingCopy) {
    rows.push(
      { section: "上架文案", field: "建議商品標題", value: listingCopy.title },
      ...listingCopy.bullets.map((bullet, index) => ({ section: "上架文案", field: `五點描述 ${index + 1}`, value: bullet })),
      { section: "上架文案", field: "上架前提示", value: lines(listingCopy.reviewNotes) },
    );
    const thailandRequirements = getThailandMarketplaceListingRequirements(channel);
    const thailandFields = normaliseThailandMarketplaceListingFields(listingCopy.thailandFields, channel);
    if (thailandRequirements && thailandFields) {
      rows.push(
        { section: "泰國平台欄位", field: "平台", value: thailandRequirements.label },
        { section: "泰國平台欄位", field: "商品描述（泰文）", value: thailandFields.description },
        { section: "泰國平台欄位", field: "末級類目", value: thailandFields.categoryPath },
        { section: "泰國平台欄位", field: "品牌", value: thailandFields.brand },
        { section: "泰國平台欄位", field: "變款", value: thailandFields.variation },
        { section: "泰國平台欄位", field: "類目 Attributes", value: thailandFields.categoryAttributes },
        { section: "泰國平台欄位", field: "包裝重量（kg）", value: thailandFields.packageWeightKg },
        { section: "泰國平台欄位", field: "包裝尺寸（cm）", value: [thailandFields.packageLengthCm, thailandFields.packageWidthCm, thailandFields.packageHeightCm].filter(Boolean).join(" × ") },
        ...(channel === "lazada_th" ? [{ section: "泰國平台欄位", field: "盒內物品", value: thailandFields.whatsInTheBox }] : []),
        { section: "泰國平台欄位", field: "Seller Center 最終核對", value: thailandRequirements.verificationNote },
      );
    }
  }
  return rows.map((row) => ({ ...row, value: safeCell(row.value) }));
}

function csvEscape(value: string) { return `"${value.replace(/"/g, '""')}"`; }

function productDescription(brief: MarketplaceProductBrief, listingCopy: MarketplaceListingCopy | null) {
  const thailandFields = listingCopy ? normaliseThailandMarketplaceListingFields(listingCopy.thailandFields, listingCopy.channel) : null;
  if (thailandFields?.description) return thailandFields.description;
  const bulletText = listingCopy?.bullets.filter(Boolean).join("；");
  return [brief.summary.trim(), bulletText].filter(Boolean).join("\n");
}

/**
 * Creates a prefilled starting row that merchants map into the current
 * category-specific import template downloaded from their target platform.
 */
export function getMarketplacePlatformTemplateRow({ channel, sku = "", brief, listingCopy }: MarketplaceProductExport) {
  const bullets = Array.from({ length: 5 }, (_, index) => listingCopy?.bullets[index] ?? "");
  const description = productDescription(brief, listingCopy);
  const title = listingCopy?.title.trim() || brief.productName.trim();
  const protectedSku = safeCell(sku);
  if (channel === "amazon") return {
    "seller-sku": protectedSku,
    "item-name": safeCell(title),
    "product-description": safeCell(description),
    "bullet-point-1": safeCell(bullets[0]),
    "bullet-point-2": safeCell(bullets[1]),
    "bullet-point-3": safeCell(bullets[2]),
    "bullet-point-4": safeCell(bullets[3]),
    "bullet-point-5": safeCell(bullets[4]),
  };
  if (channel === "shopee") return {
    "Seller SKU": protectedSku,
    "Product Name": safeCell(title),
    "Description": safeCell(description),
    "Feature 1": safeCell(bullets[0]),
    "Feature 2": safeCell(bullets[1]),
    "Feature 3": safeCell(bullets[2]),
    "Feature 4": safeCell(bullets[3]),
    "Feature 5": safeCell(bullets[4]),
  };
  const thailandFields = listingCopy ? normaliseThailandMarketplaceListingFields(listingCopy.thailandFields, channel) : null;
  if (channel === "lazada_th" && thailandFields) return {
    "Seller SKU": protectedSku,
    "Product Name (max 255 chars)": safeCell(title),
    "Description (Thai)": safeCell(description),
    "Primary Category (verify in Seller Center)": safeCell(thailandFields.categoryPath),
    "Brand": safeCell(thailandFields.brand),
    "Variation": safeCell(thailandFields.variation),
    "What’s in the box": safeCell(thailandFields.whatsInTheBox),
    "Category Attributes (verify)": safeCell(thailandFields.categoryAttributes),
    "Package Weight (kg)": safeCell(thailandFields.packageWeightKg),
    "Package Length (cm)": safeCell(thailandFields.packageLengthCm),
    "Package Width (cm)": safeCell(thailandFields.packageWidthCm),
    "Package Height (cm)": safeCell(thailandFields.packageHeightCm),
  };
  if (channel === "shopee_th" && thailandFields) return {
    "Seller SKU": protectedSku,
    "Product Name (working target 120 chars)": safeCell(title),
    "Description (Thai; working target 3000 chars)": safeCell(description),
    "Leaf Category (verify in Seller Center)": safeCell(thailandFields.categoryPath),
    "Brand": safeCell(thailandFields.brand),
    "Variation": safeCell(thailandFields.variation),
    "Category Attributes (verify)": safeCell(thailandFields.categoryAttributes),
    "Package Weight (kg)": safeCell(thailandFields.packageWeightKg),
    "Package Length (cm)": safeCell(thailandFields.packageLengthCm),
    "Package Width (cm)": safeCell(thailandFields.packageWidthCm),
    "Package Height (cm)": safeCell(thailandFields.packageHeightCm),
  };
  if (channel === "instagram" || channel === "facebook") return {
    "retailer_id": protectedSku,
    "name": safeCell(title),
    "description": safeCell(description),
    "additional_information": safeCell(bullets.filter(Boolean).join("；")),
  };
  return {
    "id": protectedSku,
    "title": safeCell(title),
    "description": safeCell(description),
    "image_link": "",
    "additional_image_link": "",
  };
}

export function createMarketplaceProductCsv(exportData: MarketplaceProductExport) {
  const header = ["分類", "欄位", "內容"];
  const body = getMarketplaceProductExportRows(exportData).map((row) => [row.section, row.field, row.value]);
  return `\uFEFF${[header, ...body].map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
}

export function createMarketplacePlatformTemplateCsv(exportData: MarketplaceProductExport) {
  const record = getMarketplacePlatformTemplateRow(exportData);
  const headers = Object.keys(record);
  return `\uFEFF${[headers, Object.values(record)].map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
}

export async function createMarketplaceProductXlsx(exportData: MarketplaceProductExport) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(getMarketplaceProductExportRows(exportData).map((row) => ({ "分類": row.section, "欄位": row.field, "內容": row.value })));
  sheet["!cols"] = [{ wch: 14 }, { wch: 27 }, { wch: 70 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "商品資料");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

export async function createMarketplacePlatformTemplateXlsx(exportData: MarketplaceProductExport) {
  const XLSX = await import("xlsx");
  const row = getMarketplacePlatformTemplateRow(exportData);
  const sheet = XLSX.utils.json_to_sheet([row]);
  sheet["!cols"] = Object.keys(row).map(() => ({ wch: 28 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, `${exportData.channel}-template`.slice(0, 31));
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

export function getMarketplaceProductExportFileName(productName: string, extension: "csv" | "xlsx") {
  const slug = productName.trim().replace(/[^a-zA-Z0-9\u4E00-\u9FFF]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "product-brief";
  return `iwantphoto-${slug}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function getMarketplacePlatformTemplateFileName(productName: string, channel: MarketplaceChannel, extension: "csv" | "xlsx") {
  return getMarketplaceProductExportFileName(`${channel}-${productName}-listing-template`, extension);
}

export function triggerMarketplaceProductDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
