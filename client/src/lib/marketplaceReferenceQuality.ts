export type MarketplaceReferenceQuality = {
  width: number;
  height: number;
  bytes: number;
  readiness: "ready" | "attention";
  summary: string;
  notices: string[];
};

type MarketplaceReferenceQualityMetrics = {
  width: number;
  height: number;
  bytes: number;
  edgeVariation: number;
  centerContrast: number;
};

export function evaluateMarketplaceReferenceQuality(metrics: MarketplaceReferenceQualityMetrics): MarketplaceReferenceQuality {
  const longEdge = Math.max(metrics.width, metrics.height);
  const shortEdge = Math.min(metrics.width, metrics.height);
  const notices: string[] = [];
  if (longEdge < 1200 || shortEdge < 700) notices.push(`解析度為 ${metrics.width}×${metrics.height}；建議使用長邊至少 1,200 px 的清晰原圖。`);
  if (metrics.bytes < 150 * 1024) notices.push("檔案較小，可能已被訊息軟件壓縮；建議改用原始相片。");
  if (longEdge / Math.max(1, shortEdge) > 3) notices.push("相片比例較極端；產品應完整入鏡並預留周邊空間。");
  if (metrics.edgeVariation > 28) notices.push("邊緣背景變化較多；主圖建議使用較乾淨、沒有雜物的產品相片。");
  if (metrics.centerContrast < 9) notices.push("產品與背景對比有限；可換用主體更清晰、背景反差更高的相片。");
  return {
    width: metrics.width,
    height: metrics.height,
    bytes: metrics.bytes,
    readiness: notices.length ? "attention" : "ready",
    summary: notices.length ? "可繼續使用，但以上情況可能影響主體辨識或生成穩定性。" : "解析度、對比及背景複雜度符合建立商品圖的基本建議。",
    notices,
  };
}

export async function inspectMarketplaceReferenceQuality(file: File): Promise<MarketplaceReferenceQuality> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("相片未能載入作檢查。"));
      element.src = url;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const sampleSize = 80;
    const canvas = document.createElement("canvas");
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return evaluateMarketplaceReferenceQuality({ width, height, bytes: file.size, edgeVariation: 0, centerContrast: 12 });
    context.drawImage(image, 0, 0, sampleSize, sampleSize);
    const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
    const edgeValues: number[] = [];
    const centerValues: number[] = [];
    for (let y = 0; y < sampleSize; y += 1) {
      for (let x = 0; x < sampleSize; x += 1) {
        const offset = (y * sampleSize + x) * 4;
        const luminance = pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
        if (x < 12 || y < 12 || x >= sampleSize - 12 || y >= sampleSize - 12) edgeValues.push(luminance);
        if (x >= 24 && x < 56 && y >= 24 && y < 56) centerValues.push(luminance);
      }
    }
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const edgeAverage = average(edgeValues);
    const edgeVariation = Math.sqrt(average(edgeValues.map((value) => (value - edgeAverage) ** 2)));
    const centerContrast = Math.abs(average(centerValues) - edgeAverage);
    return evaluateMarketplaceReferenceQuality({ width, height, bytes: file.size, edgeVariation, centerContrast });
  } finally {
    URL.revokeObjectURL(url);
  }
}
