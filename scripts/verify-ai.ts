/**
 * Deployment smoke test for the three external services: S3 bucket, OpenRouter LLM and OpenRouter image editing.
 *
 *   pnpm verify:ai              # everything
 *   pnpm verify:ai storage      # only the bucket
 *   pnpm verify:ai llm image    # any subset of: storage llm image
 *
 * Run it with the same environment variables as production (see HOST-ENVIRONMENT.template), e.g.
 * `railway run pnpm verify:ai`. Image results are written to ./verify-output/ so you can inspect them.
 * It bills a handful of OpenRouter calls and writes/deletes one small bucket object.
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ENV } from "../server/_core/env";
import { generateImage } from "../server/_core/imageGeneration";
import { invokeLLM } from "../server/_core/llm";
import { KEY_COLOR_PROMPT, pickKeyColor } from "../server/imagePostProcess";
import { getManagedStorageKey, storageDelete, storageGetByteSize, storageGetSignedUrl, storagePut } from "../server/storage";

const OUTPUT_DIR = path.resolve("verify-output");
const WIDTH = 1200;
const HEIGHT = 800;

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

async function check(name: string, run: () => Promise<string>) {
  const started = Date.now();
  try {
    const detail = await run();
    results.push({ name, ok: true, detail: `${detail} (${((Date.now() - started) / 1000).toFixed(1)}s)` });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message.slice(0, 400) : String(error) });
  }
  const last = results[results.length - 1];
  console.log(`${last.ok ? "PASS" : "FAIL"}  ${last.name}  ${last.detail}`);
}

function requireEnv(label: string, values: Record<string, string>) {
  const missing = Object.entries(values).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
  return label;
}

/** A synthetic product shot: blue mug on a beige table with a yellow price tag to remove. */
async function sampleProductPhoto() {
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#c9b79c"/><rect y="560" width="${WIDTH}" height="240" fill="#8a7a62"/>
    <rect x="420" y="250" width="270" height="310" rx="30" fill="#2b6cb0"/>
    <rect x="690" y="320" width="70" height="150" rx="35" fill="none" stroke="#2b6cb0" stroke-width="22"/>
    <text x="555" y="420" font-size="54" text-anchor="middle" fill="#fff" font-family="sans-serif">COFFEE</text>
    <rect x="80" y="110" width="210" height="70" fill="#f5e663"/>
    <text x="185" y="157" font-size="34" text-anchor="middle" fill="#222" font-family="sans-serif">SALE $9</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

async function loadStored(url: string) {
  const key = getManagedStorageKey(url);
  if (!key) throw new Error(`unexpected stored url ${url}`);
  const response = await fetch(await storageGetSignedUrl(key));
  if (!response.ok) throw new Error(`stored image not readable (${response.status})`);
  return { key, bytes: Buffer.from(await response.arrayBuffer()) };
}

async function verifyStorage() {
  await check("storage: write, signed read, size, delete", async () => {
    requireEnv("s3", { S3_BUCKET: ENV.s3Bucket, S3_ACCESS_KEY_ID: ENV.s3AccessKeyId, S3_SECRET_ACCESS_KEY: ENV.s3SecretAccessKey });
    const payload = Buffer.from(`iwantphoto verify ${new Date().toISOString()}`);
    const { key, url } = await storagePut("iwantphoto/verify/probe.txt", payload, "text/plain");
    try {
      if (!url.startsWith("/manus-storage/")) throw new Error(`unexpected url form ${url}`);
      const response = await fetch(await storageGetSignedUrl(key));
      if (!response.ok || !(await response.text()).startsWith("iwantphoto verify")) throw new Error(`signed URL read failed (${response.status})`);
      const size = await storageGetByteSize(key);
      if (size !== payload.length) throw new Error(`size mismatch ${size} != ${payload.length}`);
    } finally {
      await storageDelete(key);
    }
    return `bucket ${ENV.s3Bucket}${ENV.s3Endpoint ? ` @ ${new URL(ENV.s3Endpoint).host}` : ""}`;
  });
}

async function verifyLlm() {
  await check("llm: JSON-schema output", async () => {
    requireEnv("openrouter", { OPENROUTER_API_KEY: ENV.openRouterApiKey });
    const result = await invokeLLM({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: 'Reply with JSON only: {"product":"mug","color":"blue"}' }],
      outputSchema: {
        name: "probe",
        strict: true,
        schema: {
          type: "object",
          properties: { product: { type: "string" }, color: { type: "string" } },
          required: ["product", "color"],
          additionalProperties: false,
        },
      },
    });
    const content = result.choices[0]?.message.content;
    const parsed = JSON.parse(typeof content === "string" ? content : "");
    if (typeof parsed.product !== "string") throw new Error("response did not match the schema");
    return `model ${result.model}`;
  });

  await check("llm: vision input (gemini-3-flash-preview)", async () => {
    const photo = await sampleProductPhoto();
    const result = await invokeLLM({
      model: "gemini-3-flash-preview",
      maxTokens: 1500,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "In one short sentence, what product is in this photo?" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photo.toString("base64")}` } },
        ],
      }],
    });
    const content = result.choices[0]?.message.content;
    const text = typeof content === "string" ? content : "";
    if (!text.trim()) throw new Error("empty answer");
    return `"${text.trim().slice(0, 80)}"`;
  });
}

async function verifyImages() {
  requireEnv("openrouter", { OPENROUTER_API_KEY: ENV.openRouterApiKey });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const photo = await sampleProductPhoto();
  await fs.writeFile(path.join(OUTPUT_DIR, "0-source.jpg"), photo);
  const reference = { url: `data:image/jpeg;base64,${photo.toString("base64")}`, mimeType: "image/jpeg" };

  const runEdit = (name: string, file: string, options: Parameters<typeof generateImage>[0], expectAlpha: boolean) =>
    check(name, async () => {
      const { url } = await generateImage({ ...options, originalImages: [reference], matchReferenceCanvas: true });
      if (!url) throw new Error("no image url returned");
      const { key, bytes } = await loadStored(url);
      await storageDelete(key).catch(() => undefined);
      const meta = await sharp(bytes).metadata();
      await fs.writeFile(path.join(OUTPUT_DIR, file), bytes);
      if (meta.width !== WIDTH || meta.height !== HEIGHT) throw new Error(`canvas changed to ${meta.width}x${meta.height}`);
      if (expectAlpha && !meta.hasAlpha) throw new Error("expected a transparent PNG");
      return `${meta.width}x${meta.height}${meta.hasAlpha ? " with alpha" : ""} → verify-output/${file}`;
    });

  await runEdit(
    `image: white background (${ENV.openRouterImageModel})`,
    "1-white-background.png",
    { prompt: "Remove the whole background and place only the blue mug on a pure white studio background. Preserve the mug's position, scale, label text and the original canvas size and aspect ratio." },
    false,
  );
  const keyColor = await pickKeyColor(photo);
  await runEdit(
    "image: transparent cut-out (key colour → alpha)",
    "2-transparent.png",
    { prompt: `Isolate only the blue mug on ${KEY_COLOR_PROMPT[keyColor]}. Preserve the mug's position, scale, label text and the original canvas size and aspect ratio.`, keyColor },
    true,
  );
  await runEdit(
    "image: remove object (price tag)",
    "3-remove-object.png",
    { prompt: "Remove only the yellow SALE $9 price tag and fill the area naturally from the surrounding wall. Keep everything else unchanged, including canvas size and aspect ratio." },
    false,
  );
  await check(`image: fallback model reachable (${ENV.openRouterImageFallbackModel})`, async () => {
    const { url } = await generateImage({
      prompt: "Remove only the yellow price tag. Keep everything else unchanged.",
      originalImages: [reference],
      matchReferenceCanvas: true,
      model: ENV.openRouterImageFallbackModel,
    });
    if (!url) throw new Error("no image url returned");
    const { key } = await loadStored(url);
    await storageDelete(key).catch(() => undefined);
    return "ok";
  });
}

const wanted = new Set(process.argv.slice(2));
const run = (part: string) => wanted.size === 0 || wanted.has(part);

if (run("storage")) await verifyStorage();
if (run("llm")) await verifyLlm();
if (run("image")) {
  // Image edits write to the bucket, so they are only meaningful once storage works.
  if (results.some(r => r.name.startsWith("storage") && !r.ok)) {
    console.log("SKIP  image: bucket check failed; fix storage first");
  } else {
    await verifyImages();
  }
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
