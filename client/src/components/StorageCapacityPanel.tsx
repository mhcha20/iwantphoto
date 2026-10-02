import { Archive, ArrowRight, HardDrive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STORAGE_ADD_ONS, formatStorageBytes, type StorageAddOnKey } from "@shared/storagePlans";
import { getStorageUsagePercentage } from "@/lib/storageUsage";

export type StorageUsageSummary = {
  usedBytes: number;
  allowanceBytes: number;
  remainingBytes: number;
  includedGb: number;
  addOnGb: number;
  emailAlertsEnabled?: boolean;
  emailAlertsAvailable?: boolean;
};

type StorageCapacityPanelProps = {
  authenticated: boolean;
  storage: StorageUsageSummary;
  hasActiveAddOn: boolean;
  checkoutPending: boolean;
  pendingAddOn?: StorageAddOnKey;
  billingEnabled: boolean;
  onSelect: (addOn: StorageAddOnKey) => void;
  onManage: () => void;
};

export function StorageCapacityPanel({ authenticated, storage, hasActiveAddOn, checkoutPending, pendingAddOn, billingEnabled, onSelect, onManage }: StorageCapacityPanelProps) {
  const percentage = getStorageUsagePercentage(storage.usedBytes, storage.allowanceBytes);
  return <section className="mx-auto mt-4 max-w-5xl rounded-[20px] border border-[#d6e3ed] bg-[#f7fafc] p-4 shadow-[0_10px_26px_rgba(34,62,99,.05)] sm:p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><span className="text-[11px] font-bold tracking-[.15em] text-[#5d7191]">STORAGE CAPACITY</span><h3 className="mt-1 text-xl font-bold tracking-[-.04em] text-[#10213b]">按需要加購相片保留容量。</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-[#627188]">只計已儲存的原圖及成品；預覽和下載不佔額外容量。</p></div>
      {authenticated && <div className="min-w-[196px] rounded-xl border border-[#d5e1ec] bg-white p-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-bold text-[#38546f]"><HardDrive size={15} className="text-[#1665d8]" />已用 {formatStorageBytes(storage.usedBytes)}／{formatStorageBytes(storage.allowanceBytes)}</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7eef5]"><div className="h-full rounded-full bg-[#1665d8] transition-[width] duration-300" style={{ width: `${percentage}%` }} /></div><span className="mt-1.5 block text-[11px] text-[#718096]">包含 {storage.includedGb} GB{storage.addOnGb > 0 ? ` + 加購 ${storage.addOnGb} GB` : ""}</span></div>}
    </div>
    <div className="mt-4 grid gap-2 md:grid-cols-3">{Object.values(STORAGE_ADD_ONS).map((addOn) => {
      const selected = hasActiveAddOn && storage.addOnGb === addOn.capacityGb;
      const pending = checkoutPending && pendingAddOn === addOn.key;
      const disabled = checkoutPending || (authenticated && !billingEnabled);
      const action = hasActiveAddOn ? onManage : () => onSelect(addOn.key);
      return <article key={addOn.key} className={`flex flex-col rounded-xl border bg-white p-3.5 shadow-sm ${selected ? "border-[#1665d8] ring-2 ring-[#cae0fa]" : "border-[#d7e4ef]"}`}><div className="flex items-start justify-between gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e7f0ff] text-[#1665d8]"><Archive size={16} /></span>{selected && <span className="rounded-full bg-[#dff7ec] px-2 py-1 text-[10px] font-bold text-[#168464]">目前容量</span>}</div><h4 className="mt-3 text-base font-bold text-[#142a46]">{addOn.capacityGb === 1000 ? "1 TB" : `${addOn.capacityGb} GB`} Media Archive</h4><p className="mt-1 min-h-8 text-xs leading-4 text-[#68788d]">{addOn.tagline}</p><div className="mt-3 border-t border-[#edf1f6] pt-2.5"><strong className="text-lg text-[#1665d8]">HK$ {addOn.monthlyPrice}</strong><span className="ml-1.5 text-xs text-[#74839a]">／月</span></div><Button onClick={action} disabled={disabled} className={`mt-3 h-9 w-full rounded-lg text-xs font-bold ${selected ? "bg-[#10213b] text-white hover:bg-[#1b3459]" : "bg-[#1665d8] text-white hover:bg-[#0d56bd]"}`}>{pending ? <Loader2 className="animate-spin" size={14} /> : null}{hasActiveAddOn ? selected ? "管理儲存訂閱" : "先管理現有訂閱" : !authenticated ? "登入後選擇" : !billingEnabled ? "付款準備中" : "安全加購"}{!pending && !(authenticated && !billingEnabled) && <ArrowRight size={14} />}</Button></article>;
    })}</div>
    <p className="mt-3 text-center text-[11px] leading-5 text-[#708096]">容量方案按月續訂；變更容量請先管理現有訂閱。</p>
  </section>;
}
