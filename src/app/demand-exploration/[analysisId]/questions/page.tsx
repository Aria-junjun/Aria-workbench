import Link from "next/link";
import { KanoQuestionForm } from "@/components/workbench/demand-exploration/kano-question-form";

export default async function KanoQuestionsPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <div className="mx-auto max-w-4xl space-y-6"><div><Link href="/demand-exploration" className="text-sm text-muted hover:text-action">← 返回需求探索</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-action">Step 2 / 6</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">设计 KANO 问题</h1><p className="mt-2 text-sm leading-6 text-muted">系统不会替你生成问题。请围绕一个具体特性，自己设计正向和反向两个问题。</p></div><KanoQuestionForm analysisId={analysisId} /></div>;
}
