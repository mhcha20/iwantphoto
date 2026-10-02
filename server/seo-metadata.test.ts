import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");

describe("public SEO and social metadata", () => {
  it("uses Iwantphoto consistently across search and sharing metadata", () => {
    expect(indexHtml).toContain('<title>Iwantphoto｜AI 圖片工作台</title>');
    expect(indexHtml).toContain('<meta name="application-name" content="Iwantphoto" />');
    expect(indexHtml).toContain('<meta property="og:site_name" content="Iwantphoto" />');
    expect(indexHtml).toContain('<meta property="og:title" content="Iwantphoto｜AI 圖片工作台" />');
    expect(indexHtml).toContain('<meta name="twitter:title" content="Iwantphoto｜AI 圖片工作台" />');
    expect(indexHtml).toContain('"name": "Iwantphoto"');
  });

  it("provides complete Open Graph and Twitter image context", () => {
    expect(indexHtml).toContain('<meta property="og:image:secure_url"');
    expect(indexHtml).toContain('<meta property="og:image:type" content="image/jpeg" />');
    expect(indexHtml).toContain('<meta property="og:image:alt" content="Iwantphoto AI 商業相片處理工作台" />');
    expect(indexHtml).toContain('<meta name="twitter:image:alt" content="Iwantphoto AI 商業相片處理工作台" />');
  });
});
