import { Bell, BellOff, FolderArchive, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProjectStoragePercentage, sortProjectStorageSummaries, type ProjectStorageSummary } from "@/lib/projectStorage";
import { formatStorageBytes } from "@shared/storagePlans";

type ProjectStorageBreakdownProps = {
  records: ProjectStorageSummary[];
  accountUsedBytes: number;
  emailAlertsEnabled: boolean;
  emailAlertsAvailable: boolean;
  alertPreferencePending: boolean;
  onEmailAlertsChange: (enabled: boolean) => void;
  storageMeteringPending: boolean;
  onRefreshStorageMetering: () => void;
};

export function ProjectStorageBreakdown({ records, accountUsedBytes, emailAlertsEnabled, emailAlertsAvailable, alertPreferencePending, onEmailAlertsChange, storageMeteringPending, onRefreshStorageMetering }: ProjectStorageBreakdownProps) {
  const sortedRecords = sortProjectStorageSummaries(records).filter((record) => record.usedBytes > 0 || record.imageCount > 0);

  return <section className="rounded-2xl border border-[#d7e6f5] bg-[#f7faff] p-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#1665d8] shadow-sm"><FolderArchive size={17} /></span><div><h3 className="text-sm font-bold text-[#193552]">專案儲存分佈</h3><p className="mt-1 text-xs leading-5 text-[#667991]">按原圖與已處理成品的實際檔案大小統計；「未分類」相片同樣計入帳戶總容量。</p></div></div>
      <div className="rounded-xl border border-[#d6e3f1] bg-white px-3 py-2 text-xs text-[#516780]"><strong className="text-[#193552]">帳戶已用</strong><span className="ml-1.5">{formatStorageBytes(accountUsedBytes)}</span></div>
    </div>

    <div className="mt-4 space-y-2.5">{sortedRecords.length ? sortedRecords.map((record) => {
      const share = getProjectStoragePercentage(record.usedBytes, accountUsedBytes);
      return <div key={record.projectId ?? "inbox"} className="rounded-xl border border-[#e0e9f2] bg-white px-3 py-2.5"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-xs text-[#314966]">{record.name}</strong><span className="text-[11px] text-[#75869a]">{record.imageCount} 張相片 · {formatStorageBytes(record.usedBytes)}</span></div><span className="shrink-0 text-[11px] font-bold text-[#1665d8]">{share.toFixed(share >= 10 ? 0 : 1)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7eef5]"><div className="h-full rounded-full bg-[#5e96e8] transition-[width] duration-300" style={{ width: `${share}%` }} /></div></div>;
    }) : <p className="rounded-xl border border-dashed border-[#cbd9e9] bg-white px-3 py-4 text-center text-xs text-[#728198]">完成並儲存相片後，這裡會顯示各專案的容量分佈。</p>}</div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d9e5f2] bg-white/75 p-2.5"><p className="text-[11px] leading-4 text-[#667991]">較早儲存的相片如顯示 0 MB，可重新核對其實際檔案大小。</p><Button onClick={onRefreshStorageMetering} disabled={storageMeteringPending} variant="outline" className="h-8 rounded-lg border-[#c7d9ee] bg-white px-2.5 text-[11px] font-bold text-[#1665d8] hover:bg-[#eaf2ff]">{storageMeteringPending ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />}重新核對容量</Button></div>

    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#d9e5f2] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2.5">{emailAlertsEnabled ? <Bell size={16} className="mt-0.5 shrink-0 text-[#1665d8]" /> : <BellOff size={16} className="mt-0.5 shrink-0 text-[#718096]" />}<p className="text-xs leading-5 text-[#60738b]"><strong className="block text-[#2e4764]">儲存容量電郵提醒</strong>{emailAlertsAvailable ? emailAlertsEnabled ? "首次達 80% 和 95% 時會寄到你的帳戶電郵；刪除相片降至 75% 以下後才會重新啟用下一輪提醒。" : "你已關閉容量電郵；仍可在網站內查看用量。" : "發信網域正在完成驗證；目前仍會在網站內顯示容量提示。"}</p></div><Button onClick={() => onEmailAlertsChange(!emailAlertsEnabled)} disabled={alertPreferencePending} variant="outline" className="h-8 shrink-0 rounded-lg border-[#c7d9ee] bg-[#fafdff] px-3 text-xs font-bold text-[#1665d8] hover:bg-[#eaf2ff]">{alertPreferencePending ? <Loader2 className="animate-spin" size={14} /> : emailAlertsEnabled ? <BellOff size={14} /> : <Bell size={14} />}{emailAlertsEnabled ? "關閉提醒" : "開啟提醒"}</Button></div>
  </section>;
}
