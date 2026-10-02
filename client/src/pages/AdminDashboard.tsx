import { useEffect } from "react";
import { Activity, ArrowLeft, Check, Database, FlaskConical, Images, LayoutDashboard, Loader2, RotateCcw, ShieldCheck, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { getAccountSecurityActivityLabel, formatAccountSecurityActivityTime } from "@/lib/accountSecurity";
import { formatAccountLastSignedIn } from "@/lib/accountProfile";
import { getMobileAccountIdentity } from "@/lib/mobileAccountMenu";
import { trpc } from "@/lib/trpc";
import { formatStorageBytes } from "@shared/storagePlans";
import { ACCOUNT_PLANS, type AccountPlan } from "@shared/plans";
import { toast } from "sonner";

function StatCard({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return <section className="rounded-2xl border border-[#d5e4f2] bg-white p-4 shadow-[0_8px_20px_rgba(35,71,110,.06)]"><div className="flex items-start justify-between gap-3"><div><span className="text-[11px] font-bold tracking-[.1em] text-[#718197]">{label}</span><strong className="mt-2 block text-2xl tracking-[-.05em] text-[#10213b]">{value}</strong><span className="mt-1 block text-xs text-[#6b7b91]">{detail}</span></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f2ff] text-[#176bd2]"><Icon size={18} /></span></div></section>;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const overviewQuery = trpc.admin.overview.useQuery(undefined, { enabled: user?.role === "admin", retry: false, refetchOnWindowFocus: false });
  const selfTestPlanQuery = trpc.admin.selfTestPlan.useQuery(undefined, { enabled: user?.role === "admin", retry: false, refetchOnWindowFocus: false });
  const setSelfTestPlanMutation = trpc.admin.setSelfTestPlan.useMutation();

  useEffect(() => { document.title = "Iwantphoto｜管理員總覽"; return () => { document.title = "Iwantphoto｜AI 圖片工作台"; }; }, []);

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f5f8fc]"><Loader2 className="animate-spin text-[#176bd2]" /></div>;
  if (!user) return <div className="grid min-h-screen place-items-center bg-[#f5f8fc] p-5"><section className="w-full max-w-md rounded-3xl border border-[#d5e4f2] bg-white p-7 text-center shadow-[0_18px_45px_rgba(35,71,110,.12)]"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f2ff] text-[#176bd2]"><ShieldCheck size={23} /></span><h1 className="mt-4 text-xl font-bold text-[#10213b]">管理員總覽需要登入</h1><p className="mt-2 text-sm leading-6 text-[#64758c]">請先以具管理權限的真實帳戶登入。</p><Button onClick={startLogin} className="mt-5 h-10 rounded-xl bg-[#176bd2] text-xs font-bold">登入安全帳戶</Button></section></div>;
  if (user.role !== "admin") return <div className="grid min-h-screen place-items-center bg-[#f5f8fc] p-5"><section className="w-full max-w-md rounded-3xl border border-[#d5e4f2] bg-white p-7 text-center shadow-[0_18px_45px_rgba(35,71,110,.12)]"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fff3e6] text-[#ad641a]"><ShieldCheck size={23} /></span><h1 className="mt-4 text-xl font-bold text-[#10213b]">沒有管理員權限</h1><p className="mt-2 text-sm leading-6 text-[#64758c]">此頁只限已授權的 Iwantphoto 管理員使用。</p><Button variant="outline" onClick={() => setLocation("/")} className="mt-5 h-10 rounded-xl border-[#bad3f0] text-xs font-bold text-[#176bd2]"><ArrowLeft size={15} />返回工作台</Button></section></div>;

  const overview = overviewQuery.data;
  const planCounts = new Map((overview?.plans ?? []).map((item) => [item.plan, item.count]));
  const testPlanState = selfTestPlanQuery.data ?? {
    commercialPlan: user.plan,
    testPlan: user.adminTestPlan ?? null,
    effectivePlan: user.adminTestPlan ?? user.plan,
  };
  const setTestPlan = async (plan: AccountPlan | null) => {
    if (setSelfTestPlanMutation.isPending) return;
    try {
      await setSelfTestPlanMutation.mutateAsync({ plan });
      await Promise.all([
        utils.auth.me.invalidate(),
        utils.library.usage.invalidate(),
        utils.billing.status.invalidate(),
        utils.admin.selfTestPlan.invalidate(),
        utils.admin.overview.invalidate(),
      ]);
      toast.success(plan ? `已啟用 ${ACCOUNT_PLANS[plan].name} 本人測試方案` : "已回復商業訂閱方案", { description: "此操作不會建立 Stripe 訂閱、付款或收費。" });
    } catch {
      toast.error("未能更新本人測試方案", { description: "請稍後再試。" });
    }
  };
  return <div className="min-h-screen bg-[#f5f8fc] text-[#10213b]">
    <header className={`sticky z-20 border-b border-[#dce7f1] bg-white/95 backdrop-blur ${testPlanState.testPlan ? "top-12 sm:top-14" : "top-0"}`}><div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#176bd2] text-white"><LayoutDashboard size={18} /></span><div className="min-w-0"><strong className="block truncate text-sm">Iwantphoto 管理員總覽</strong><span className="block text-[10px] text-[#6d7e95]">用戶、用量及帳戶安全活動</span></div></div><Button variant="outline" onClick={() => setLocation("/")} className="h-9 rounded-xl border-[#bad3f0] bg-white px-3 text-xs font-bold text-[#176bd2]"><ArrowLeft size={14} />返回工作台</Button></div></header>
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><span className="text-[11px] font-bold tracking-[.14em] text-[#176bd2]">ADMIN WORKSPACE</span><h1 className="mt-1 text-2xl font-semibold tracking-[-.05em] sm:text-3xl">帳戶與用量總覽</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#64758c]">只顯示帳戶營運所需的彙總資料與最近安全事件；不會展示客戶相片內容。</p></div><span className="rounded-full bg-[#e6f8f0] px-3 py-1.5 text-xs font-bold text-[#167b60]">已驗證管理員</span></div>
      {overviewQuery.isLoading ? <div className="grid min-h-64 place-items-center rounded-3xl border border-[#d5e4f2] bg-white"><Loader2 className="animate-spin text-[#176bd2]" /></div> : overviewQuery.isError || !overview ? <div className="rounded-2xl border border-[#f0cdcd] bg-[#fff7f7] p-5 text-sm text-[#9a3d3d]">暫時未能載入管理總覽，請稍後重新整理。</div> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={Users} label="帳戶總數" value={overview.totals.users.toLocaleString()} detail={`30 日內活躍 ${overview.totals.activeUsers.toLocaleString()} 個`} /><StatCard icon={Images} label="已儲存相片" value={overview.totals.savedImages.toLocaleString()} detail={`本月完成 ${overview.totals.monthlyImages.toLocaleString()} 張`} /><StatCard icon={Database} label="帳戶相片儲存" value={formatStorageBytes(overview.totals.storedBytes)} detail="不包括個人頭像" /><StatCard icon={Activity} label="月費方案分布" value={`${planCounts.get("pro") ?? 0} Pro`} detail={`Starter ${planCounts.get("starter") ?? 0} · Business ${planCounts.get("business") ?? 0}`} /></div>
        <section className="mt-6 overflow-hidden rounded-3xl border border-[#bed9f7] bg-[linear-gradient(120deg,#f2f8ff,#fbfdff_56%,#effaf7)] shadow-[0_8px_20px_rgba(35,71,110,.06)]">
          <div className="flex flex-col gap-3 border-b border-[#dceaf8] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
            <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#176bd2] text-white"><FlaskConical size={17} /></span><div><h2 className="text-sm font-bold text-[#173a58]">本人方案測試</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#627892]">只會改變目前管理員帳戶的處理與儲存權益，方便測試 Starter、Pro 或 Business 的介面與限額。</p></div></div>
            <span className="w-fit rounded-full bg-[#fff3cf] px-2.5 py-1 text-[10px] font-bold text-[#8b6500]">不會建立 Stripe 訂閱或收費</span>
          </div>
          <div className="p-4 sm:p-5">
            <div className="mb-4 grid gap-2 sm:grid-cols-3"><div className="rounded-2xl border border-[#dbe7f3] bg-white/80 px-3 py-2.5"><span className="text-[10px] font-bold tracking-[.08em] text-[#718197]">商業訂閱</span><strong className="mt-1 block text-sm text-[#203954]">{ACCOUNT_PLANS[testPlanState.commercialPlan].name}</strong></div><div className="rounded-2xl border border-[#b9d9ff] bg-[#edf6ff] px-3 py-2.5"><span className="text-[10px] font-bold tracking-[.08em] text-[#3974bf]">目前生效方案</span><strong className="mt-1 block text-sm text-[#125db9]">{ACCOUNT_PLANS[testPlanState.effectivePlan].name}{testPlanState.testPlan ? "（測試）" : ""}</strong></div><div className="rounded-2xl border border-[#dbe7f3] bg-white/80 px-3 py-2.5"><span className="text-[10px] font-bold tracking-[.08em] text-[#718197]">影響範圍</span><strong className="mt-1 block text-sm text-[#203954]">額度、儲存與方案 UI</strong></div></div>
            <div className="grid gap-2 sm:grid-cols-3">{(Object.keys(ACCOUNT_PLANS) as AccountPlan[]).map((plan) => { const selected = testPlanState.testPlan === plan; const details = ACCOUNT_PLANS[plan]; return <Button key={plan} type="button" variant="outline" disabled={setSelfTestPlanMutation.isPending} onClick={() => { void setTestPlan(plan); }} className={`h-auto min-h-24 justify-start rounded-2xl border p-3 text-left transition ${selected ? "border-[#176bd2] bg-[#eaf4ff] text-[#125db9]" : "border-[#d3e1ee] bg-white text-[#294563] hover:border-[#95c0ee] hover:bg-[#f5faff]"}`}><span className="flex w-full items-start justify-between gap-2"><span><strong className="block text-sm">{details.name}</strong><span className="mt-1 block text-[11px] leading-4 opacity-80">{details.allowance} 張／月 · {details.includedStorageGb} GB</span></span>{selected && <Check size={16} className="mt-0.5 shrink-0" />}</span></Button>; })}</div>
            <div className="mt-3 flex flex-col gap-2 border-t border-[#dceaf8] pt-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-[#718197]">其他客戶帳戶、Stripe 方案、付款狀態及信用卡均不會被修改。關閉後立即按商業訂閱方案重新計算。</p><Button type="button" variant="outline" disabled={!testPlanState.testPlan || setSelfTestPlanMutation.isPending} onClick={() => { void setTestPlan(null); }} className="h-9 shrink-0 rounded-xl border-[#bad3f0] bg-white px-3 text-[11px] font-bold text-[#176bd2] hover:bg-[#edf5ff]">{setSelfTestPlanMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}回復商業方案</Button></div>
          </div>
        </section>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <section className="overflow-hidden rounded-3xl border border-[#d5e4f2] bg-white shadow-[0_8px_20px_rgba(35,71,110,.06)]"><div className="border-b border-[#e5edf5] px-4 py-4 sm:px-5"><h2 className="text-sm font-bold text-[#173a58]">最近帳戶與用量</h2><p className="mt-1 text-xs leading-5 text-[#718197]">最多顯示 50 個最近登入帳戶。</p></div><div className="overflow-x-auto"><table className="min-w-[720px] w-full text-left"><thead className="bg-[#f8fbff] text-[10px] font-bold tracking-[.08em] text-[#718197]"><tr><th className="px-4 py-3">帳戶</th><th className="px-3 py-3">方案</th><th className="px-3 py-3">相片</th><th className="px-3 py-3">儲存</th><th className="px-4 py-3 text-right">上次登入</th></tr></thead><tbody>{overview.accounts.map((account) => { const identity = getMobileAccountIdentity(account.displayName || account.name, account.email); return <tr key={account.id} className="border-t border-[#edf2f7] text-xs text-[#3a506c]"><td className="px-4 py-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-[#ddebff] text-[10px] font-extrabold text-[#125db9]">{account.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" /> : identity.initials}</span><span className="min-w-0"><strong className="block max-w-44 truncate text-[#203954]">{identity.displayName}</strong><span className="block max-w-44 truncate text-[10px] text-[#74849a]">{account.email || "未提供電郵"}</span></span></div></td><td className="px-3 py-3"><span className="rounded-full bg-[#edf5ff] px-2 py-1 text-[10px] font-bold text-[#176bd2]">{account.plan}</span>{account.adminTestPlan && <span className="mt-1 block text-[9px] font-bold text-[#a06a00]">測試：{account.adminTestPlan}</span>}</td><td className="px-3 py-3">{account.imageCount.toLocaleString()}</td><td className="px-3 py-3">{formatStorageBytes(account.storedBytes)}</td><td className="px-4 py-3 text-right text-[10px] text-[#718197]">{formatAccountLastSignedIn(account.lastSignedIn)}</td></tr>; })}</tbody></table></div></section>
          <section className="overflow-hidden rounded-3xl border border-[#d5e4f2] bg-white shadow-[0_8px_20px_rgba(35,71,110,.06)]"><div className="border-b border-[#e5edf5] px-4 py-4 sm:px-5"><h2 className="text-sm font-bold text-[#173a58]">最近安全活動</h2><p className="mt-1 text-xs leading-5 text-[#718197]">最多顯示 50 項登入及帳戶變更紀錄。</p></div><div>{overview.activities.length ? overview.activities.slice(0, 10).map((activity) => <div key={activity.id} className="border-b border-[#edf2f7] px-4 py-3 last:border-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block text-xs text-[#314963]">{getAccountSecurityActivityLabel(activity.event)}</strong><span className="mt-0.5 block truncate text-[10px] text-[#718197]">{activity.displayName || activity.name || activity.email || "帳戶"} · {activity.detail}</span></div><time className="shrink-0 text-right text-[10px] leading-4 text-[#718197]">{formatAccountSecurityActivityTime(activity.createdAt)}</time></div></div>) : <div className="px-4 py-8 text-center text-xs text-[#718197]">尚未有可顯示的活動。</div>}</div></section>
        </div>
      </>}
    </main>
  </div>;
}
