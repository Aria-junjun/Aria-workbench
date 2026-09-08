import Link from "next/link";
import { AnalysisResult } from "@/components/workbench/demand-exploration/analysis-result";

export default async function DemandExplorationResultPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <div className="mx-auto max-w-4xl space-y-6"><div><Link href={`/demand-exploration/${analysisId}/quadrant`} className="text-sm text-muted hover:text-action">← 返回四象限</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-action">分析结果</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">需求判断结果</h1><p className="mt-2 text-sm leading-6 text-muted">结果保留模型判断、计算依据和可信度限制，方便复核和继续学习。</p></div><AnalysisResult analysisId={analysisId} /></div>;
}
