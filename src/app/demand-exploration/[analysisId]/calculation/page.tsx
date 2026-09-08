import Link from "next/link";
import { CalculationBreakdown } from "@/components/workbench/demand-exploration/calculation-breakdown";

export default async function KanoCalculationPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <div className="mx-auto max-w-4xl space-y-6"><div><Link href={`/demand-exploration/${analysisId}/responses`} className="text-sm text-muted hover:text-action">← 返回回答统计</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-action">Step 5 / 6</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">BI / SI 计算</h1><p className="mt-2 text-sm leading-6 text-muted">公式、代入值和结果同时展示，确保结论可以复核。</p></div><CalculationBreakdown analysisId={analysisId} /><div className="flex justify-end"><Link href={`/demand-exploration/${analysisId}/quadrant`} className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white">进入需求四象限</Link></div></div>;
}
