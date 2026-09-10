import Link from "next/link";
import { AnalysisIntakeForm } from "@/components/workbench/competitor-analysis/analysis-intake-form";

export default function NewCompetitorAnalysisPage() {
  return <div className="mx-auto max-w-4xl space-y-6"><div><Link href="/competitor-analysis" className="text-sm text-muted hover:text-action">← 返回竞品分析</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-action">Competitor Analysis</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">新建竞品分析项目</h1><p className="mt-2 text-sm leading-6 text-muted">先明确这次分析要支持什么决策，再逐步拆解竞品和我们自己的产品状态。</p></div><AnalysisIntakeForm /></div>;
}
