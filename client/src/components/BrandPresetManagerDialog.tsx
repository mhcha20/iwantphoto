import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Palette, Plus, Save, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getProjectOptionLabel } from "@/lib/photoProjects";
import { MARKETPLACE_FONT_STYLES, type MarketplaceBrandStyle } from "@shared/marketplaceSuites";

export type MarketplaceBrandPreset = MarketplaceBrandStyle & {
  id: number;
  name: string;
  logoUrl: string | null;
  logoMimeType: string | null;
  isDefault: number;
};

export type BrandProject = {
  id: number;
  name: string;
  clientName: string | null;
  brandPresetId: number | null;
};

export type BrandPresetPayload = MarketplaceBrandStyle & {
  name: string;
  logoData?: string;
  logoMimeType?: string;
  removeLogo?: boolean;
};

type BrandPresetManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: MarketplaceBrandPreset[];
  projects: BrandProject[];
  activePresetId: number | null;
  isSaving: boolean;
  isAssigningProject: boolean;
  onSelectPreset: (presetId: number) => void;
  onCreatePreset: (payload: BrandPresetPayload) => Promise<void>;
  onUpdatePreset: (presetId: number, payload: BrandPresetPayload) => Promise<void>;
  onSetDefault: (presetId: number) => Promise<void>;
  onRemovePreset: (presetId: number) => Promise<void>;
  onAssignProject: (projectId: number, presetId: number | null) => Promise<void>;
};

const emptyDraft: MarketplaceBrandStyle & { name: string } = {
  name: "SIM uncle",
  accentColor: "#176BD2",
  fontStyle: "clean",
};

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read logo"));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read logo"));
    reader.readAsDataURL(file);
  });
}

