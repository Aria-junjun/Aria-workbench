import Link from "next/link";
import { KanoMatrix } from "@/components/workbench/demand-exploration/kano-matrix";

export default async function KanoMatrixPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <div className="space-y-6"><div><Link href={`/demand-exploration/${analysisId}/questions`} className="text-sm text-muted hover:text-action">← 返回问题设计</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-action">Step 3 / 6</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">KANO 对照表</h1><p className="mt-2 text-sm leading-6 text-muted">先通过矩阵理解回答组合如何映射属性，再进入多人回答统计。</p></div><section className="rounded-2xl border border-line bg-surface p-6 shadow-card"><KanoMatrix /></section><div className="flex justify-end"><Link href={`/demand-exploration/${analysisId}/responses`} className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white">进入多人统计</Link></div></div>;
}
