import { useEffect, useRef, useState } from "react";
import { Brush, Eraser, Eye, EyeOff, Loader2, RotateCcw, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_TOUCH_UP_UNDO, hasTransparency, strokeBounds, touchUpSourceUrl, type Point, type TouchUpTool } from "@/lib/cutoutTouchUp";

type CutoutTouchUpEditorProps = {
  originalSrc: string;
  resultSrc: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (png: Blob) => void | Promise<void>;
};

type Patch = { x: number; y: number; data: ImageData };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(src)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed to load"));
    image.src = src;
  });
}

/**
 * Manual correction of a background-removal result: "restore" paints the original photo's own pixels
 * back, "erase" removes pixels (to transparent, or white for a white-background result). Runs entirely
 * in the browser; no AI and no credit.
 */
export function CutoutTouchUpEditor({ originalSrc, resultSrc, saving, onCancel, onSave }: CutoutTouchUpEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLCanvasElement | null>(null);
  const stampRef = useRef<HTMLCanvasElement | null>(null);
  const resultImageRef = useRef<HTMLImageElement | null>(null);
  const transparentRef = useRef(true);
  const strokesRef = useRef<Patch[][]>([]);
  const currentStrokeRef = useRef<Patch[] | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const [tool, setTool] = useState<TouchUpTool>("restore");
  const [brushSize, setBrushSize] = useState(36);
  const [showGuide, setShowGuide] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [undoCount, setUndoCount] = useState(0);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([loadImage(touchUpSourceUrl(resultSrc)), loadImage(originalSrc)])
      .then(([result, original]) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const width = result.naturalWidth;
        const height = result.naturalHeight;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("canvas unavailable");
        context.drawImage(result, 0, 0);
        transparentRef.current = hasTransparency(context.getImageData(0, 0, width, height).data);
        // The result keeps the original's geometry, so the original scaled to the same size lines up.
        const originalCanvas = document.createElement("canvas");
        originalCanvas.width = width;
        originalCanvas.height = height;
        originalCanvas.getContext("2d")?.drawImage(original, 0, 0, width, height);
        const stamp = document.createElement("canvas");
        stamp.width = width;
        stamp.height = height;
        originalRef.current = originalCanvas;
        stampRef.current = stamp;
        resultImageRef.current = result;
        strokesRef.current = [];
        setUndoCount(0);
        setEdited(false);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [originalSrc, resultSrc]);

  const toCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const paintSegment = (from: Point, to: Point) => {
    const canvas = canvasRef.current;
    const stamp = stampRef.current;
    const original = originalRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    const stampContext = stamp?.getContext("2d");
    if (!canvas || !stamp || !original || !context || !stampContext) return;
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const radius = (brushSize / 2) * scale;
    const box = strokeBounds(from, to, radius, canvas.width, canvas.height);
    if (!box.width || !box.height) return;
    currentStrokeRef.current?.push({ x: box.x, y: box.y, data: context.getImageData(box.x, box.y, box.width, box.height) });

    // Brush shape on the stamp canvas, then filled with what the tool paints.
    stampContext.globalCompositeOperation = "source-over";
    stampContext.clearRect(box.x, box.y, box.width, box.height);
    stampContext.lineCap = "round";
    stampContext.lineJoin = "round";
    stampContext.lineWidth = radius * 2;
    stampContext.strokeStyle = "#000";
    stampContext.beginPath();
    stampContext.moveTo(from.x, from.y);
    stampContext.lineTo(to.x, to.y);
    stampContext.stroke();
    stampContext.globalCompositeOperation = "source-in";
    if (tool === "restore") {
      stampContext.drawImage(original, box.x, box.y, box.width, box.height, box.x, box.y, box.width, box.height);
    } else {
      stampContext.fillStyle = "#fff";
      stampContext.fillRect(box.x, box.y, box.width, box.height);
    }
    stampContext.globalCompositeOperation = "source-over";

    context.globalCompositeOperation = tool === "erase" && transparentRef.current ? "destination-out" : "source-over";
    context.drawImage(stamp, box.x, box.y, box.width, box.height, box.x, box.y, box.width, box.height);
    context.globalCompositeOperation = "source-over";
  };

  const startStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "ready" || saving) return;
    const point = toCanvasPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    currentStrokeRef.current = [];
    lastPointRef.current = point;
    paintSegment(point, point);
  };

  const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current || !lastPointRef.current) return;
    const point = toCanvasPoint(event);
    if (!point) return;
    paintSegment(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const endStroke = () => {
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    lastPointRef.current = null;
    if (!stroke?.length) return;
    strokesRef.current = [...strokesRef.current, stroke].slice(-MAX_TOUCH_UP_UNDO);
    setUndoCount(strokesRef.current.length);
    setEdited(true);
  };

  const undo = () => {
    const context = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    const stroke = strokesRef.current.pop();
    if (!context || !stroke) return;
    for (let i = stroke.length - 1; i >= 0; i--) context.putImageData(stroke[i].data, stroke[i].x, stroke[i].y);
    setUndoCount(strokesRef.current.length);
  };

  const reset = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const result = resultImageRef.current;
    if (!canvas || !context || !result) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(result, 0, 0);
    strokesRef.current = [];
    setUndoCount(0);
    setEdited(false);
  };

  const save = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) void onSave(blob);
    }, "image/png");
  };

  return (
    <div className="w-full">
      <div className="mx-auto mb-3 flex max-w-[420px] flex-wrap items-center justify-center gap-2">
        <div className="flex rounded-xl bg-[#eef3f8] p-1" role="group" aria-label="修補工具">
          <button type="button" onClick={() => setTool("restore")} aria-pressed={tool === "restore"} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${tool === "restore" ? "bg-white text-[#168464] shadow-sm" : "text-[#6d7c91]"}`}><Brush size={13} />補回</button>
          <button type="button" onClick={() => setTool("erase")} aria-pressed={tool === "erase"} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${tool === "erase" ? "bg-white text-[#b64732] shadow-sm" : "text-[#6d7c91]"}`}><Eraser size={13} />擦走</button>
        </div>
        <button type="button" onClick={() => setShowGuide((value) => !value)} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#53657c] hover:bg-[#eef3f8]">{showGuide ? <EyeOff size={13} /> : <Eye size={13} />}{showGuide ? "隱藏原圖輪廓" : "顯示原圖輪廓"}</button>
        <label className="flex w-full items-center gap-2 text-[11px] font-semibold text-[#617087]">筆刷大小<input aria-label="修補筆刷大小" type="range" min="8" max="120" step="2" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="h-1 flex-1 accent-[#1665d8]" /><span className="w-7 text-right">{brushSize}</span></label>
      </div>
      <div className="relative mx-auto w-fit max-w-full">
        <div className="relative overflow-hidden rounded-[12px] bg-[length:20px_20px] shadow-[0_16px_38px_rgba(27,48,77,.22)]" style={{ backgroundColor: "#ffffff", backgroundImage: "linear-gradient(45deg,#e6ebf2 25%,transparent 25%,transparent 75%,#e6ebf2 75%),linear-gradient(45deg,#e6ebf2 25%,transparent 25%,transparent 75%,#e6ebf2 75%)", backgroundPosition: "0 0,10px 10px" }}>
          {showGuide && status === "ready" && <img src={originalSrc} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-30" />}
          <canvas
            ref={canvasRef}
            aria-label={tool === "restore" ? "在相片上塗抹以補回被誤刪的部分" : "在相片上塗抹以擦走多餘的背景"}
            className={`relative block max-h-[430px] max-w-full touch-none ${status === "ready" ? "cursor-crosshair" : "invisible h-40 w-64"}`}
            onPointerDown={startStroke}
            onPointerMove={continueStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          />
          {status === "loading" && <div className="absolute inset-0 grid place-items-center text-xs font-bold text-[#53657c]"><Loader2 className="animate-spin" size={18} /></div>}
          {status === "error" && <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs font-bold text-[#b64732]">未能載入相片，請關閉後再試。</div>}
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-[420px] text-center text-[11px] leading-5 text-[#64758c]">「補回」會用原圖像素補回被誤刪的部分；「擦走」會移除多餘背景。修補不會使用 AI，亦不會扣除額度。</p>
      <div className="mx-auto mt-2 flex max-w-[420px] flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="ghost" onClick={undo} disabled={!undoCount || saving} className="h-9 rounded-lg px-3 text-xs font-bold text-[#53657c]"><Undo2 size={14} />復原</Button>
        <Button type="button" variant="ghost" onClick={reset} disabled={!edited || saving} className="h-9 rounded-lg px-3 text-xs font-bold text-[#53657c]"><RotateCcw size={14} />重設</Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="h-9 rounded-lg px-3 text-xs font-bold text-[#53657c]"><X size={14} />取消</Button>
        <Button type="button" onClick={save} disabled={!edited || saving || status !== "ready"} className="h-9 rounded-lg bg-[#1665d8] px-4 text-xs font-bold text-white hover:bg-[#0d56bd]">{saving ? <Loader2 className="animate-spin" size={14} /> : <Brush size={14} />}儲存修補</Button>
      </div>
    </div>
  );
}
