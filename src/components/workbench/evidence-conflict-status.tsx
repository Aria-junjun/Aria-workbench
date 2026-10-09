"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  findEvidenceConflicts,
  markEvidenceConflictToVerify,
  type EvidenceConflict,
} from "@/features/workbench/evidence-conflicts";
import type { EvidenceReference, EvidenceReferenceModule } from "@/features/workbench/evidence-references";
import { saveEvidenceReferenceChanges } from "@/features/workbench/evidence-reference-store";
import { loadLocalWorkbenchData } from "@/features/workbench/local-store";
import { subscribeWorkbench } from "@/features/workbench/workbench-store";

const moduleLabels: Record<EvidenceReferenceModule, string> = {
  "industry-insight": "行业洞察",
  "demand-exploration": "需求探索",
  "competitor-analysis": "竞品分析",
  "product-decomposition": "产品拆解",
};

const statusLabels = {
  original: "原始资料",
  "ai-draft": "AI 初稿",
  edited: "已编辑",
  confirmed: "已确认",
  inference: "推断",
  "to-verify": "待验证",
  excluded: "已排除",
};

export function EvidenceConflictStatus({
  references,
  informationGaps = [],
  onReferencesChange,
}: {
  references: EvidenceReference[];
  informationGaps?: string[];
  onReferencesChange?: (references: EvidenceReference[]) => void;
}) {
  const conflicts = useMemo(() => findEvidenceConflicts(references), [references]);
  const markToVerify = (conflict: EvidenceConflict) => onReferencesChange?.(markEvidenceConflictToVerify(references, conflict));

  return <section aria-label="证据状态与冲突" className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-action">Evidence Status</p><h2 className="mt-1 font-display text-lg font-bold text-ink">证据状态与冲突</h2></div>
    <div className="grid gap-2 text-xs leading-5 text-muted md:grid-cols-3">
      <p>事实：记录材料直接支持的内容</p><p>推断：基于证据的解释，不等同事实</p><p>待验证：存在分歧或证据不足，不能作为定论</p>
    </div>
    {informationGaps.filter(Boolean).map((gap) => <p key={gap} className="rounded-lg border border-dashed border-line bg-paper px-3 py-2 text-xs text-muted">信息缺口：{gap}</p>)}
    <div className="space-y-2"><h3 className="text-sm font-semibold text-ink">来源板块</h3>{references.length === 0 ? <p className="text-sm text-muted">尚未关联来源；当前内容不能自动视为事实。</p> : references.map((reference) => <article key={reference.id} className="rounded-xl border border-line bg-paper p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-action">{moduleLabels[reference.sourceModule]} / {reference.sourceProjectTitle} / {reference.sourceFieldLabel}</p><span className="shrink-0 rounded-full bg-action-soft px-2 py-1 text-[11px] font-semibold text-action">{statusLabels[reference.status]}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{reference.snapshot}</p></article>)}</div>
    {conflicts.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold text-ink">待核对的证据冲突</h3>{conflicts.map((conflict) => <article key={`${conflict.fieldPath}:${conflict.reason}`} className="rounded-xl border border-warning/30 bg-warning/5 p-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><p className="font-semibold text-ink">{conflict.fieldLabel}</p><p className="mt-1 text-xs text-muted">{conflict.reason === "fact-mismatch" ? "事实表述不一致" : conflict.reason === "judgment-mismatch" ? "判断不一致" : "内容快照不一致"}；系统不会自动选择任一来源。</p></div>{onReferencesChange && <button type="button" aria-label={`将${conflict.fieldLabel}的冲突转为待验证`} onClick={() => markToVerify(conflict)} className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-action hover:bg-action-soft">转为待验证</button>}</div><div className="mt-3 grid gap-3 md:grid-cols-2">{conflict.references.map((reference) => <div key={reference.id} className="rounded-lg border border-line bg-surface p-3"><p className="text-xs font-semibold text-action">{moduleLabels[reference.sourceModule]} / {reference.sourceProjectTitle}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{reference.snapshot}</p></div>)}</div></article>)}</div>}
  </section>;
}

export function ProjectEvidenceConflictStatus({ targetModule, targetProjectId, informationGaps = [] }: { targetModule: EvidenceReferenceModule; targetProjectId: string; informationGaps?: string[] }) {
  const [references, setReferences] = useState<EvidenceReference[]>([]);
  useEffect(() => {
    const refresh = () => setReferences((loadLocalWorkbenchData().evidenceReferences ?? []).filter((reference) => reference.targetModule === targetModule && reference.targetProjectId === targetProjectId));
    refresh();
    const unsubscribe = subscribeWorkbench(refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { unsubscribe(); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, [targetModule, targetProjectId]);

  const updateReferences = (next: EvidenceReference[]) => {
    const data = loadLocalWorkbenchData();
    const previous = data.evidenceReferences ?? [];
    saveEvidenceReferenceChanges(previous, previous.map((reference) => next.find((item) => item.id === reference.id) ?? reference));
    setReferences(next);
  };

  return <EvidenceConflictStatus references={references} informationGaps={informationGaps} onReferencesChange={updateReferences} />;
}
