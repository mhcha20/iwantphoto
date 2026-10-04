/**
 * Subject segmentation with ISNet (DIS, "isnet-general-use", Apache-2.0) running locally on CPU.
 *
 * Unlike an image-generation model it never redraws the photo: it scores every original pixel
 * as subject or background, so edges, position and scale are exact by construction.
 * The model file is fetched at build time by scripts/fetch-models.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { ImageSize } from "./imagePostProcess";

const MODEL_INPUT = 1024;
const MODEL_PATH = process.env.SEGMENTATION_MODEL_PATH ?? path.resolve("models", "isnet-general-use.onnx");

type Session = {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: ArrayLike<number> }>>;
};
type OrtModule = {
  InferenceSession: { create(path: string, options: Record<string, unknown>): Promise<Session> };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
};

let loading: Promise<{ ort: OrtModule; session: Session }> | undefined;
// One inference at a time keeps peak memory near a single run (~0.5 GB).
let queue: Promise<unknown> = Promise.resolve();

export function isSegmentationAvailable() {
  return fs.existsSync(MODEL_PATH);
}

function loadModel() {
  loading ??= (async () => {
    // Imported lazily so the native runtime is only loaded on servers that use it.
    const ort = (await import("onnxruntime-node")) as unknown as OrtModule;
    const session = await ort.InferenceSession.create(MODEL_PATH, {
      graphOptimizationLevel: "basic",
      enableCpuMemArena: false,
      intraOpNumThreads: 2,
    });
    return { ort, session };
  })();
  loading.catch(() => {
    loading = undefined;
  });
  return loading;
}

/** Subject probability (0-255) for every pixel of `image`, resized to `size`. */
export async function segmentSubject(image: Buffer, size: ImageSize): Promise<Uint8Array> {
  const run = queue.then(async () => {
    const { ort, session } = await loadModel();
    const rgb = await sharp(image).resize(MODEL_INPUT, MODEL_INPUT, { fit: "fill" }).removeAlpha().raw().toBuffer();
    let max = 1;
    for (let i = 0; i < rgb.length; i++) if (rgb[i] > max) max = rgb[i];
    const plane = MODEL_INPUT * MODEL_INPUT;
    const input = new Float32Array(3 * plane);
    // ISNet preprocessing: scale by the image maximum, subtract 0.5 (std 1), channels first.
    for (let i = 0; i < plane; i++) {
      for (let c = 0; c < 3; c++) input[c * plane + i] = rgb[i * 3 + c] / max - 0.5;
    }
    const outputs = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, MODEL_INPUT, MODEL_INPUT]) });
    const prediction = outputs[session.outputNames[0]].data;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < plane; i++) {
      if (prediction[i] < lo) lo = prediction[i];
      if (prediction[i] > hi) hi = prediction[i];
    }
    const range = hi - lo || 1;
    const mask = Buffer.alloc(plane);
    for (let i = 0; i < plane; i++) mask[i] = Math.round(((prediction[i] - lo) / range) * 255);
    const resized = await sharp(mask, { raw: { width: MODEL_INPUT, height: MODEL_INPUT, channels: 1 } })
      .resize(size.width, size.height, { fit: "fill" })
      .extractChannel(0)
      .raw()
      .toBuffer();
    return new Uint8Array(resized.buffer, resized.byteOffset, resized.length);
  });
  queue = run.catch(() => undefined);
  return run;
}
