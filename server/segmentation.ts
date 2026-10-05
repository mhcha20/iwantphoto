/**
 * Subject segmentation running locally on CPU with two models whose results are combined:
 * - ISNet (DIS, "isnet-general-use", Apache-2.0): fast, good at solid products and fine outlines.
 * - BiRefNet ("general-lite", MIT): slower, better at see-through and dark parts (a clear plastic
 *   bag, a dark wrapper inside it) that ISNet misses.
 *
 * Unlike an image-generation model they never redraw the photo: they score every original pixel
 * as subject or background, so edges, position and scale are exact by construction.
 * Model files are fetched at build time by scripts/fetch-models.mjs.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { ImageSize } from "./imagePostProcess";

const MODEL_INPUT = 1024;
const MODEL_DIR = process.env.SEGMENTATION_MODEL_DIR ?? path.resolve("models");
const THREADS = Math.max(1, Math.min(8, os.availableParallelism()));

type ModelSpec = {
  file: string;
  /** Converts a 0-255 RGB value of channel `c` to the model's input value. */
  normalize: (value: number, channel: number, max: number) => number;
  /** How the raw output becomes a 0-1 subject probability. */
  activation: "minmax" | "sigmoid";
};

const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

const MODELS: ModelSpec[] = [
  // ISNet: scale by the image maximum, subtract 0.5 (std 1); output is min-max scaled.
  { file: "isnet-general-use.onnx", normalize: (v, _c, max) => v / max - 0.5, activation: "minmax" },
  // BiRefNet: ImageNet mean/std; output is a logit.
  { file: "birefnet-general-lite.onnx", normalize: (v, c) => (v / 255 - IMAGENET_MEAN[c]) / IMAGENET_STD[c], activation: "sigmoid" },
];

type Session = {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: ArrayLike<number> }>>;
};
type OrtModule = {
  InferenceSession: { create(path: string, options: Record<string, unknown>): Promise<Session> };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
};

const sessions = new Map<string, Promise<{ ort: OrtModule; session: Session }>>();
// One inference at a time keeps peak memory near a single run.
let queue: Promise<unknown> = Promise.resolve();

function modelPath(spec: ModelSpec) {
  return path.join(MODEL_DIR, spec.file);
}

function availableModels() {
  return MODELS.filter((spec) => fs.existsSync(modelPath(spec)));
}

export function isSegmentationAvailable() {
  return availableModels().length > 0;
}

function loadModel(spec: ModelSpec) {
  let loading = sessions.get(spec.file);
  if (!loading) {
    loading = (async () => {
      // Imported lazily so the native runtime is only loaded on servers that use it.
      const ort = (await import("onnxruntime-node")) as unknown as OrtModule;
      const session = await ort.InferenceSession.create(modelPath(spec), {
        graphOptimizationLevel: "basic",
        enableCpuMemArena: false,
        intraOpNumThreads: THREADS,
      });
      return { ort, session };
    })();
    sessions.set(spec.file, loading);
    loading.catch(() => sessions.delete(spec.file));
  }
  return loading;
}

async function runModel(spec: ModelSpec, rgb: Buffer, max: number): Promise<Uint8Array> {
  const { ort, session } = await loadModel(spec);
  const plane = MODEL_INPUT * MODEL_INPUT;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) input[c * plane + i] = spec.normalize(rgb[i * 3 + c], c, max);
  }
  const outputs = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, MODEL_INPUT, MODEL_INPUT]) });
  const prediction = outputs[session.outputNames[0]].data;
  const mask = new Uint8Array(plane);
  if (spec.activation === "sigmoid") {
    for (let i = 0; i < plane; i++) mask[i] = Math.round(255 / (1 + Math.exp(-prediction[i])));
    return mask;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < plane; i++) {
    if (prediction[i] < lo) lo = prediction[i];
    if (prediction[i] > hi) hi = prediction[i];
  }
  const range = hi - lo || 1;
  for (let i = 0; i < plane; i++) mask[i] = Math.round(((prediction[i] - lo) / range) * 255);
  return mask;
}

/**
 * Subject probability (0-255) for every pixel of `image`, resized to `size`. With both models
 * installed each pixel takes the higher of the two scores, so each model covers the other's misses.
 */
export async function segmentSubject(image: Buffer, size: ImageSize): Promise<Uint8Array> {
  const run = queue.then(async () => {
    const rgb = await sharp(image).resize(MODEL_INPUT, MODEL_INPUT, { fit: "fill" }).removeAlpha().raw().toBuffer();
    let max = 1;
    for (let i = 0; i < rgb.length; i++) if (rgb[i] > max) max = rgb[i];
    const combined = Buffer.alloc(MODEL_INPUT * MODEL_INPUT);
    for (const spec of availableModels()) {
      const mask = await runModel(spec, rgb, max);
      for (let i = 0; i < combined.length; i++) if (mask[i] > combined[i]) combined[i] = mask[i];
    }
    const resized = await sharp(combined, { raw: { width: MODEL_INPUT, height: MODEL_INPUT, channels: 1 } })
      .resize(size.width, size.height, { fit: "fill" })
      .extractChannel(0)
      .raw()
      .toBuffer();
    return new Uint8Array(resized.buffer, resized.byteOffset, resized.length);
  });
  queue = run.catch(() => undefined);
  return run;
}
