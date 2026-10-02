import { ArrowDownToLine, ArrowRight, Check, ChevronDown, FolderArchive, ImagePlus, ShieldCheck, Sparkles, Upload, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfterComparison } from "@/components/BeforeAfterComparison";
import { StorageCapacityPanel, type StorageUsageSummary } from "@/components/StorageCapacityPanel";
import type { CaseStudyPresetKey } from "@/lib/caseStudyPresets";
import type { StorageAddOnKey } from "@shared/storagePlans";

type CompactMarketingSectionsProps = {
  authenticated: boolean;
  storage: StorageUsageSummary;
  hasActiveStorageAddOn: boolean;
  checkoutPending: boolean;
  pendingAddOn?: StorageAddOnKey;
  billingEnabled: boolean;
  onStartWork: () => void;
  onStartCase: (preset: CaseStudyPresetKey) => void;
  onOpenPlans: () => void;
  onSelectStorage: (addOn: StorageAddOnKey) => void;
  onManageStorage: () => void;
};

const extraCases: Array<{ key: CaseStudyPresetKey; before: string; after: string; alt: string; label: string; title: string; action: string }> = [
  { key: "storefront", before: "/manus-storage/iwantphoto-case-storefront-before_bafa5c50.jpg", after: "/manus-storage/iwantphoto-case-storefront-after_da7b1994.png", alt: "門市宣傳相片", label: "門市", title: "店面現場", action: "試用門市清除" },
  { key: "food", before: "/manus-storage/iwantphoto-case-food-before_e4a78e76.jpg", after: "/manus-storage/iwantphoto-case-food-after_f0f52857.png", alt: "餐飲宣傳相片", label: "餐飲", title: "食物宣傳", action: "試用餐飲清除" },
  { key: "property", before: "/manus-storage/iwantphoto-case-property-before_a939d8bb.jpg", after: "/manus-storage/iwantphoto-case-property-after_ff7c7877.png", alt: "物業宣傳相片", label: "物業", title: "空間展示", action: "試用物業清除" },
];

