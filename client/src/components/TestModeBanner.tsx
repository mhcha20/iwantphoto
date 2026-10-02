import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getTestModeBannerCopy } from "@/lib/testModeBanner";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function TestModeBanner() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const resetTestPlanMutation = trpc.admin.setSelfTestPlan.useMutation();
  const copy = getTestModeBannerCopy({
    role: user?.role,
    commercialPlan: user?.plan,
    testPlan: user?.adminTestPlan,
  });

  if (!copy.active) return null;

  const restoreCommercialPlan = async () => {
    if (resetTestPlanMutation.isPending) return;
    try {
      await resetTestPlanMutation.mutateAsync({ plan: null });
      await Promise.all([
        utils.auth.me.invalidate(),
        utils.library.usage.invalidate(),
        utils.billing.status.invalidate(),
        utils.admin.selfTestPlan.invalidate(),
        utils.admin.overview.invalidate(),
      ]);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("已回復真實方案", { description: "你的個人測試權益已關閉；Stripe、付款與商業訂閱一直沒有被更改。" });
    } catch {
      toast.error("未能回復真實方案", { description: "請稍後再試；在成功前，測試模式仍會保持清楚標示。" });
    }
  };

  return (
    <aside role="status" aria-live="polite" className="sticky top-0 z-50 h-12 border-b border-[#d79318] bg-[linear-gradient(90deg,#fff3bf,#ffe5a7_47%,#fff0c8)] text-[#704500] shadow-[0_3px_14px_rgba(147,94,0,.14)] sm:h-14">
      <div className="container flex h-full items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#8a5d00] text-white shadow-sm sm:h-8 sm:w-8" aria-hidden="true"><AlertTriangle size={15} /></span>
          <div className="min-w-0">
            <strong className="block truncate text-xs font-extrabold tracking-[.01em] sm:text-sm">{copy.title}</strong>
            <span className="hidden max-w-4xl truncate text-[11px] leading-4 text-[#765416] sm:block">{copy.description}</span>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => { void restoreCommercialPlan(); }} disabled={resetTestPlanMutation.isPending} aria-label={copy.ariaLabel} className="h-8 shrink-0 rounded-lg border-[#b27608] bg-white/90 px-2.5 text-[11px] font-extrabold text-[#785000] shadow-sm hover:bg-white sm:h-9 sm:px-3 sm:text-xs">
          {resetTestPlanMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          <span className="sm:hidden">回復</span><span className="hidden sm:inline">{copy.resetLabel}</span>
        </Button>
      </div>
    </aside>
  );
}
