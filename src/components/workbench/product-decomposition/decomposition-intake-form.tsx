"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProductDecompositionProject } from "@/features/workbench/product-decomposition";
import { saveProductDecompositionProject } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";

export function DecompositionIntakeForm() {
  const router = useRouter();
  const data = useWorkbenchData();
  const [form, setForm] = useState({ title: "", linkedProductId: "", targetUsers: "", scenario: "", centralQuestion: "", decisionGoal: "" });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const project = createProductDecompositionProject({ ...form, linkedProductId: form.linkedProductId || undefined });
    saveProductDecompositionProject(project);
    router.push(`/product-decomposition/${project.id}`);
  };
  return <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-card"><div className="rounded-xl border border-action/20 bg-action-soft/30 p-4 text-sm leading-6 text-muted"><p className="font-semibold text-ink">先把拆解对象和中心问题说清楚</p><p className="mt-1">灰色文字是填写提示，不会自动写入；白板贴只作为案例，不限制你分析其他产品。</p></div><div className="grid gap-4 md:grid-cols-2"><Field label="拆解项目名称" value={form.title} placeholder="例如：可重复使用书写体验拆解" hint="给本次拆解取一个便于复盘的名称" onChange={(value) => update("title", value)} required /><label className="text-sm font-semibold text-ink">关联产品<select value={form.linkedProductId} onChange={(event) => update("linkedProductId", event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action"><option value="">不关联产品</option>{data.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><p className="mt-1 text-xs font-normal text-muted">可以先独立拆解，后续再关联产品。</p></label><Field label="目标用户" value={form.targetUsers} placeholder="例如：家庭办公、教师或培训使用者" hint="先写最主要的使用人群" onChange={(value) => update("targetUsers", value)} /><Field label="使用场景" value={form.scenario} placeholder="例如：会议结束后擦除内容，下一次继续使用" hint="描述产品实际被使用的情境" onChange={(value) => update("scenario", value)} /><Field label="中心问题" value={form.centralQuestion} placeholder="例如：怎样降低擦除残留对下一次书写的影响？" hint="本次拆解最终要解决的一个核心问题" onChange={(value) => update("centralQuestion", value)} required multiline wide /><Field label="希望做出的决策" value={form.decisionGoal} placeholder="例如：判断优先改善哪项产品能力" hint="完成拆解后，希望据此做什么决定" onChange={(value) => update("decisionGoal", value)} multiline wide /></div><div className="flex justify-end"><button type="submit" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow">创建产品拆解</button></div></form>;
}

function Field({ label, value, placeholder, hint, onChange, required = false, multiline = false, wide = false }: { label: string; value: string; placeholder: string; hint: string; onChange: (value: string) => void; required?: boolean; multiline?: boolean; wide?: boolean }) {
  return <label className={`text-sm font-semibold text-ink ${wide ? "md:col-span-2" : ""}`}>{label}{multiline ? <textarea required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 min-h-24 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none placeholder:text-muted-light focus:border-action" /> : <input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none placeholder:text-muted-light focus:border-action" />}<p className="mt-1 text-xs font-normal text-muted">{hint}</p></label>;
}
