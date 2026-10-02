import { useState } from "react";
import { BeforeAfterComparison } from "@/components/BeforeAfterComparison";
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, Minus, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { DEFAULT_COMPARISON_ALIGNMENT, type ComparisonAlignment } from "@/lib/imageAlignment";

type ProcessedImageComparisonProps = {
  originalSrc: string;
  processedSrc: string;
  fileName: string;
  maxHeight?: number;
  onReturnToOriginal: () => void;
  afterAlignment?: ComparisonAlignment;
  onAdjustAlignment?: (horizontalDelta: number, verticalDelta: number) => void;
  onAdjustScale?: (scaleDelta: number) => void;
  onSetAlignment?: (updates: Partial<ComparisonAlignment>) => void;
  onResetAlignment?: () => void;
  onSaveAsDefault?: () => void;
  onClearSavedDefault?: () => void;
  hasSavedDefault?: boolean;
};

export function ProcessedImageComparison({
  originalSrc,
  processedSrc,
  fileName,
  maxHeight = 430,
  onReturnToOriginal,
  afterAlignment = DEFAULT_COMPARISON_ALIGNMENT,
  onAdjustAlignment,
  onAdjustScale,
  onSetAlignment,
  onResetAlignment,
  onSaveAsDefault,
  onClearSavedDefault,
  hasSavedDefault = false,
}: ProcessedImageComparisonProps) {
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const canFineTune = Boolean(onAdjustAlignment && onAdjustScale && onSetAlignment && onResetAlignment);
  const adjustAlignment = onAdjustAlignment ?? (() => undefined);
  const adjustScale = onAdjustScale ?? (() => undefined);
  const setAlignment = onSetAlignment ?? (() => undefined);
  const resetAlignment = onResetAlignment ?? (() => undefined);

  return (
    <div className="h-full w-full">
      <BeforeAfterComparison
        beforeSrc={originalSrc}
        afterSrc={processedSrc}
        alt={`${fileName} 處理前後比較`}
        className="mx-auto max-w-full rounded-[12px] shadow-[0_16px_38px_rgba(27,48,77,.22)]"
        maxHeight={maxHeight}
        afterAlignment={afterAlignment}
      />
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-[#52647c]">
        <ArrowLeftRight size={14} className="text-[#1665d8]" />
        在相片上左右滑動，即時比較原始與已處理效果
      </p>
      {canFineTune && <div className="mx-auto mt-2 max-w-[286px]">
        <button type="button" onClick={() => setFineTuneOpen((open) => !open)} aria-expanded={fineTuneOpen} className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1665d8] focus-visible:ring-offset-2 ${fineTuneOpen ? "border-[#89afe7] bg-[#eaf3ff] text-[#0e5bc3]" : "border-[#bfd3ee] bg-white text-[#1665d8] hover:bg-[#eaf2ff]"}`}>
          <SlidersHorizontal size={14} />{fineTuneOpen ? "完成微調" : "微調已處理相片位置及大小"}
        </button>
        {fineTuneOpen && <div className="mt-2 rounded-xl border border-[#cbdced] bg-[#f8fbff] p-3 text-left shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><strong className="block text-[11px] text-[#33445c]">精細對齊</strong><span className="mt-0.5 block text-[10px] leading-4 text-[#6d7d92]">只會調整比較預覽，不會改動下載檔案。</span></div><button type="button" onClick={resetAlignment} className="flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold text-[#1665d8] hover:bg-[#eaf2ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1665d8]" aria-label="重設已處理相片位置及大小"><RotateCcw size={12} />重設</button></div>
          <div className="mt-3 space-y-2.5">
            <label className="block"><span className="flex justify-between text-[10px] font-bold text-[#586a82]"><span>左右位置</span><span>{afterAlignment.x.toFixed(2)}%</span></span><input aria-label="已處理相片左右位置" type="range" min="-20" max="20" step="0.25" value={afterAlignment.x} onChange={(event) => setAlignment({ x: Number(event.target.value) })} className="mt-1 h-1.5 w-full accent-[#1665d8]" /></label>
            <label className="block"><span className="flex justify-between text-[10px] font-bold text-[#586a82]"><span>上下位置</span><span>{afterAlignment.y.toFixed(2)}%</span></span><input aria-label="已處理相片上下位置" type="range" min="-20" max="20" step="0.25" value={afterAlignment.y} onChange={(event) => setAlignment({ y: Number(event.target.value) })} className="mt-1 h-1.5 w-full accent-[#1665d8]" /></label>
            <label className="block"><span className="flex justify-between text-[10px] font-bold text-[#586a82]"><span>成品大小</span><span>{(afterAlignment.scale * 100).toFixed(2)}%</span></span><input aria-label="已處理相片大小" type="range" min="80" max="120" step="0.25" value={afterAlignment.scale * 100} onChange={(event) => setAlignment({ scale: Number(event.target.value) / 100 })} className="mt-1 h-1.5 w-full accent-[#1665d8]" /></label>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5"><button type="button" onClick={() => adjustAlignment(0, -0.25)} className="grid h-7 w-7 place-items-center rounded-md border border-[#cedceb] text-[#315375] hover:bg-[#eaf2ff]" aria-label="已處理相片向上微調"><ArrowUp size={14} /></button><button type="button" onClick={() => adjustAlignment(-0.25, 0)} className="grid h-7 w-7 place-items-center rounded-md border border-[#cedceb] text-[#315375] hover:bg-[#eaf2ff]" aria-label="已處理相片向左微調"><ArrowLeft size={14} /></button><span className="grid h-7 min-w-11 place-items-center rounded-md bg-[#eaf2ff] text-[10px] font-bold text-[#2b63ad]">0.25%</span><button type="button" onClick={() => adjustAlignment(0.25, 0)} className="grid h-7 w-7 place-items-center rounded-md border border-[#cedceb] text-[#315375] hover:bg-[#eaf2ff]" aria-label="已處理相片向右微調"><ArrowRight size={14} /></button><button type="button" onClick={() => adjustAlignment(0, 0.25)} className="grid h-7 w-7 place-items-center rounded-md border border-[#cedceb] text-[#315375] hover:bg-[#eaf2ff]" aria-label="已處理相片向下微調"><ArrowDown size={14} /></button><span className="mx-1 h-5 w-px bg-[#d9e4f0]" /><button type="button" onClick={() => adjustScale(-0.0025)} className="grid h-7 w-7 place-items-center rounded-md border border-[#cedceb] text-[#315375] hover:bg-[#eaf2ff]" aria-label="縮小已處理相片"><Minus size={14} /></button><button type="button" onClick={() => adjustScale(0.0025)} className="grid h-7 w-7 place-items-center rounded-md border border-[#cedceb] text-[#315375] hover:bg-[#eaf2ff]" aria-label="放大已處理相片"><Plus size={14} /></button></div>
          {onSaveAsDefault && <div className="mt-3 border-t border-[#dae5f1] pt-3"><button type="button" onClick={onSaveAsDefault} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1665d8] px-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#0d56bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1665d8] focus-visible:ring-offset-2"><SlidersHorizontal size={13} />設為日後預設</button>{hasSavedDefault && onClearSavedDefault && <button type="button" onClick={onClearSavedDefault} className="mt-1.5 h-7 w-full rounded-lg text-[10px] font-bold text-[#62758e] transition hover:bg-[#eaf2ff] hover:text-[#1665d8]">取消已儲存預設</button>}</div>}
        </div>}
      </div>}
      <button type="button" onClick={onReturnToOriginal} className="mx-auto mt-2 flex h-9 items-center gap-1.5 rounded-lg border border-[#bfd3ee] bg-white px-3 text-xs font-bold text-[#1665d8] shadow-sm transition hover:bg-[#eaf2ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1665d8] focus-visible:ring-offset-2">
        <ArrowLeft size={14} />返回原始相片
      </button>
    </div>
  );
}