export function BrandPresetManagerDialog({ open, onOpenChange, presets, projects, activePresetId, isSaving, isAssigningProject, onSelectPreset, onCreatePreset, onUpdatePreset, onSetDefault, onRemovePreset, onAssignProject }: BrandPresetManagerDialogProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const editingPreset = useMemo(() => presets.find((preset) => preset.id === editingId), [editingId, presets]);

  const beginNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);
  };

  const beginEdit = (preset: MarketplaceBrandPreset) => {
    setEditingId(preset.id);
    setDraft({ name: preset.name, accentColor: preset.accentColor, fontStyle: preset.fontStyle });
    setLogoFile(null);
    setLogoPreview(preset.logoUrl);
    setRemoveLogo(false);
    onSelectPreset(preset.id);
  };

  useEffect(() => {
    if (!open) return;
    const selected = presets.find((preset) => preset.id === activePresetId) ?? presets.find((preset) => preset.isDefault === 1) ?? presets[0];
    if (selected && (editingId === null || !presets.some((preset) => preset.id === editingId))) beginEdit(selected);
    if (!selected && !editingId) beginNew();
  // Sync when the dialog opens or the account's stored presets change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presets, activePresetId]);

  const chooseLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const save = async () => {
    const name = draft.name.trim().replace(/\s+/g, " ");
    if (!name || isSaving) return;
    const payload: BrandPresetPayload = { ...draft, name, removeLogo };
    if (logoFile) {
      payload.logoData = await toDataUrl(logoFile);
      payload.logoMimeType = logoFile.type;
    }
    if (editingId) await onUpdatePreset(editingId, payload);
    else await onCreatePreset(payload);
  };

  const displayLogo = removeLogo ? null : logoPreview;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92svh] max-w-[calc(100%-1rem)] overflow-y-auto border-[#bcd2ec] bg-[#f8fbff] p-4 sm:max-w-5xl sm:p-6">
      <DialogHeader className="pr-8 text-left">
        <DialogTitle className="flex items-center gap-2 text-[#10213b]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e7f0ff] text-[#1665d8]"><Palette size={17} /></span>品牌預設</DialogTitle>
        <DialogDescription className="leading-5 text-[#627188]">管理多個品牌的色彩、文字風格與 Logo，並可將其中一組指定為帳戶或專案預設。Logo 只會供輔助圖使用；主圖和 Google Merchant Center 圖片不會套入 Logo。</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-2xl border border-[#d4e2f0] bg-white p-3">
          <div className="flex items-center justify-between gap-2"><strong className="text-sm text-[#29425f]">我的品牌</strong><Button type="button" size="sm" onClick={beginNew} className="h-8 rounded-lg bg-[#176bd2] px-2 text-xs font-bold text-white hover:bg-[#1059b8]"><Plus size={13} />新增</Button></div>
          <div className="mt-3 space-y-2">{presets.length === 0 ? <p className="rounded-xl border border-dashed border-[#c8d9ea] bg-[#f6faff] p-3 text-xs leading-5 text-[#718197]">尚未建立品牌預設。可先新增「SIM uncle」或你的客戶品牌。</p> : presets.map((preset) => <button type="button" key={preset.id} onClick={() => beginEdit(preset)} className={`w-full rounded-xl border p-3 text-left transition ${editingId === preset.id ? "border-[#4b8be0] bg-[#ebf4ff]" : "border-[#dce6ef] bg-white hover:border-[#a8c8ec]"}`}><span className="flex items-center gap-2"><span className="h-5 w-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: preset.accentColor }} /><strong className="min-w-0 flex-1 truncate text-xs text-[#29425f]">{preset.name}</strong>{preset.isDefault === 1 && <Star size={13} className="fill-[#c88718] text-[#c88718]" />}</span><span className="mt-1 block text-[10px] text-[#708198]">{MARKETPLACE_FONT_STYLES[preset.fontStyle]}{preset.logoUrl ? " · 已上載 Logo" : ""}</span></button>)}</div>
          <div className="mt-4 rounded-xl border border-[#d9e7f5] bg-[#f5faff] p-3"><strong className="text-[11px] text-[#3567a6]">專案指定品牌</strong><p className="mt-1 text-[10px] leading-4 text-[#6d7f94]">選擇後，該專案的商品套組會優先帶入指定品牌。</p><div className="mt-2 space-y-2">{projects.length === 0 ? <span className="block text-[10px] text-[#8492a4]">先在「我的相片」建立專案。</span> : projects.map((project) => <label key={project.id} className="flex items-center gap-2 rounded-lg border border-[#d9e5f0] bg-white px-2 py-1.5 text-[11px] text-[#526880]"><span className="min-w-0 flex-1 truncate font-semibold">{getProjectOptionLabel(project)}</span><select aria-label={`${getProjectOptionLabel(project)} 的品牌預設`} value={project.brandPresetId ? String(project.brandPresetId) : ""} onChange={(event) => void onAssignProject(project.id, event.target.value ? Number(event.target.value) : null)} disabled={isAssigningProject} className="max-w-32 bg-transparent text-[10px] font-bold outline-none"><option value="">帳戶預設</option>{presets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}</select></label>)}</div></div>
        </section>

        <section className="rounded-2xl border border-[#d4e2f0] bg-[#f4f8fd] p-4">
          <div className="flex items-start justify-between gap-3"><div><span className="text-[11px] font-bold tracking-[0.1em] text-[#3974bf]">{editingPreset ? "編輯品牌" : "新增品牌"}</span><h3 className="mt-1 text-base font-bold text-[#203852]">{editingPreset ? editingPreset.name : "建立品牌預設"}</h3></div>{editingPreset?.isDefault === 1 && <span className="rounded-full bg-[#fff2cf] px-2 py-1 text-[10px] font-bold text-[#966116]">帳戶預設</span>}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="text-[10px] font-bold text-[#526b87]">品牌名稱</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={60} placeholder="例如：SIM uncle" className="mt-1.5 h-10 w-full rounded-xl border border-[#d3e0ee] bg-white px-3 text-xs font-semibold text-[#314963] outline-none focus:border-[#6ba1e2] focus:ring-2 focus:ring-[#e4f0ff]" /></label><label className="block"><span className="text-[10px] font-bold text-[#526b87]">品牌重點色</span><span className="mt-1.5 flex items-center gap-2"><input aria-label="品牌重點色" type="color" value={draft.accentColor} onChange={(event) => setDraft({ ...draft, accentColor: event.target.value.toUpperCase() })} className="h-10 w-11 cursor-pointer rounded-lg border border-[#cdddec] bg-white p-1" /><strong className="text-xs text-[#48617e]">{draft.accentColor}</strong></span></label><label className="block"><span className="text-[10px] font-bold text-[#526b87]">文字風格</span><select aria-label="品牌文字風格" value={draft.fontStyle} onChange={(event) => setDraft({ ...draft, fontStyle: event.target.value as MarketplaceBrandStyle["fontStyle"] })} className="mt-1.5 h-10 w-full rounded-xl border border-[#d3e0ee] bg-white px-3 text-xs font-semibold text-[#48617e] outline-none focus:border-[#6ba1e2]">{Object.entries(MARKETPLACE_FONT_STYLES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
          <div className="mt-4 rounded-xl border border-[#d8e5f1] bg-white p-3"><div className="flex items-center justify-between gap-3"><div><strong className="text-xs text-[#36516e]">Logo 預覽（輔助圖專用）</strong><p className="mt-1 text-[10px] leading-4 text-[#73849a]">PNG、JPG 或 WEBP，小於 2 MB。Logo 只會作為輔助圖參考，不會加入主圖；Google Merchant Center 圖片亦不顯示 Logo。</p></div>{displayLogo && <img src={displayLogo} alt="品牌 Logo 預覽" className="h-12 w-20 rounded-lg border border-[#d7e4ef] bg-[linear-gradient(45deg,#eef3f8_25%,transparent_25%),linear-gradient(-45deg,#eef3f8_25%,transparent_25%)] bg-[size:12px_12px] object-contain" />}</div><input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void chooseLogo(event)} /><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} className="h-8 rounded-lg border-[#b8d0ec] bg-white px-2.5 text-[11px] font-bold text-[#176bd2] hover:bg-[#edf5ff]"><Upload size={13} />{displayLogo ? "更換 Logo" : "上載 Logo"}</Button>{displayLogo && <Button type="button" variant="ghost" onClick={() => { setRemoveLogo(true); setLogoFile(null); }} className="h-8 rounded-lg px-2.5 text-[11px] font-bold text-[#aa523c] hover:bg-[#fff5f1]"><Trash2 size={13} />移除 Logo</Button>}</div></div>
          <div className="mt-4 rounded-xl border border-[#cedff2] bg-white p-3"><span className="text-[10px] font-bold tracking-[0.1em] text-[#3974bf]">輔助圖風格預覽</span><div className="mt-2 flex items-center gap-3 rounded-lg border border-[#dae6f0] bg-[#fbfdff] p-3"><span className="grid h-10 w-10 place-items-center rounded-lg text-white" style={{ backgroundColor: draft.accentColor }}><ImagePlus size={18} /></span><div className="min-w-0"><strong className="block truncate text-xs text-[#29425f]">{draft.name.trim() || "你的品牌"}</strong><span className="block text-[10px] text-[#708198]">{MARKETPLACE_FONT_STYLES[draft.fontStyle]} · 賣點／情境圖可使用</span></div>{displayLogo && <img src={displayLogo} alt="Logo 小預覽" className="ml-auto h-8 max-w-16 object-contain" />}</div><p className="mt-2 text-[10px] leading-4 text-[#73849a]">此為風格方向預覽，AI 成品仍會保留實物資訊並接受最終 SKU 與平台規則核對。</p></div>
          <div className="mt-4 flex flex-wrap justify-between gap-2"><div>{editingPreset && <Button type="button" variant="ghost" onClick={() => void onRemovePreset(editingPreset.id)} disabled={isSaving} className="h-9 rounded-lg px-2 text-xs font-bold text-[#aa523c] hover:bg-[#fff5f1]"><Trash2 size={14} />刪除品牌</Button>}</div><div className="flex gap-2">{editingPreset && editingPreset.isDefault !== 1 && <Button type="button" variant="outline" onClick={() => void onSetDefault(editingPreset.id)} disabled={isSaving} className="h-9 rounded-lg border-[#e7c675] bg-white px-3 text-xs font-bold text-[#98661a] hover:bg-[#fff9e9]"><Star size={14} />設為帳戶預設</Button>}<Button type="button" onClick={() => void save()} disabled={!draft.name.trim() || isSaving} className="h-9 rounded-lg bg-[#176bd2] px-3 text-xs font-bold text-white hover:bg-[#1059b8]">{isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}{editingPreset ? "儲存變更" : "建立品牌"}</Button></div></div>
        </section>
      </div>
    </DialogContent>
  </Dialog>;
}
