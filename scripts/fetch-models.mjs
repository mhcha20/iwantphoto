/**
 * Downloads the segmentation model used for background removal (run at build time).
 * ISNet "isnet-general-use" (DIS, Apache-2.0), ONNX export published with rembg.
 * The checksum is pinned so a corrupted or swapped file fails the build.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MODEL = {
  file: path.resolve("models", "isnet-general-use.onnx"),
  url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx",
  sha256: "60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a",
};

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

if (fs.existsSync(MODEL.file) && sha256(MODEL.file) === MODEL.sha256) {
  console.log(`[models] ${path.basename(MODEL.file)} already present`);
} else {
  fs.mkdirSync(path.dirname(MODEL.file), { recursive: true });
  console.log(`[models] downloading ${MODEL.url}`);
  const response = await fetch(MODEL.url);
  if (!response.ok) throw new Error(`Model download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== MODEL.sha256) throw new Error(`Model checksum mismatch: ${digest}`);
  fs.writeFileSync(MODEL.file, bytes);
  console.log(`[models] saved ${path.basename(MODEL.file)} (${(bytes.length / 1e6).toFixed(0)} MB)`);
}
