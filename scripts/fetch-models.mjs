/**
 * Downloads the segmentation models used for background removal (run at build time):
 * - ISNet "isnet-general-use" (DIS, Apache-2.0)
 * - BiRefNet "general-lite" (MIT)
 * Both are the ONNX exports published with rembg. Checksums are pinned so a corrupted or swapped
 * file fails the build.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const RELEASE = "https://github.com/danielgatis/rembg/releases/download/v0.0.0";
const MODELS = [
  {
    file: path.resolve("models", "isnet-general-use.onnx"),
    url: `${RELEASE}/isnet-general-use.onnx`,
    sha256: "60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a",
  },
  {
    file: path.resolve("models", "birefnet-general-lite.onnx"),
    url: `${RELEASE}/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx`,
    sha256: "5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333",
  },
];

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

for (const model of MODELS) {
  if (fs.existsSync(model.file) && sha256(model.file) === model.sha256) {
    console.log(`[models] ${path.basename(model.file)} already present`);
    continue;
  }
  fs.mkdirSync(path.dirname(model.file), { recursive: true });
  console.log(`[models] downloading ${model.url}`);
  const response = await fetch(model.url);
  if (!response.ok) throw new Error(`Model download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== model.sha256) throw new Error(`Model checksum mismatch for ${path.basename(model.file)}: ${digest}`);
  fs.writeFileSync(model.file, bytes);
  console.log(`[models] saved ${path.basename(model.file)} (${(bytes.length / 1e6).toFixed(0)} MB)`);
}
