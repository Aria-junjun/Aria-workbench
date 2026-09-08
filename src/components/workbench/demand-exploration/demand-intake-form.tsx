"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDemandExploration, saveDemandExploration } from "@/features/workbench/local-store";

export function DemandIntakeForm() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", productFamily: "", userType: "", scenario: "", problem: "", goal: "" });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const analysis = createDemandExploration(form);
    saveDemandExploration(analysis);
    router.push(`/demand-exploration/${analysis.id}/questions`);
  }
  return <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-card"><div className="grid gap-4 md:grid-cols-2">
    <label className="text-sm font-semibold text-ink">分析标题<input required value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="例如：哑光墙贴残胶问题" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" /></label>
    <label className="text-sm font-semibold text-ink">目标产品/产品族<input value={form.productFamily} onChange={(event) => update("productFamily", event.target.value)} placeholder="可选" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" /></label>
    <label className="text-sm font-semibold text-ink">用户是谁<input required value={form.userType} onChange={(event) => update("userType", event.target.value)} placeholder="例如：租房用户" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" /></label>
    <label className="text-sm font-semibold text-ink">使用场景<input required value={form.scenario} onChange={(event) => update("scenario", event.target.value)} placeholder="例如：临时布置墙面" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" /></label>
    <label className="text-sm font-semibold text-ink md:col-span-2">当前问题<textarea required value={form.problem} onChange={(event) => update("problem", event.target.value)} placeholder="先描述问题，不要直接写解决方案" className="mt-2 min-h-24 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" /></label>
    <label className="text-sm font-semibold text-ink md:col-span-2">要解决的目标<textarea required value={form.goal} onChange={(event) => update("goal", event.target.value)} placeholder="希望通过这次分析判断什么" className="mt-2 min-h-20 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" /></label>
  </div><div className="flex justify-end"><button type="submit" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow">保存并设计 KANO 问题</button></div></form>;
}
