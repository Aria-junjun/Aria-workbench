import Link from "next/link";
import { KanoQuadrant } from "@/components/workbench/demand-exploration/kano-quadrant";

export default async function KanoQuadrantPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <div className="space-y-6"><div><Link href={`/demand-exploration/${analysisId}/calculation`} className="text-sm text-muted hover:text-action">← 返回需求分析</Link><h1 className="mt-6 font-display text-3xl font-bold text-ink">需求优先级比较</h1><p className="mt-2 text-sm leading-6 text-muted">只有多个有效需求时才比较优先级；单个需求不会被强行放进四象限。</p></div><KanoQuadrant documentId={analysisId} /><Link href={`/demand-exploration/${analysisId}/result`} className="flex justify-end rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white">查看最终结果</Link></div>;
}
