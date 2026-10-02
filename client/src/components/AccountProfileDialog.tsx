import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Camera, Clock3, LayoutDashboard, Loader2, LogOut, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatAccountLastSignedIn, normaliseAccountDisplayName } from "@/lib/accountProfile";
import { formatAccountSecurityActivityTime, getAccountSecurityActivityLabel, type AccountSecurityActivity } from "@/lib/accountSecurity";
import { getMobileAccountIdentity } from "@/lib/mobileAccountMenu";

type AccountProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string | null | undefined;
  accountName: string | null | undefined;
  avatarUrl: string | null | undefined;
  email: string | null | undefined;
  lastSignedIn: Date | string | null | undefined;
  loginMethod: string | null | undefined;
  isSaving: boolean;
  isAvatarUploading: boolean;
  securityActivities: AccountSecurityActivity[];
  isSecurityLoading: boolean;
  isAdmin: boolean;
  onSave: (displayName: string) => Promise<boolean>;
  onAvatarUpload: (file: File) => Promise<boolean>;
  onSwitchAccount: () => void;
  onOpenAdmin: () => void;
};

function formatLoginMethod(loginMethod: string | null | undefined) {
  if (!loginMethod) return "安全帳戶登入";
  const labels: Record<string, string> = { google: "Google", apple: "Apple", microsoft: "Microsoft", github: "GitHub", email: "電郵", manus: "安全帳戶登入" };
  return labels[loginMethod.toLowerCase()] ?? "安全帳戶登入";
}

function AccountAvatar({ avatarUrl, initials, className = "h-11 w-11 rounded-2xl text-sm" }: { avatarUrl?: string | null; initials: string; className?: string }) {
  return avatarUrl
    ? <img src={avatarUrl} alt="帳戶頭像" className={`shrink-0 object-cover ${className}`} />
    : <span className={`grid shrink-0 place-items-center bg-[#ddebff] font-extrabold tracking-[-0.04em] text-[#125db9] ${className}`}>{initials}</span>;
}

