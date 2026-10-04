import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownUp, ArrowRight, CalendarDays, Check, Clock3, CreditCard, Download, FolderPlus, HardDriveDownload, Images, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { filterPhotoLibrary, getMonthlyImageUsage, getSavedImageStorageBytes, selectedPhotoLibraryRecords, selectedUnclassifiedPhotoLibraryRecords, sortPhotoLibraryRecords, type PhotoLibraryFilter, type PhotoLibrarySort } from "@/lib/photoLibrary";
import { filterPhotoLibraryByProject, getProjectLabel, getProjectOptionLabel, INBOX_PROJECT_VALUE, normalizeProjectCreateInput, type PhotoProject, type PhotoProjectCreateInput } from "@/lib/photoProjects";
import { getUsageAlert } from "@/lib/usageAlerts";
import { ACCOUNT_PLANS, type AccountPlan } from "@shared/plans";
import { formatStorageBytes } from "@shared/storagePlans";
import { ProjectStorageBreakdown } from "@/components/ProjectStorageBreakdown";
import type { ProjectStorageSummary } from "@/lib/projectStorage";
import { formatProcessingTimelineTime, getProcessingTimelineLabel, getProcessingTimelineUnitCopy, type ProcessingTimelineEvent } from "@/lib/processingTimeline";

export type SavedLibraryImage = {
  id: number;
  fileName: string;
  mimeType: string;
  originalUrl: string;
  processedUrl: string;
  originalBytes: number;
  processedBytes: number;
  mode: "background" | "cleanup" | "marketplace";
  backgroundStyle: "transparent" | "white";
  cleanupNote: string | null;
  projectId: number | null;
  createdAt: Date;
};

type PhotoLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string | null;
  records: SavedLibraryImage[];
  projects: PhotoProject[];
  isLoading: boolean;
  isError: boolean;
  plan: AccountPlan;
  used: number;
  allowance: number;
  creditBalance?: number;
  processingTimeline: ProcessingTimelineEvent[];
  processingTimelineLoading: boolean;
  processingTimelineError: boolean;
  storage: { usedBytes: number; allowanceBytes: number; includedGb: number; addOnGb: number; emailAlertsEnabled?: boolean; emailAlertsAvailable?: boolean };
  projectStorage: ProjectStorageSummary[];
  alertPreferencePending: boolean;
  storageMeteringPending: boolean;
  restoringId: number | null;
  assigningId: number | null;
  deletingId: number | null;
  batchDeletingUnclassified: boolean;
  creatingProject: boolean;
  onRestore: (record: SavedLibraryImage) => void;
  onDownload: (record: SavedLibraryImage) => Promise<void>;
  onCreateProject: (input: PhotoProjectCreateInput) => Promise<void>;
  onAssignProject: (imageId: number, projectId: number | null) => Promise<void>;
  onDelete: (record: SavedLibraryImage) => Promise<void>;
  onDeleteUnclassified: (imageIds: number[]) => Promise<number>;
  onStorageEmailAlertsChange: (enabled: boolean) => void;
  onRefreshStorageMetering: () => void;
  onOpenPlans: () => void;
  onStartWork: () => void;
};

