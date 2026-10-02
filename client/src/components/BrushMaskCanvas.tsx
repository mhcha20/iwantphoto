import { useEffect, useRef, useState } from "react";

type BrushMaskCanvasProps = {
  imageSrc: string;
  alt: string;
  enabled: boolean;
  brushSize: number;
  resetKey: number;
  onMaskChange: (maskData: string | null) => void;
};

type Point = { x: number; y: number };

export function BrushMaskCanvas({ imageSrc, alt, enabled, brushSize, resetKey, onMaskChange }: BrushMaskCanvasProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCanvas, setHasCanvas] = useState(false);
  const lastPointRef = useRef<Point | null>(null);
  const drawingRef = useRef(false);

  const resizeCanvas = () => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    const { width, height } = image.getBoundingClientRect();
    if (!width || !height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    setHasCanvas(true);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onMaskChange(null);
  };

  useEffect(() => {
    if (!hasCanvas) return;
    clearCanvas();
    // resetKey intentionally clears selection whenever the user switches images or presses clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const drawSegment = (from: Point, to: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = canvas.width / canvas.getBoundingClientRect().width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(239, 68, 68, 0.82)";
    context.lineWidth = brushSize * ratio;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    const point = getPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point;
    drawSegment(point, point);
  };

  const continueDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!enabled || !drawingRef.current || !lastPointRef.current) return;
    const point = getPoint(event);
    if (!point) return;
    drawSegment(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) onMaskChange(canvas.toDataURL("image/png"));
  };

  return (
    <div className="relative inline-block max-h-[430px] max-w-full">
      <img ref={imageRef} src={imageSrc} alt={alt} onLoad={resizeCanvas} className="block max-h-[430px] max-w-full rounded-[12px] object-contain shadow-[0_16px_38px_rgba(27,48,77,.22)]" />
      <canvas
        ref={canvasRef}
        aria-label={enabled ? "在相片上繪畫要清除的區域" : "筆刷選取範圍"}
        className={`absolute inset-0 h-full w-full rounded-[12px] ${enabled ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
        onPointerDown={startDrawing}
        onPointerMove={continueDrawing}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
      />
    </div>
  );
}
