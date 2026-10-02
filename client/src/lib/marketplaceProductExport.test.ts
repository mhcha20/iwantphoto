import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createMarketplacePlatformTemplateCsv, createMarketplacePlatformTemplateXlsx, createMarketplaceProductCsv, createMarketplaceProductXlsx, getMarketplacePlatformTemplateRow, getMarketplaceProductExportFileName, getMarketplaceProductExportRows } from "./marketplaceProductExport";

const exportData = {
  channel: "amazon" as const,
  exportedAt: new Date("2026-09-19T00:00:00.000Z"),
  brief: {
    productName: "透明收納盒",
    summary: "透明盒身配有深色扣件。",
    weight: "180 g",
    dimensions: "12 × 8 × 4 cm",
    confirmedFacts: ["透明盒身"],
    visualHighlights: ["深色扣件"],
    usageIdeas: ["家居收納"],
    reviewQuestions: ["請確認容量"],
  },
  listingCopy: {
    channel: "amazon" as const,
    title: "透明收納盒",
    bullets: ["透明盒身", "深色扣件", "可見密封蓋", "家居收納", "請確認實際套裝內容"],
    reviewNotes: ["請確認容量"],
  },
};

describe("marketplace product exports", () => {
  it("includes confirmed brief fields and listing copy in an Excel-safe CSV", () => {
    const csv = createMarketplaceProductCsv({ ...exportData, brief: { ...exportData.brief, productName: "=公式內容" } });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("五點描述 5");
    expect(csv).toContain("產品重量");
    expect(csv).toContain("12 × 8 × 4 cm");
    expect(csv).toContain("'=公式內容");
  });

  it("creates a readable XLSX worksheet with the product data", async () => {
    const xlsx = await createMarketplaceProductXlsx(exportData);
    const workbook = XLSX.read(xlsx, { type: "array" });
    expect(workbook.SheetNames).toEqual(["商品資料"]);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets["商品資料"], { header: 1 }) as unknown[][];
    expect(rows).toEqual(expect.arrayContaining([expect.arrayContaining(["產品名稱", "透明收納盒"])]));
  });

  it("uses a clear deterministic filename and exposes export rows", () => {
    expect(getMarketplaceProductExportFileName("透明收納盒", "xlsx")).toContain("透明收納盒");
    expect(getMarketplaceProductExportRows(exportData)).toHaveLength(17);
  });

  it("creates Shopee-ready starting fields and a readable platform workbook", async () => {
    const shopeeExport = { ...exportData, channel: "shopee" as const, sku: "BOX-BLK-01" };
    expect(getMarketplacePlatformTemplateRow(shopeeExport)).toMatchObject({ "Seller SKU": "BOX-BLK-01", "Product Name": "透明收納盒" });
    expect(createMarketplacePlatformTemplateCsv(shopeeExport)).toContain("Feature 5");
    const xlsx = await createMarketplacePlatformTemplateXlsx(shopeeExport);
    const workbook = XLSX.read(xlsx, { type: "array" });
    expect(workbook.SheetNames).toEqual(["shopee-template"]);
  });

  it("creates Thailand-specific Lazada and Shopee template fields", () => {
    const thailandFields = {
      description: "กล่องใสพร้อมตัวล็อกสีเข้ม",
      categoryPath: "Home & Living > Storage",
      brand: "No Brand",
      packageWeightKg: "0.35",
      packageLengthCm: "20",
      packageWidthCm: "14",
      packageHeightCm: "8",
      variation: "สี: ดำ",
      whatsInTheBox: "1 x กล่องเก็บของ",
      categoryAttributes: "วัสดุ: พลาสติก",
    };
    const lazada = getMarketplacePlatformTemplateRow({ ...exportData, channel: "lazada_th", sku: "TH-BOX-01", listingCopy: { ...exportData.listingCopy, channel: "lazada_th", thailandFields } });
    const shopee = getMarketplacePlatformTemplateRow({ ...exportData, channel: "shopee_th", sku: "TH-BOX-01", listingCopy: { ...exportData.listingCopy, channel: "shopee_th", thailandFields } });
    expect(lazada).toMatchObject({ "Product Name (max 255 chars)": "透明收納盒", "What’s in the box": "1 x กล่องเก็บของ" });
    expect(shopee).toMatchObject({ "Product Name (working target 120 chars)": "透明收納盒", "Description (Thai; working target 3000 chars)": "กล่องใสพร้อมตัวล็อกสีเข้ม" });
  });
});
