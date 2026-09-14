"use client";

import { useState } from "react";
import { type ProductDecompositionProject } from "@/features/workbench/product-decomposition";

export function PositioningStep({ project, onChange }: { project: ProductDecompositionProject; onChange: (patch: Partial<ProductDecompositionProject>) => void }) {
  const [form, setForm] = useState({ ...project.positioning });
  const save = (event: React.FormEvent) => { event.preventDefault(); onChange({ positioning: form, steps: { ...project.steps, positioning: "completed" } }); };
  return <form onSubmit={save} className="grid gap-4 md:grid-cols-2"><Field label="产品价值" value={form.productValue} placeholder="例如：提供可反复书写和擦除的平整书写面" hint="用一句话描述产品为用户提供的价值" onChange={(value) => setForm((current) => ({ ...current, productValue: value }))} /><Field label="用户需要" value={form.userNeed} placeholder="例如：会议结束后擦除内容，下一次继续使用" hint="描述用户在什么情况下需要它" onChange={(value) => setForm((current) => ({ ...current, userNeed: value }))} /><Field label="中心问题" value={project.centralQuestion} placeholder="例如：怎样降低擦除残留对下一次书写的影响？" hint="当前项目的中心问题来自新建项目时的填写" onChange={() => undefined} wide readOnly /><Field label="本次决策范围" value={form.decisionScope} placeholder="例如：判断优先验证擦除效果还是安装便利性" hint="明确这次拆解要支持的产品决策" onChange={(value) => setForm((current) => ({ ...current, decisionScope: value }))} wide /><div className="flex justify-end md:col-span-2"><button type="submit" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white">保存定位</button></div></form>;
}

function Field({ label, value, placeholder, hint, onChange, wide = false, readOnly = false }: { label: string; value: string; placeholder: string; hint: string; onChange: (value: string) => void; wide?: boolean; readOnly?: boolean }) { return <label className={`text-sm font-semibold text-ink ${wide ? "md:col-span-2" : ""}`}>{label}<textarea value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 min-h-24 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none placeholder:text-muted-light focus:border-action read-only:bg-paper-warm" /><p className="mt-1 text-xs font-normal text-muted">{hint}</p></label>; }
