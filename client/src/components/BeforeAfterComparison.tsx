import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { constrainComparisonPosition } from "@/lib/comparisonPosition";
import { getComparisonWidth, getImageAspectRatio } from "@/lib/imageAspectRatio";
import { getComparisonImageFit } from "@/lib/comparisonCanvas";
import { DEFAULT_COMPARISON_ALIGNMENT, getComparisonAlignmentTransform, type ComparisonAlignment } from "@/lib/imageAlignment";

type BeforeAfterComparisonProps = {
  beforeSrc: string;
  afterSrc: string;
  alt: string;
  className?: string;
  maxHeight?: number;
  afterAlignment?: ComparisonAlignment;
};

export function BeforeAfterComparison({ beforeSrc, afterSrc, alt, className = "", maxHeight, afterAlignment = DEFAULT_COMPARISON_ALIGNMENT }: BeforeAfterComparisonProps) {
  const [position, setPosition] = useState(50);
  const [aspectRatio, setAspectRatio] = useState(4 / 3);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const imageFit = getComparisonImageFit();

  useEffect(() => {
    setAspectRatio(4 / 3);
  }, [beforeSrc]);

  const updatePosition = (clientX: number) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPosition(constrainComparisonPosition(((clientX - bounds.left) / bounds.width) * 100));
  };

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-[18px] bg-[#dce6f0] select-none touch-none ${className}`}
      style={{ aspectRatio, width: getComparisonWidth(aspectRatio, maxHeight) }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updatePosition(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updatePosition(event.clientX);
      }}
      aria-labelledby={labelId}
    >
      <img src={afterSrc} alt={`${alt}，處理後`} draggable={false} loading="lazy" style={{ transform: getComparisonAlignmentTransform(afterAlignment) }} className={`absolute inset-0 h-full w-full ${imageFit}`} />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={beforeSrc} alt="" aria-hidden="true" draggable={false} loading="eager" onLoad={(event) => setAspectRatio(getImageAspectRatio(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight))} className={`h-full w-full ${imageFit}`} />
      </div>
      <div className="absolute inset-y-0 z-[1] w-px bg-white/95 shadow-[0_0_0_1px_rgba(11,31,57,.14)]" style={{ left: `${position}%` }} aria-hidden="true">
        <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/85 bg-[#1665d8] text-white shadow-[0_7px_18px_rgba(8,43,98,.34)] transition-transform duration-200 group-hover:scale-110"><ArrowLeftRight size={17} /></span>
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-[#10213b]/78 px-2.5 py-1 text-[10px] font-bold tracking-[.05em] text-white backdrop-blur">處理前</span>
      <span className="absolute right-3 top-3 rounded-full bg-[#168464]/90 px-2.5 py-1 text-[10px] font-bold tracking-[.05em] text-white shadow-sm">處理後</span>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0c1d36]/42 to-transparent" aria-hidden="true" />
      <input
        aria-label={`${alt}：使用左右方向鍵比較處理前後效果`}
        aria-describedby={labelId}
        type="range"
        min="4"
        max="96"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        className="absolute inset-0 z-[2] h-full w-full cursor-ew-resize opacity-0"
      />
      <span id={labelId} className="sr-only">拖曳分隔線以比較處理前後效果。</span>
    </div>
  );
}
