"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadDemandConfirmationDocuments, saveDemandConfirmationDocument } from "@/features/workbench/local-store";

export function DocumentEditForm({ documentId }: { documentId: string }) {
  const router = useRouter();
  const document = useMemo(() => loadDemandConfirmationDocuments().find((item) => item.id === documentId), [documentId]);
  type EditForm = { title: string; productName: string; userType: string; scenario: string; problem: string; goal: string; source: string };
  const [form, setForm] = useState<EditForm>(() => document ? { title: document.title, productName: document.productName, userType: document.userType, scenario: document.scenario, problem: document.problem, goal: document.goal, source: document.source ?? "" } : { title: "", productName: "", userType: "", scenario: "", problem: "", goal: "", source: "" });
  if (!document) return <div className="rounded-2xl border border-danger/30 bg-surface p-6 text-sm text-danger">未找到需求确认文档。</div>;
  const currentDocument = document;
  const update = (key: keyof EditForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  function save(event: React.FormEvent) { event.preventDefault(); saveDemandConfirmationDocument({ ...currentDocument, ...form, updatedAt: new Date().toISOString() }); router.push(`/demand-exploration/${documentId}`); }
  return <form onSubmit={save} className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-card"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-action">编辑文档信息</p><h1 className="mt-2 font-display text-2xl font-bold text-ink">{currentDocument.title || "未命名需求确认文档"}</h1><p className="mt-2 text-sm text-muted">修改只更新文档信息，不会删除需求项、回答或历史计算结果。</p></div><div className="grid gap-4 md:grid-cols-2"><EditField label="文档名称" value={form.title} onChange={(value) => update("title", value)} /><EditField label="目标产品/产品族" value={form.productName} onChange={(value) => update("productName", value)} /><EditField label="目标用户" value={form.userType} onChange={(value) => update("userType", value)} /><EditField label="使用场景" value={form.scenario} onChange={(value) => update("scenario", value)} /><EditField label="当前问题" value={form.problem} onChange={(value) => update("problem", value)} multiline /><EditField label="研究目标" value={form.goal} onChange={(value) => update("goal", value)} multiline /><EditField label="需求来源" value={form.source} onChange={(value) => update("source", value)} wide /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => router.push(`/demand-exploration/${documentId}`)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink">取消</button><button type="submit" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white">保存修改</button></div></form>;
}

function EditField({ label, value, onChange, multiline = false, wide = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; wide?: boolean }) { return <label className={`text-sm font-semibold text-ink ${wide ? "md:col-span-2" : ""}`}>{label}{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" /> : <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-action" />}</label>; }