export function CompactMarketingSections({ authenticated, storage, hasActiveStorageAddOn, checkoutPending, pendingAddOn, billingEnabled, onStartWork, onStartCase, onOpenPlans, onSelectStorage, onManageStorage }: CompactMarketingSectionsProps) {
  return <>
    <section id="cases" className="border-y border-[#dfe7f1] bg-white py-9 sm:py-12">
      <div className="container">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><span className="text-[11px] font-bold tracking-[.15em] text-[#1665d8]">快速預覽</span><h2 className="mt-1 text-2xl font-semibold tracking-[-.045em] text-[#10213b] sm:text-3xl">處理前後，一眼看清效果。</h2></div>
          <p className="max-w-md text-sm leading-6 text-[#617087]">拖動滑桿比較效果；需要時再展開更多行業案例。</p>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)] lg:items-center">
          <BeforeAfterComparison beforeSrc="/manus-storage/iwantphoto-case-product-before_fd1d235c.jpg" afterSrc="/manus-storage/iwantphoto-case-product-after_747dd8a1.png" alt="產品相片去背與清除雜物" maxHeight={390} />
          <div className="rounded-2xl border border-[#dce5ef] bg-[#fbfdff] p-5"><span className="rounded-full bg-[#e7f0ff] px-2.5 py-1 text-[10px] font-bold tracking-[.07em] text-[#1665d8]">電商與零售</span><h3 className="mt-3 text-xl font-bold tracking-[-.035em] text-[#162941]">將雜亂工作枱，變成可上架產品圖。</h3><p className="mt-2 text-sm leading-6 text-[#65758a]">保留產品真實細節，同時清除紙箱、電線、收據與周邊雜物。</p><Button onClick={() => onStartCase("product")} className="mt-4 h-10 w-full rounded-xl bg-[#1665d8] text-xs font-bold text-white hover:bg-[#0d56bd]">用相同設定開始 <ArrowRight size={15} /></Button></div>
        </div>
        <details className="group mt-4 rounded-2xl border border-[#d8e4f0] bg-[#f8fbff]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#315375]"><span>查看另外 3 個行業案例</span><ChevronDown size={17} className="transition-transform group-open:rotate-180" /></summary>
          <div className="grid gap-3 border-t border-[#dfe8f1] p-4 md:grid-cols-3">{extraCases.map((item) => <article key={item.key} className="overflow-hidden rounded-xl border border-[#dfe7ef] bg-white"><BeforeAfterComparison beforeSrc={item.before} afterSrc={item.after} alt={item.alt} maxHeight={210} /><div className="p-3"><span className="text-[10px] font-bold tracking-[.09em] text-[#708199]">{item.label}</span><strong className="mt-1 block text-sm text-[#20354e]">{item.title}</strong><Button onClick={() => onStartCase(item.key)} variant="ghost" className="mt-2 h-8 w-full rounded-lg px-2 text-xs font-bold text-[#1665d8] hover:bg-[#eaf3ff]">{item.action} <ArrowRight size={13} /></Button></div></article>)}</div>
        </details>
      </div>
    </section>

    <section id="solutions" className="bg-white py-9 sm:py-12">
      <div className="container">
        <div className="grid gap-3 md:grid-cols-3">{[
          { icon: ImagePlus, title: "產品與零售", text: "白底、透明底與雜物清除" },
          { icon: Sparkles, title: "門市與活動", text: "即時整理現場宣傳素材" },
          { icon: ShieldCheck, title: "專業服務", text: "物業、餐飲及日常交付" },
        ].map((item) => <div key={item.title} className="flex items-center gap-3 rounded-2xl border border-[#dfe7f1] bg-[#fbfdff] p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e7f0ff] text-[#1665d8]"><item.icon size={17} /></span><div><strong className="block text-sm text-[#1b3049]">{item.title}</strong><span className="mt-0.5 block text-xs text-[#68788d]">{item.text}</span></div></div>)}</div>
      </div>
    </section>

    <section id="workflow" className="border-y border-[#dfe7f1] bg-[#f4f7fb] py-9 sm:py-12">
      <div className="container">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><span className="text-[11px] font-bold tracking-[.15em] text-[#1665d8]">3 個步驟</span><h2 className="mt-1 text-2xl font-semibold tracking-[-.045em] text-[#10213b] sm:text-3xl">上載、處理、交付。</h2></div><Button onClick={onStartWork} variant="outline" className="h-9 rounded-xl border-[#bfd3ee] bg-white text-xs font-bold text-[#1665d8] hover:bg-[#eaf2ff]">立即開始 <ArrowRight size={14} /></Button></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">{[
          { n: "01", icon: Upload, title: "加入相片", text: "手機或電腦最多 10 張" },
          { n: "02", icon: WandSparkles, title: "選擇處理", text: "去背或圈選清除內容" },
          { n: "03", icon: ArrowDownToLine, title: "下載交付", text: "下載或傳送 WhatsApp" },
        ].map((step) => <div key={step.n} className="flex items-center gap-3 rounded-2xl border border-[#dbe5ef] bg-white p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e7f0ff] text-[#1665d8]"><step.icon size={17} /></span><div className="min-w-0"><span className="text-[10px] font-bold text-[#8b9bb0]">{step.n}</span><strong className="block text-sm text-[#20334b]">{step.title}</strong><span className="block text-xs text-[#6c7b90]">{step.text}</span></div></div>)}</div>
      </div>
    </section>

    <section id="plans" className="bg-white py-9 sm:py-12">
      <div className="container">
        <div className="rounded-[22px] border border-[#cfe1f3] bg-[linear-gradient(135deg,#f5f9ff_0%,#fff_58%,#f4fcf8_100%)] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6"><div><span className="text-[11px] font-bold tracking-[.15em] text-[#1665d8]">方案與容量</span><h2 className="mt-1 text-2xl font-semibold tracking-[-.045em] text-[#10213b]">按需要選擇處理額度或加購容量。</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#627188]">免費 Starter、月費方案、一次性處理額度與相片儲存容量都集中在帳戶內管理。</p></div><Button onClick={onOpenPlans} className="mt-4 h-10 shrink-0 rounded-xl bg-[#1665d8] px-4 text-xs font-bold text-white hover:bg-[#0d56bd] sm:mt-0">查看方案 <ArrowRight size={15} /></Button></div>
        <details className="group mt-4 rounded-2xl border border-[#d8e4f0] bg-[#f8fbff]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#315375]"><span className="flex items-center gap-2"><FolderArchive size={16} />查看儲存容量方案</span><ChevronDown size={17} className="transition-transform group-open:rotate-180" /></summary><div className="border-t border-[#dfe8f1] px-3 pb-3 sm:px-5 sm:pb-5"><StorageCapacityPanel authenticated={authenticated} storage={storage} hasActiveAddOn={hasActiveStorageAddOn} checkoutPending={checkoutPending} pendingAddOn={pendingAddOn} billingEnabled={billingEnabled} onSelect={onSelectStorage} onManage={onManageStorage} /></div></details>
      </div>
    </section>
  </>;
}