export function PhotoLibraryDialog({ open, onOpenChange, userName, records, projects, isLoading, isError, plan, used, allowance, creditBalance = 0, processingTimeline, processingTimelineLoading, processingTimelineError, storage, projectStorage, alertPreferencePending, storageMeteringPending, restoringId, assigningId, deletingId, batchDeletingUnclassified, creatingProject, onRestore, onDownload, onCreateProject, onAssignProject, onDelete, onDeleteUnclassified, onStorageEmailAlertsChange, onRefreshStorageMetering, onOpenPlans, onStartWork }: PhotoLibraryDialogProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PhotoLibraryFilter>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sort, setSort] = useState<PhotoLibrarySort>("newest");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectClientName, setNewProjectClientName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const usage = getMonthlyImageUsage(used, allowance);
  const usageAlert = getUsageAlert(used, allowance, plan, creditBalance);
  const filteredRecords = useMemo(() => filterPhotoLibraryByProject(filterPhotoLibrary(records, search, filter), projectFilter), [records, search, filter, projectFilter]);
  const visibleRecords = useMemo(() => sortPhotoLibraryRecords(filteredRecords, sort), [filteredRecords, sort]);
  const selectedRecords = useMemo(() => selectedPhotoLibraryRecords(visibleRecords, selectedIds), [visibleRecords, selectedIds]);
  const selectedUnclassifiedRecords = useMemo(() => selectedUnclassifiedPhotoLibraryRecords(records, selectedIds), [records, selectedIds]);
  const selectedUnclassifiedBytes = selectedUnclassifiedRecords.reduce((total, record) => total + getSavedImageStorageBytes(record), 0);

  const toggleSelection = (id: number) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const downloadSelected = async () => {
    if (!selectedRecords.length || isBatchDownloading) return;
    setIsBatchDownloading(true);
    let completed = 0;
    try {
      for (const record of selectedRecords) {
        await onDownload(record);
        completed += 1;
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      toast.success(`已開始下載 ${completed} 張成品`, { description: "如瀏覽器詢問，請允許多個檔案下載。" });
    } catch {
      toast.error("部分成品未能下載", { description: `已啟動 ${completed} 張下載；請稍後重試未完成檔案。` });
    } finally { setIsBatchDownloading(false); }
  };

  const deleteSelectedUnclassified = async () => {
    if (!selectedUnclassifiedRecords.length || batchDeletingUnclassified) return;
    const confirmMessage = `移除 ${selectedUnclassifiedRecords.length} 張未分類已儲存相片？\n\n這會從你的相片庫移除記錄並釋放約 ${formatStorageBytes(selectedUnclassifiedBytes)} 帳戶儲存空間。此操作不能還原。`;
    if (!window.confirm(confirmMessage)) return;
    try {
      const removed = await onDeleteUnclassified(selectedUnclassifiedRecords.map((record) => record.id));
      setSelectedIds((current) => {
        const next = new Set(current);
        selectedUnclassifiedRecords.forEach((record) => next.delete(record.id));
        return next;
      });
      toast.success(`已移除 ${removed} 張未分類相片`, { description: `已釋放約 ${formatStorageBytes(selectedUnclassifiedBytes)} 的帳戶容量。` });
    } catch {
      toast.error("未能批量移除未分類相片", { description: "請稍後再試；未成功移除的相片會保留在相片庫。" });
    }
  };

  const createProject = async () => {
    const input = normalizeProjectCreateInput({ name: newProjectName, clientName: newProjectClientName, description: newProjectDescription });
    if (!input.name || creatingProject) return;
    await onCreateProject(input);
    setNewProjectName("");
    setNewProjectClientName("");
    setNewProjectDescription("");
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90svh] max-w-[calc(100%-1.5rem)] overflow-y-auto border-[#c9d7e8] bg-[#f8fbff] p-4 sm:max-w-4xl sm:p-6">
      <DialogHeader className="pr-9 text-left">
        <DialogTitle className="flex items-center gap-2 text-[#10213b]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e7f0ff] text-[#1665d8]"><Images size={17} /></span>我的相片</DialogTitle>
        <DialogDescription className="leading-5 text-[#627188]">{userName ? `${userName} 的已完成處理紀錄` : "已完成處理紀錄"}。用專案整理客戶交付、搜尋和篩選，再重新開啟、下載或批量下載成品。</DialogDescription>
      </DialogHeader>

      {isLoading ? <div className="grid min-h-52 place-items-center rounded-2xl border border-[#dbe5ef] bg-white text-sm font-semibold text-[#64758c]"><span className="flex items-center gap-2"><Loader2 className="animate-spin text-[#1665d8]" size={18} />正在載入相片…</span></div> : isError ? <div className="rounded-2xl border border-[#ecc9bb] bg-[#fff7f3] p-5 text-sm leading-6 text-[#914630]">暫時未能載入我的相片。請關閉視窗後再試。</div> : <div className="space-y-4">
        <div className="rounded-2xl border border-[#d7e6f5] bg-[#f3f8ff] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#1665d8] shadow-sm"><CreditCard size={17} /></span><div><strong className="block text-sm text-[#1e3654]">{ACCOUNT_PLANS[plan].name} · 本月額度</strong><span className="text-xs text-[#64758c]">已完成 {usage.used}/{usage.allowance} 張，尚餘 {usage.remaining} 張{creditBalance > 0 ? `；另有加購額度 ${creditBalance} 張` : ""}。</span></div></div>
            <Button onClick={onOpenPlans} variant="outline" className="h-8 rounded-lg border-[#bfd3ee] bg-white px-2.5 text-xs font-bold text-[#1665d8] hover:bg-[#eaf2ff]">查看方案</Button>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#1665d8] transition-[width] duration-300" style={{ width: `${usage.percentage}%` }} /></div>
          <p className="mt-2 text-[11px] leading-4 text-[#64758c]">移除已儲存相片只會釋放儲存空間，不會退回本月已使用的圖片處理額度。</p>
          {usageAlert.level !== "none" && <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${usageAlert.level === "limit" ? "border-[#ecc9bb] bg-[#fff7f3] text-[#914630]" : "border-[#f1d8a8] bg-[#fffaf0] text-[#8a5a14]"}`}><strong>{usageAlert.title}</strong><span className="ml-1">{usageAlert.description}</span></div>}
          <section className="mt-3 rounded-xl border border-[#d9e5f2] bg-white/80 p-3" aria-label="本月處理時間線">
            <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#eaf2ff] text-[#1665d8]"><Clock3 size={14} /></span><div><strong className="block text-xs text-[#38546f]">本月處理時間線</strong><span className="block text-[10px] text-[#74839a]">只記錄成功完成的處理；刪除相片不會移除這些額度紀錄。</span></div></div><span className="shrink-0 rounded-full bg-[#edf4ff] px-2 py-1 text-[10px] font-bold text-[#1665d8]">{usage.used} 張</span></div>
            {processingTimelineLoading ? <div className="mt-3 flex items-center gap-2 text-xs text-[#718096]"><Loader2 className="animate-spin text-[#1665d8]" size={14} />正在載入本月紀錄…</div> : processingTimelineError ? <p className="mt-3 text-xs leading-5 text-[#914630]">暫時未能載入處理時間線；你的本月額度仍會正常計算。</p> : processingTimeline.length === 0 ? <p className="mt-3 text-xs leading-5 text-[#718096]">本月尚未有成功完成的處理紀錄。</p> : <ol className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">{processingTimeline.slice(0, 30).map((event) => <li key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e2eaf3] bg-white px-2.5 py-2"><div className="min-w-0"><strong className="block truncate text-[11px] text-[#3c536e]">{getProcessingTimelineLabel(event.source)}</strong><time dateTime={new Date(event.createdAt).toISOString()} className="block text-[10px] text-[#7a8aa0]">{formatProcessingTimelineTime(event.createdAt)}</time></div><span className="shrink-0 rounded-full bg-[#edf4ff] px-2 py-1 text-[10px] font-bold text-[#1665d8]">{getProcessingTimelineUnitCopy(event.units)}</span></li>)}</ol>}
          </section>
          <div className="mt-3 rounded-xl border border-[#d9e5f2] bg-white/80 px-3 py-2 text-xs text-[#596b82]"><HardDriveDownload className="mr-1.5 inline text-[#1665d8]" size={14} /><strong className="text-[#38546f]">儲存空間：</strong>已用 {formatStorageBytes(storage.usedBytes)}／{formatStorageBytes(storage.allowanceBytes)}，方案包含 {storage.includedGb} GB{storage.addOnGb > 0 ? ` + 加購 ${storage.addOnGb} GB` : ""}。</div>
          <div className="mt-3"><ProjectStorageBreakdown records={projectStorage} accountUsedBytes={storage.usedBytes} emailAlertsEnabled={storage.emailAlertsEnabled ?? true} emailAlertsAvailable={storage.emailAlertsAvailable ?? false} alertPreferencePending={alertPreferencePending} onEmailAlertsChange={onStorageEmailAlertsChange} storageMeteringPending={storageMeteringPending} onRefreshStorageMetering={onRefreshStorageMetering} /></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#74839a]" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋檔名或清除內容" className="h-10 w-full rounded-xl border border-[#d1ddea] bg-white pl-9 pr-3 text-xs text-[#33445c] outline-none focus:border-[#76a6e9] focus:ring-2 focus:ring-[#dceaff]" /></label>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-[#d1ddea] bg-white px-3 text-xs font-bold text-[#53657b]"><CalendarDays size={15} /><select value={filter} onChange={(event) => setFilter(event.target.value as PhotoLibraryFilter)} className="bg-transparent outline-none"><option value="all">全部相片</option><option value="last-7-days">最近 7 日</option><option value="this-month">本月完成</option><option value="background">智能去背</option><option value="cleanup">清除修圖</option><option value="marketplace">商品套組</option></select></label>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-[#d1ddea] bg-white px-3 text-xs font-bold text-[#53657b]"><FolderPlus size={15} /><select aria-label="以專案篩選" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="max-w-28 bg-transparent outline-none"><option value="all">全部專案</option><option value={INBOX_PROJECT_VALUE}>未分類</option>{projects.map((project) => <option value={String(project.id)} key={project.id}>{getProjectOptionLabel(project)}</option>)}</select></label>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-[#d1ddea] bg-white px-3 text-xs font-bold text-[#53657b]"><ArrowDownUp size={15} /><select aria-label="相片排序" value={sort} onChange={(event) => setSort(event.target.value as PhotoLibrarySort)} className="bg-transparent outline-none"><option value="newest">最新優先</option><option value="largest">容量：大至小</option><option value="smallest">容量：小至大</option></select></label>
          </div>
          <div className="mt-3 rounded-xl border border-[#d9e5f2] bg-white/80 p-2"><div className="grid gap-2 sm:grid-cols-3"><label className="text-[10px] font-bold text-[#526b87]">新增專案<input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createProject(); }} placeholder="例如：9 月新品" maxLength={60} className="mt-1 h-8 w-full bg-transparent px-2 text-xs text-[#33445c] outline-none placeholder:text-[#9aa7b7]" /></label><label className="text-[10px] font-bold text-[#526b87]">客戶名稱（選填）<input value={newProjectClientName} onChange={(event) => setNewProjectClientName(event.target.value)} placeholder="例如：Juno Store" maxLength={60} className="mt-1 h-8 w-full bg-transparent px-2 text-xs text-[#33445c] outline-none placeholder:text-[#9aa7b7]" /></label><label className="text-[10px] font-bold text-[#526b87]">簡短說明（選填）<input value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} placeholder="例如：9 月新品上架素材" maxLength={160} className="mt-1 h-8 w-full bg-transparent px-2 text-xs text-[#33445c] outline-none placeholder:text-[#9aa7b7]" /></label></div><div className="mt-2 flex items-center justify-between gap-2"><p className="text-[10px] text-[#74839a]">只用於帳戶內整理，不會用於 AI 圖片或文案生成。</p><Button onClick={() => void createProject()} disabled={!normalizeProjectCreateInput({ name: newProjectName }).name || creatingProject} className="h-8 shrink-0 rounded-lg bg-[#1665d8] px-2.5 text-xs font-bold text-white hover:bg-[#0d56bd]">{creatingProject ? <Loader2 className="animate-spin" size={13} /> : <FolderPlus size={13} />}新增專案</Button></div></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-[#65758c]">顯示 {visibleRecords.length}/{records.length} 張 · {projects.length} 個專案</span><div className="flex gap-2"><Button onClick={() => setSelectedIds(new Set([...Array.from(selectedIds), ...visibleRecords.map((record) => record.id)]))} variant="ghost" className="h-8 rounded-lg px-2 text-xs font-bold text-[#1665d8] hover:bg-white">全選目前結果</Button>{selectedIds.size > 0 && <Button onClick={() => setSelectedIds(new Set())} variant="ghost" className="h-8 rounded-lg px-2 text-xs font-bold text-[#65758a] hover:bg-white">清除選取</Button>}</div></div>
        </div>

        {selectedRecords.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#bcd9cc] bg-[#f1fbf6] p-3"><span className="text-xs font-bold text-[#187253]">已選取 {selectedRecords.length} 張成品</span><Button onClick={() => void downloadSelected()} disabled={isBatchDownloading} className="h-9 rounded-xl bg-[#168464] px-3 text-xs font-bold text-white hover:bg-[#0d7052]">{isBatchDownloading ? <Loader2 className="animate-spin" size={14} /> : <HardDriveDownload size={14} />}{isBatchDownloading ? "正在準備下載…" : "批量下載成品"}</Button></div>}
        {selectedUnclassifiedRecords.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f0cfbf] bg-[#fff8f5] p-3"><div><strong className="block text-xs text-[#9b4832]">已選取 {selectedUnclassifiedRecords.length} 張未分類相片</strong><span className="mt-0.5 block text-[11px] text-[#9b6858]">可釋放約 {formatStorageBytes(selectedUnclassifiedBytes)}；只會移除未分類的已選取記錄。</span></div><Button onClick={() => void deleteSelectedUnclassified()} disabled={batchDeletingUnclassified} className="h-9 rounded-xl bg-[#b34b3d] px-3 text-xs font-bold text-white hover:bg-[#983b2f]">{batchDeletingUnclassified ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}批量移除未分類</Button></div>}

        {records.length === 0 ? <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-[#cbd9e9] bg-white p-6 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf2ff] text-[#1665d8]"><Images size={22} /></span><strong className="mt-4 text-sm text-[#263a54]">尚未有已儲存的相片</strong><p className="mt-1 max-w-xs text-xs leading-5 text-[#728198]">登入後完成處理的相片會自動出現在這裡。</p><Button onClick={onStartWork} className="mt-4 h-9 rounded-xl bg-[#1665d8] text-xs font-bold text-white hover:bg-[#0d56bd]">開始處理 <ArrowRight size={14} /></Button></div> : visibleRecords.length === 0 ? <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-[#cbd9e9] bg-white p-6 text-center"><Search size={22} className="text-[#7ea6dc]" /><strong className="mt-3 text-sm text-[#30445e]">找不到相片</strong><p className="mt-1 text-xs text-[#728198]">嘗試清除搜尋字詞或更改篩選條件。</p></div> : <div className="grid gap-3 sm:grid-cols-2">{visibleRecords.map((record) => {
          const selected = selectedIds.has(record.id);
          const storedBytes = getSavedImageStorageBytes(record);
          return <article key={record.id} className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition ${selected ? "border-[#168464] ring-2 ring-[#bdebd9]" : "border-[#dbe5ef]"}`}>
            <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(45deg,#eef3f8_25%,transparent_25%),linear-gradient(-45deg,#eef3f8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eef3f8_75%),linear-gradient(-45deg,transparent_75%,#eef3f8_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px]"><img src={record.processedUrl} alt={`${record.fileName} 已處理成品`} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" /><label className="absolute right-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/95 text-[#1665d8] shadow-sm"><input type="checkbox" checked={selected} onChange={() => toggleSelection(record.id)} className="h-4 w-4 accent-[#168464]" aria-label={`選取 ${record.fileName}`} /></label><span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold ${record.mode === "background" ? "bg-[#e7f0ff] text-[#1665d8]" : record.mode === "marketplace" ? "bg-[#e9f8ef] text-[#177252]" : "bg-[#fff1e9] text-[#a04c31]"}`}>{record.mode === "background" ? record.backgroundStyle === "transparent" ? "去背 · 透明" : "去背 · 白底" : record.mode === "marketplace" ? "商品套組" : "清除修圖"}</span></div>
            <div className="p-3.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-sm text-[#283b54]" title={record.fileName}>{record.fileName}</strong><span className="mt-1 block text-[10px] text-[#74839a]">{new Date(record.createdAt).toLocaleString("zh-HK", { dateStyle: "medium", timeStyle: "short" })}</span></div><Button onClick={() => onRestore(record)} disabled={restoringId !== null} className="h-8 shrink-0 rounded-lg bg-[#1665d8] px-2.5 text-[11px] font-bold text-white hover:bg-[#0d56bd]">{restoringId === record.id ? <Loader2 className="animate-spin" size={13} /> : <ArrowRight size={13} />}重新開啟</Button></div><div className="mt-3 grid grid-cols-[1fr_auto_auto] items-center gap-2"><label className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-[#d8e3ef] bg-[#fbfdff] px-2 text-[10px] font-semibold text-[#596b82]"><FolderPlus size={12} /><select value={record.projectId ? String(record.projectId) : INBOX_PROJECT_VALUE} onChange={(event) => void onAssignProject(record.id, event.target.value === INBOX_PROJECT_VALUE ? null : Number(event.target.value))} disabled={assigningId === record.id} className="min-w-0 flex-1 truncate bg-transparent outline-none"><option value={INBOX_PROJECT_VALUE}>未分類</option>{projects.map((project) => <option value={String(project.id)} key={project.id}>{getProjectOptionLabel(project)}</option>)}</select></label><Button onClick={() => void onDownload(record).then(() => toast.success("成品已開始下載。")).catch(() => toast.error("未能下載此成品，請稍後重試。"))} variant="ghost" className="h-8 rounded-lg px-2 text-[11px] font-bold text-[#168464] hover:bg-[#f3fbf7]"><Download size={13} />下載</Button><Button onClick={() => { if (window.confirm(`移除「${record.fileName}」的已儲存相片？此操作會釋出帳戶儲存空間。`)) void onDelete(record); }} disabled={deletingId !== null} variant="ghost" className="h-8 rounded-lg px-2 text-[11px] font-bold text-[#b34b3d] hover:bg-[#fff3f0]">{deletingId === record.id ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}移除</Button></div><p className="mt-2 text-[10px] text-[#718096]">專案：{getProjectLabel(record.projectId, projects)} · 佔用 {formatStorageBytes(storedBytes)}</p>{record.cleanupNote && <p className={`mt-1 line-clamp-1 rounded-lg px-2 py-1 text-[10px] ${record.mode === "marketplace" ? "bg-[#f1fbf6] text-[#347360]" : "bg-[#fff8f5] text-[#8b604f]"}`} title={record.cleanupNote}>{record.mode === "marketplace" ? "套組：" : "清除："}{record.cleanupNote}</p>}</div>
          </article>;
        })}</div>}
      </div>}
    </DialogContent>
  </Dialog>;
}