export function AccountProfileDialog({
  open,
  onOpenChange,
  displayName,
  accountName,
  avatarUrl,
  email,
  lastSignedIn,
  loginMethod,
  isSaving,
  isAvatarUploading,
  securityActivities,
  isSecurityLoading,
  isAdmin,
  onSave,
  onAvatarUpload,
  onSwitchAccount,
  onOpenAdmin,
}: AccountProfileDialogProps) {
  const initialName = displayName?.trim() || accountName?.trim() || "";
  const [draftName, setDraftName] = useState(initialName);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const identity = getMobileAccountIdentity(displayName || accountName, email);
  const normalizedName = normaliseAccountDisplayName(draftName);
  const isChanged = normalizedName.length > 0 && normalizedName !== initialName;

  useEffect(() => { if (open) setDraftName(initialName); }, [initialName, open]);

  const save = async () => {
    if (!isChanged || isSaving) return;
    const saved = await onSave(normalizedName);
    if (saved) onOpenChange(false);
  };

  const uploadAvatar = async (file: File) => {
    if (isAvatarUploading) return;
    await onAvatarUpload(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-md overflow-y-auto border-[#cbdff4] bg-[#f8fbff] p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-[#dbe6f2] bg-white px-5 py-5 text-left">
          <div className="flex items-center gap-3">
            <AccountAvatar avatarUrl={avatarUrl} initials={identity.initials} />
            <div className="min-w-0"><DialogTitle className="truncate text-base font-bold text-[#10213b]">帳戶資料</DialogTitle><DialogDescription className="mt-1 text-xs leading-5 text-[#667c95]">管理工作台身分、帳戶安全及登入資料。</DialogDescription></div>
          </div>
        </DialogHeader>
        <div className="space-y-4 p-5">
          <section className="flex items-center justify-between gap-3 rounded-2xl border border-[#d6e5f4] bg-white p-3">
            <div className="flex min-w-0 items-center gap-3"><AccountAvatar avatarUrl={avatarUrl} initials={identity.initials} className="h-12 w-12 rounded-2xl text-sm" /><div className="min-w-0"><strong className="block truncate text-xs text-[#203954]">個人頭像</strong><span className="mt-1 block text-[11px] leading-4 text-[#718197]">PNG、JPG 或 WEBP，最多 2 MB。</span></div></div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void uploadAvatar(file); }} />
            <Button type="button" variant="outline" disabled={isAvatarUploading} onClick={() => fileInputRef.current?.click()} className="h-9 shrink-0 rounded-xl border-[#bad3f0] bg-white px-3 text-[11px] font-bold text-[#176bd2] hover:bg-[#edf5ff]">{isAvatarUploading ? <Loader2 className="animate-spin" size={14} /> : <Camera size={14} />}{isAvatarUploading ? "上載中" : "更換"}</Button>
          </section>

          <section className="rounded-2xl border border-[#d6e5f4] bg-white p-3">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-[#3974bf]"><UserRound size={14} />工作台顯示名稱</div>
            <Input value={draftName} maxLength={80} onChange={(event) => setDraftName(event.target.value)} placeholder="輸入顯示名稱" className="mt-2 h-10 rounded-xl border-[#cbddec] bg-[#fbfdff] text-sm text-[#314963] focus-visible:ring-[#9ec9ff]" />
            <p className="mt-2 text-[11px] leading-4 text-[#718197]">此名稱只在 Iwantphoto 工作台顯示，不會修改你的登入帳戶名稱。</p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#d6e5f4] bg-white">
            <div className="flex items-center gap-3 border-b border-[#e4edf6] px-3 py-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#edf5ff] text-[#176bd2]"><Mail size={15} /></span><div className="min-w-0"><span className="block text-[10px] font-bold tracking-[0.08em] text-[#718197]">登入電郵</span><span className="mt-0.5 block truncate text-xs font-semibold text-[#314963]">{email || "登入服務未提供電郵"}</span></div></div>
            <div className="flex items-center gap-3 border-b border-[#e4edf6] px-3 py-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#edf5ff] text-[#176bd2]"><Clock3 size={15} /></span><div className="min-w-0"><span className="block text-[10px] font-bold tracking-[0.08em] text-[#718197]">上次登入</span><span className="mt-0.5 block text-xs font-semibold text-[#314963]">{formatAccountLastSignedIn(lastSignedIn)}</span></div></div>
            <div className="flex items-center gap-3 px-3 py-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#edf5ff] text-[#176bd2]"><ShieldCheck size={15} /></span><div><span className="block text-[10px] font-bold tracking-[0.08em] text-[#718197]">登入方式</span><span className="mt-0.5 block text-xs font-semibold text-[#314963]">{formatLoginMethod(loginMethod)}</span></div></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#d6e5f4] bg-white" aria-labelledby="security-activity-heading">
            <div className="flex items-center justify-between border-b border-[#e4edf6] px-3 py-2.5"><div className="flex items-center gap-2"><ShieldCheck size={14} className="text-[#176bd2]" /><h3 id="security-activity-heading" className="text-xs font-bold text-[#203954]">帳戶安全活動</h3></div><span className="text-[10px] font-medium text-[#718197]">最近 20 項</span></div>
            {isSecurityLoading ? <div className="flex items-center gap-2 px-3 py-4 text-xs text-[#718197]"><Loader2 size={14} className="animate-spin" />正在載入紀錄</div> : securityActivities.length ? <div>{securityActivities.map((activity) => <div key={activity.id} className="flex items-start justify-between gap-3 border-b border-[#edf2f7] px-3 py-2.5 last:border-0"><div className="min-w-0"><strong className="block text-[11px] text-[#314963]">{getAccountSecurityActivityLabel(activity.event)}</strong><span className="mt-0.5 block truncate text-[10px] text-[#718197]">{activity.detail}</span></div><time className="shrink-0 text-right text-[10px] leading-4 text-[#718197]">{formatAccountSecurityActivityTime(activity.createdAt)}</time></div>)}</div> : <div className="px-3 py-4 text-xs text-[#718197]">尚未有可顯示的帳戶活動。</div>}
          </section>

          {isAdmin && <Button type="button" variant="outline" onClick={onOpenAdmin} className="h-10 w-full rounded-xl border-[#9cc2ef] bg-[#eef6ff] text-xs font-bold text-[#125db9] hover:bg-[#dfeeff]"><LayoutDashboard size={15} />開啟管理員總覽</Button>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onSwitchAccount} className="h-10 flex-1 rounded-xl border-[#bad3f0] bg-white text-xs font-bold text-[#176bd2] hover:bg-[#edf5ff]"><ArrowRightLeft size={15} />切換帳戶</Button>
            <Button type="button" disabled={!isChanged || isSaving} onClick={() => { void save(); }} className="h-10 flex-1 rounded-xl bg-[#1665d8] text-xs font-bold text-white hover:bg-[#0d56bd]">{isSaving ? <><Loader2 className="animate-spin" size={15} />儲存中</> : <><Save size={15} />儲存顯示名稱</>}</Button>
          </div>
          <Button type="button" variant="ghost" onClick={onSwitchAccount} className="h-8 w-full rounded-lg text-[11px] font-bold text-[#9b3d3d] hover:bg-[#fff2f2] hover:text-[#9b3d3d]"><LogOut size={13} />登出後以另一帳戶登入</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
