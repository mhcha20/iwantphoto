import { BadgeCheck, Boxes, CreditCard, HardDrive, Sparkles, UsersRound } from "lucide-react";
import { ACCOUNT_PLANS, type AccountPlan } from "@shared/plans";
import { getPlanComparisonValue, PLAN_COMPARISON_ROWS, type PlanComparisonRow } from "@/lib/planComparison";
import { isRecommendedMonthlyPlan } from "@/lib/planRecommendation";

const rowIcons = {
  credit: CreditCard,
  sparkles: Sparkles,
  storage: HardDrive,
  workflow: Boxes,
  audience: UsersRound,
} as const;

type PlanComparisonTableProps = {
  currentPlan: AccountPlan;
};

function ComparisonLabel({ row }: { row: PlanComparisonRow }) {
  const Icon = rowIcons[row.icon];
  return <span className="flex min-w-0 items-center gap-1.5 text-left text-xs font-bold text-[#315375]"><Icon size={14} className="shrink-0 text-[#1665d8]" />{row.label}</span>;
}

export function PlanComparisonTable({ currentPlan }: PlanComparisonTableProps) {
  const plans = Object.values(ACCOUNT_PLANS) as Array<(typeof ACCOUNT_PLANS)[AccountPlan]>;

  return <section className="mt-5 rounded-2xl border border-[#cbdff4] bg-[#f4f9ff] p-3 sm:p-4" aria-labelledby="plan-comparison-title">
    <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-1.5"><BadgeCheck size={16} className="text-[#1665d8]" /><h3 id="plan-comparison-title" className="text-sm font-bold text-[#173a58]">三個月費方案比較</h3></div><p className="mt-1 text-xs leading-5 text-[#657991]">手機可左右滑動比較欄位；選擇方案前先看清額度與儲存空間。</p></div><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#4776af] shadow-sm">左右滑動</span></div>
    <div className="-mx-3 mt-3 overflow-x-auto overscroll-x-contain px-3 pb-1 sm:mx-0 sm:px-0" aria-label="月費方案比較表">
      <table className="min-w-[600px] border-separate border-spacing-0 text-left">
	        <thead><tr><th scope="col" className="sticky left-0 z-20 min-w-[132px] border-b border-[#cbdff4] bg-[#f4f9ff] px-2 py-2 text-[10px] font-bold tracking-[.08em] text-[#71869f]">比較項目</th>{plans.map((plan) => <th scope="col" key={plan.key} className={`min-w-[150px] border-b border-[#cbdff4] px-2 py-2 align-top ${plan.key === currentPlan ? "bg-[#e8f2ff]" : "bg-[#f4f9ff]"}`}><div className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-[#173a58]">{plan.name}{isRecommendedMonthlyPlan(plan.key) && <span className="inline-flex items-center gap-0.5 rounded-full bg-[#fbbf24] px-1.5 py-0.5 text-[9px] font-bold text-[#583b00]"><Sparkles size={10} />推薦</span>}{plan.key === currentPlan && <span className="rounded-full bg-[#1665d8] px-1.5 py-0.5 text-[9px] text-white">目前</span>}</div><span className="mt-0.5 block text-[10px] text-[#69809a]">{plan.monthlyPrice === 0 ? "免費" : `HK$${plan.monthlyPrice.toLocaleString()}／月`}</span></th>)}</tr></thead>
        <tbody>{PLAN_COMPARISON_ROWS.map((row, rowIndex) => <tr key={row.key}><th scope="row" className={`sticky left-0 z-10 min-w-[132px] border-b border-[#d8e6f3] bg-[#f4f9ff] px-2 py-2.5 ${rowIndex === PLAN_COMPARISON_ROWS.length - 1 ? "border-b-0" : ""}`}><ComparisonLabel row={row} /></th>{plans.map((plan) => <td key={plan.key} className={`border-b border-[#d8e6f3] px-2 py-2.5 align-top text-xs leading-5 text-[#475f7b] ${plan.key === currentPlan ? "bg-[#f0f7ff]" : "bg-white/60"} ${rowIndex === PLAN_COMPARISON_ROWS.length - 1 ? "border-b-0" : ""}`}>{getPlanComparisonValue(row, plan.key)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </section>;
}
