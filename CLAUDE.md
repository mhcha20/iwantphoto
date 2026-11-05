# Iwantphoto（iwantphoto）

給日後 AI 嘅項目背景。用戶用廣東話溝通，回覆用繁體廣東話；用戶唔係寫程式嘅人。所有網站一覽：`docs/ALL_SITES.md`。

**呢個係真網站（iwantphoto.com，Stripe 訂閱收款）。改動前後要 `pnpm run check`、`pnpm test`、`pnpm run build` 全過。**

## 接手先讀
- `README-HOSTING.md`：由 Manus 搬到 Railway（Google OAuth、S3、OpenRouter）、Railway 部署步驟、`pnpm verify:ai` 煙霧測試。
- `todo.md`：**功能清單（最詳細）**，每項功能做咗咩、點運作。
- `marketplace-image-requirements.md`：各電商平台圖片規格（Amazon、IG Shop、Shopee、Lazada／Shopee 泰國、FB Shop、Google Merchant Center）。
- `pricing-and-billing-sources.md`：成本同定價依據、Stripe 架構。
- `HOST-ENVIRONMENT.template`：環境變數參考（唔好填真值入 repo）。

## 係咩
AI 商品圖工作台（繁中介面）：
- **AI 圖片編輯**：白底、透明去背（本地 ISNet＋BiRefNet 分割，模型 build 時由 `scripts/fetch-models.mjs` 下載）、移除物件、手動還原／擦除筆刷（touch-up）、AI 編輯對齊原圖幾何（EXIF 方向、重新框位對齊、失敗就唔出錯位結果）。
- **電商圖組（Marketplace Suite）**：上載 1–3 個角度 → AI 草擬可編輯產品簡介（唔核實嘅規格變問題）→ 揀平台、圖組角色（主圖／全套／核實賣點／生活情境）、品牌預設、專案 → 每張圖 GPT Image 2，失敗轉 Gemini；構圖檢查自動重做一次（唔多收費）；Google Merchant 圖寫入 IPTC AI metadata；泰國 Lazada／Shopee 刊登文案工作區＋CSV／XLSX 匯出；WhatsApp 分享（單張／全部）。
- **帳戶**：相片庫（專案分類）、用量紀錄、儲存空間計量同上限、頭像、登入紀錄；`/admin` 總覽（只限 admin）。
- **收費**：Stripe Checkout＋webhook：Starter／Pro／Business 月費、一次性 credits（Flex 25／Value 100／Studio 250）、儲存加購；Customer Portal。`IWANTPHOTO_BILLING_ENABLED` 開關。
React 19＋Vite＋Tailwind 4、Express＋tRPC、Drizzle＋MySQL、S3（Railway Bucket）、OpenRouter／Anthropic。

## 部署
- Railway project `iwantphoto`（id `8c4a2621-fda2-4dec-90a6-2ecd282ec056`），service `iwantphoto`（`d7e77e80-7dbc-4522-aed0-28d6570179d6`）＋`MySQL`，環境 `production`（`250344e7-41be-481f-a911-9ab5dd3df8c0`）。
- **部署 branch：`main`**。網址 https://iwantphoto.com （＋www；Railway：iwantphoto-production.up.railway.app）。
- `railway.json`：build `pnpm install --frozen-lockfile && pnpm run build && node scripts/fetch-models.mjs`，start `pnpm start`，healthcheck `/healthz`。**start 唔會自動 migration**（資料庫係由 Manus 備份還原），新表要自己 `pnpm db:push`。
- Google OAuth redirect：`https://iwantphoto.com/api/oauth/callback`；Stripe webhook：`https://iwantphoto.com/api/stripe/webhook`。
- Variables（只記名稱）：`DATABASE_URL`、`JWT_SECRET`、`APP_BASE_URL`、`OWNER_EMAIL`、`GOOGLE_CLIENT_ID／SECRET`、`OPENROUTER_API_KEY`、`ANTHROPIC_API_KEY`、`S3_ENDPOINT／REGION／BUCKET／ACCESS_KEY_ID／SECRET_ACCESS_KEY／FORCE_PATH_STYLE`、`IWANTPHOTO_STRIPE_SECRET_KEY`、`IWANTPHOTO_STRIPE_WEBHOOK_SECRET`、`IWANTPHOTO_BILLING_ENABLED`、`NODE_ENV`。

## 注意
- repo **公開**：客戶圖片、資料庫備份、密鑰一律唔入 repo。
- 媒體 URL 保持 `/manus-storage/<key>`（bucket 用同樣 key）。
- 之前用 PR 流程：工作 branch `claude/beautiful-cerf-uf0xlx`（已全部 merge），PR #1–#16。

## 修改歷史（摘要）
- 10-02：由 Manus 交接匯入 → Google OAuth、S3、OpenRouter → 透明輸出 → Gemini 3.1 Flash Image 後備 → Railway 設定、/healthz、verify:ai → 加強 auth／儲存 proxy。
- 10-03：依賴升級、S3 path-style、EXIF、AI 編輯對齊、主體保持原色、填補誤刪小點、錯位就失敗。
- 10-04–10-05：本地 ISNet 去背、各種透明縫隙處理、一次性 credits 計入剩餘數、ISNet＋BiRefNet、手動還原／擦除筆刷。
