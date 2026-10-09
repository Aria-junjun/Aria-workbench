"use client";

import React, { useEffect, useState } from "react";
import { EvidenceReferencePicker } from "./evidence-reference-picker";
import type { EvidenceReferenceModule } from "@/features/workbench/evidence-references";
import { buildEvidenceSourceProjects, scopeEvidenceSourceProjects } from "@/features/workbench/evidence-sources";
import { confirmWorkbenchEvidenceField, excludeWorkbenchEvidenceField, saveEvidenceReferenceChanges } from "@/features/workbench/evidence-reference-store";
import { loadLocalWorkbenchData } from "@/features/workbench/local-store";
import { subscribeWorkbench } from "@/features/workbench/workbench-store";
import { getIndustryInsightDraftStatusDisplay, getIndustryInsightFieldDisplay, type IndustryInsightDraftField, type IndustryInsightDraftStatus } from "@/features/workbench/industry-insight-bridge";

const statusLabels = { original: "原始资料，待确认", "ai-draft": "AI 初稿", edited: "已编辑，需重新确认", confirmed: "已确认", inference: "推断，待确认", "to-verify": "待验证", excluded: "已排除" };

export function WorkbenchEvidencePanel({ targetModule, targetProjectId, aiDrafts, onAiDraftSave }: { targetModule: EvidenceReferenceModule; targetProjectId: string; aiDrafts?: IndustryInsightDraftField[]; onAiDraftSave?: (draft: IndustryInsightDraftField, status: IndustryInsightDraftStatus, editedValue?: string) => void }) {
  const [data, setData] = useState(loadLocalWorkbenchData);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);
  const [activeView, setActiveView] = useState<"pending" | "confirmed" | "referenceable" | "excluded">("pending");
  useEffect(() => {
    const refresh = () => setData(loadLocalWorkbenchData());
    const unsubscribe = subscribeWorkbench(refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { unsubscribe(); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  const sources = buildEvidenceSourceProjects(data);
  const ownProject = sources.find((project) => project.module === targetModule && project.projectId === targetProjectId);
  const pendingFields = ownProject?.fields.filter((field) => field.status !== "confirmed" && field.status !== "excluded" && !field.path.startsWith("evidenceReferences.")) ?? [];
  const excludedFields = ownProject?.fields.filter((field) => field.status === "excluded" && !field.path.startsWith("evidenceReferences.")).map((field) => ({ ...field, projectId: ownProject.projectId, projectTitle: ownProject.projectTitle })) ?? [];

  const sourceProjects = targetModule === "industry-insight"
    ? sources.filter((project) => project.module === targetModule && project.projectId === targetProjectId)
    : scopeEvidenceSourceProjects(sources, targetModule, targetProjectId);
  const confirmedFields = sourceProjects.flatMap((project) => project.fields.filter((field) => field.status === "confirmed" && !field.path.startsWith("evidenceReferences.")).map((field) => ({ ...field, projectId: project.projectId, projectTitle: project.projectTitle })));
  const referenceableFields = confirmedFields.filter((field) => canReference(field));
  const pendingDraftCount = aiDrafts?.filter((draft) => !["accepted", "edited", "rejected"].includes(draft.status)).length ?? 0;
  const pendingReviewCount = pendingFields.length + pendingDraftCount;
  const viewFields = activeView === "confirmed" ? confirmedFields : referenceableFields;
  const selectView = (view: "pending" | "confirmed" | "referenceable" | "excluded") => { setActiveView(view); setOpen(true); };
  return <section className="rounded-2xl border border-line bg-surface shadow-card">
    <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex items-center gap-2 text-left font-semibold text-ink"><span>证据审核与引用</span><span className="text-xs font-normal text-muted">{open ? "收起" : "展开"}</span></button>
      <div className="flex flex-wrap items-center gap-2 text-xs font-normal text-muted">
        <button type="button" aria-pressed={activeView === "pending"} onClick={() => selectView("pending")} className={`rounded-full px-2.5 py-1 ${activeView === "pending" ? "bg-action-soft font-semibold text-action" : "bg-paper-warm"}`}>待审核 {pendingReviewCount}</button>
        <button type="button" aria-pressed={activeView === "confirmed"} onClick={() => selectView("confirmed")} className={`rounded-full px-2.5 py-1 ${activeView === "confirmed" ? "bg-action-soft font-semibold text-action" : "bg-paper-warm"}`}>已确认 {confirmedFields.length}</button>
        <button type="button" aria-pressed={activeView === "referenceable"} onClick={() => selectView("referenceable")} className={`rounded-full px-2.5 py-1 ${activeView === "referenceable" ? "bg-action-soft font-semibold text-action" : "bg-paper-warm"}`}>可引用 {referenceableFields.length}</button>
        <button type="button" aria-pressed={activeView === "excluded"} onClick={() => selectView("excluded")} className={`rounded-full px-2.5 py-1 ${activeView === "excluded" ? "bg-action-soft font-semibold text-action" : "bg-paper-warm"}`}>已排除 {excludedFields.length}</button>
      </div>
    </div>
    {open && <div className="space-y-4 border-t border-line px-5 py-4">
      <p className="text-sm text-muted">“已确认”表示已审核使用范围，不表示事实已证实。AI采用后仍需审核是否允许引用；推断、待验证和样本限制必须保留在原文中。缺少真实证据时不能据此作确定判断。</p>
      {activeView === "pending" && pendingFields.length > 0 && <section>
        <h3 className="text-sm font-semibold text-ink">待审核资料</h3>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{pendingFields.map((field) => <article key={field.path} className="rounded-xl border border-line bg-paper p-3">
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start"><div><p className="font-semibold text-ink">{field.label}</p><p className="text-xs text-muted">{statusLabels[field.status]}</p></div><div className="flex flex-wrap gap-2">
            <button type="button" aria-label={`仅本项目使用：${field.label}`} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted" onClick={() => confirmField(field, false)}>仅本项目使用</button>
            <button type="button" aria-label={`确认并允许引用：${field.label}`} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white" onClick={() => confirmField(field, true)}>确认并允许引用</button>
            <button type="button" aria-label={`不采用并排除：${field.label}`} className="rounded-lg border border-danger/30 px-3 py-2 text-xs font-semibold text-danger" onClick={() => excludeField(field)}>不采用并排除</button>
          </div></div>
          <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap text-sm text-muted"><span className="font-semibold text-ink">快照：</span>{field.snapshot}</p>
        </article>)}</div>
      </section>}
      {activeView !== "pending" && <section>
        <h3 className="text-sm font-semibold text-ink">{activeView === "confirmed" ? "已确认资料" : activeView === "referenceable" ? "可引用资料" : "已排除资料"}</h3>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{(activeView === "excluded" ? excludedFields : viewFields).length === 0 ? <p className="rounded-lg border border-dashed border-line bg-paper p-3 text-sm text-muted">暂无对应资料。</p> : (activeView === "excluded" ? excludedFields : viewFields).map((field) => <article key={`${field.projectId}-${field.path}`} className="rounded-xl border border-line bg-paper p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-ink">{field.label}</p><span className="text-xs text-muted">{field.projectTitle}</span></div><p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap text-sm text-muted">{field.snapshot}</p></article>)}</div>
      </section>}
      {activeView === "pending" && aiDrafts && aiDrafts.length > 0 && onAiDraftSave && <InsightDraftReviewSection drafts={aiDrafts} onSave={onAiDraftSave} />}
      {error && <p role="alert" className="text-danger">{error}</p>}
      <details className="rounded-xl border border-line bg-paper" open={activeView === "referenceable"}>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink">可引用资料与本项目引用</summary>
        <div className="border-t border-line px-3 pb-3"><EvidenceReferencePicker targetModule={targetModule} targetProjectId={targetProjectId} targetFieldPath="evidenceReferences" targetFieldLabel="引用证据"
          sourceProjects={sourceProjects}
          currentReferences={data.evidenceReferences ?? []}
          onReferencesChange={(next) => { saveEvidenceReferenceChanges(data.evidenceReferences ?? [], next); setData(loadLocalWorkbenchData()); }}
          sourceOnly={targetModule === "industry-insight"} /></div>
      </details>
    </div>}
  </section>;

  function confirmField(field: (typeof pendingFields)[number], referenceable: boolean) {
    try { confirmWorkbenchEvidenceField(targetModule, targetProjectId, field.path, field.snapshot, referenceable); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    setData(loadLocalWorkbenchData());
  }

  function excludeField(field: (typeof pendingFields)[number]) {
    try { excludeWorkbenchEvidenceField(targetModule, targetProjectId, field.path, field.snapshot, "不属于本项目当前研究边界"); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    setData(loadLocalWorkbenchData());
  }
}

function InsightDraftReviewSection({ drafts, onSave }: { drafts: IndustryInsightDraftField[]; onSave: (draft: IndustryInsightDraftField, status: IndustryInsightDraftStatus, editedValue?: string) => void }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedValue, setEditedValue] = useState("");
  const pendingCount = drafts.filter((draft) => !["accepted", "edited", "rejected"].includes(draft.status)).length;
  const toggleExpanded = (draftId: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(draftId)) next.delete(draftId);
    else next.add(draftId);
    return next;
  });
  const review = (draft: IndustryInsightDraftField, status: IndustryInsightDraftStatus) => {
    onSave(draft, status, status === "edited" ? editedValue : undefined);
    if (["accepted", "edited", "rejected"].includes(status)) setExpandedIds((current) => { const next = new Set(current); next.delete(draft.id); return next; });
    setEditingId(null);
    setEditedValue("");
  };
  return <details className="rounded-xl border border-line bg-paper">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink"><span>AI 初稿审核</span><span className="text-xs font-normal text-muted">待审核 {pendingCount} · 共 {drafts.length} 条</span></summary>
    <div className="border-t border-line px-3 pb-3 pt-2"><div className="max-h-80 space-y-2 overflow-y-auto">{drafts.map((draft) => {
      const completed = draft.status === "accepted" || draft.status === "edited" || draft.status === "rejected";
      const collapsed = completed && !expandedIds.has(draft.id);
      return <article key={draft.id} className="rounded-xl border border-line bg-surface p-3"><button type="button" aria-expanded={!collapsed} onClick={() => toggleExpanded(draft.id)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left"><span className="text-xs font-semibold text-ink">{getIndustryInsightFieldDisplay(draft.fieldPath)}</span><span className="flex items-center gap-2"><span className="rounded-full bg-paper-warm px-2 py-1 text-[11px] font-semibold text-muted">{getIndustryInsightDraftStatusDisplay(draft.status)}</span><span className="text-xs text-muted">{collapsed ? "展开" : "收起"}</span></span></button>{!collapsed && <><div className="mt-2">{editingId === draft.id ? <textarea aria-label={`修改 AI 初稿：${getIndustryInsightFieldDisplay(draft.fieldPath)}`} value={editedValue} onChange={(event) => setEditedValue(event.target.value)} className="min-h-20 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" /> : <p className="whitespace-pre-wrap text-sm leading-6 text-muted"><span className="font-semibold text-ink">内容：</span>{draft.value}</p>}</div><div className="mt-3 flex flex-wrap gap-2 text-xs"><button type="button" onClick={() => review(draft, "accepted")} className="rounded-lg bg-action px-2.5 py-1.5 font-semibold text-white">采用</button><button type="button" onClick={() => editingId === draft.id ? review(draft, "edited") : (setEditingId(draft.id), setEditedValue(draft.value))} className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-action">修改后采用</button><button type="button" onClick={() => review(draft, "needs_verification")} className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-muted">待验证</button><button type="button" onClick={() => review(draft, "rejected")} className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-muted">暂不采用</button></div></>}</article>;
    })}</div></div>
  </details>;
}

function canReference(field: { status: string; referenceable?: boolean }) {
  return field.status === "confirmed" && field.referenceable !== false;
}
