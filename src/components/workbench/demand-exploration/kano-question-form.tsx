"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadDemandExplorations, updateDemandExploration } from "@/features/workbench/local-store";
import { validateKanoQuestionDraft } from "@/features/workbench/demand-exploration";
import { LearningPanel } from "./learning-panel";

export function KanoQuestionForm({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const analysis = loadDemandExplorations().find((item) => item.id === analysisId);
  const [feature, setFeature] = useState(analysis?.feature ?? "");
  const [functionalQuestion, setFunctionalQuestion] = useState(analysis?.functionalQuestion ?? "");
  const [dysfunctionalQuestion, setDysfunctionalQuestion] = useState(analysis?.dysfunctionalQuestion ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!analysis) return <div className="rounded-2xl border border-danger/30 bg-surface p-6 text-sm text-danger">找不到这条分析记录，请返回需求探索首页。</div>;
  function save(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validateKanoQuestionDraft({ feature, functionalQuestion, dysfunctionalQuestion });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    updateDemandExploration(analysisId, { feature, functionalQuestion, dysfunctionalQuestion, status: "in_progress" });
    router.push(`/demand-exploration/${analysisId}/matrix`);
  }
  return <form onSubmit={save} className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-card"><LearningPanel /><div><label className="text-sm font-semibold text-ink">你要判断的产品特性<input value={feature} onChange={(event) => setFeature(event.target.value)} placeholder="例如：撕除后不残胶" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" /></label>{errors.feature ? <p className="mt-1 text-xs text-danger">{errors.feature}</p> : null}</div><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold text-ink">如果具备这个特性，用户会怎样？<textarea value={functionalQuestion} onChange={(event) => setFunctionalQuestion(event.target.value)} placeholder="请自己设计正向问题" className="mt-2 min-h-28 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" />{errors.functionalQuestion ? <p className="mt-1 text-xs text-danger">{errors.functionalQuestion}</p> : null}</label><label className="text-sm font-semibold text-ink">如果不具备这个特性，用户会怎样？<textarea value={dysfunctionalQuestion} onChange={(event) => setDysfunctionalQuestion(event.target.value)} placeholder="请自己设计反向问题" className="mt-2 min-h-28 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" />{errors.dysfunctionalQuestion ? <p className="mt-1 text-xs text-danger">{errors.dysfunctionalQuestion}</p> : null}</label></div>{errors.questionPair ? <p className="rounded-lg bg-danger/5 px-3 py-2 text-xs text-danger">{errors.questionPair}</p> : null}<div className="flex items-center justify-between border-t border-line pt-4"><button type="button" onClick={() => router.push("/demand-exploration")} className="text-sm text-muted hover:text-ink">跳过本步</button><button type="submit" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow">保存并查看对照表</button></div></form>;
}
