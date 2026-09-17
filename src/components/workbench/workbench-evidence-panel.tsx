"use client";

import React, { useEffect, useState } from "react";
import { EvidenceReferencePicker } from "./evidence-reference-picker";
import type { EvidenceReferenceModule } from "@/features/workbench/evidence-references";
import { buildEvidenceSourceProjects } from "@/features/workbench/evidence-sources";
import { confirmWorkbenchEvidenceField, saveEvidenceReferenceChanges } from "@/features/workbench/evidence-reference-store";
import { loadLocalWorkbenchData } from "@/features/workbench/local-store";
import { subscribeWorkbench } from "@/features/workbench/workbench-store";

const statusLabels = { original: "原始资料，待确认", "ai-draft": "AI 初稿", edited: "已编辑，需重新确认", confirmed: "已确认", inference: "推断，待确认", "to-verify": "待验证" };

export function WorkbenchEvidencePanel({ targetModule, targetProjectId }: { targetModule: EvidenceReferenceModule; targetProjectId: string }) {
  const [data, setData] = useState(loadLocalWorkbenchData);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => setData(loadLocalWorkbenchData());
    const unsubscribe = subscribeWorkbench(refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { unsubscribe(); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  const sources = buildEvidenceSourceProjects(data);
  const ownProject = sources.find((project) => project.module === targetModule && project.projectId === targetProjectId);
  const pendingFields = ownProject?.fields.filter((field) => field.status !== "confirmed" && !field.path.startsWith("evidenceReferences.")) ?? [];

  return <div className="space-y-4">
    {pendingFields.length > 0 && <details className="rounded-2xl border border-line bg-surface p-5" open>
      <summary className="font-semibold text-ink">确认本项目来源字段</summary>
      <p className="mt-2 text-sm text-muted">核对已保存的实际内容后逐项确认，才会向下游提供引用。内容变化后需要重新确认。</p>
      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">{pendingFields.map((field) => <article key={field.path} className="rounded-xl border border-line p-3">
        <p className="font-semibold">{field.label}</p><p className="text-xs text-muted">{statusLabels[field.status]}</p>
        <p className="my-2 whitespace-pre-wrap text-sm"><span>快照：</span><span>{field.snapshot}</span></p>
        <button type="button" aria-label={`确认来源：${field.label}`} className="rounded-lg border border-line px-3 py-2 text-sm text-action" onClick={() => {
          try { confirmWorkbenchEvidenceField(targetModule, targetProjectId, field.path, field.snapshot); setError(""); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
          setData(loadLocalWorkbenchData());
        }}>确认来源</button>
      </article>)}</div>
    </details>}
    {error && <p role="alert" className="text-danger">{error}</p>}
    <EvidenceReferencePicker targetModule={targetModule} targetProjectId={targetProjectId} targetFieldPath="evidenceReferences" targetFieldLabel="引用证据"
      sourceProjects={targetModule === "industry-insight" ? sources.filter((project) => project.module === targetModule && project.projectId === targetProjectId) : sources}
      currentReferences={data.evidenceReferences ?? []}
      onReferencesChange={(next) => { saveEvidenceReferenceChanges(data.evidenceReferences ?? [], next); setData(loadLocalWorkbenchData()); }}
      sourceOnly={targetModule === "industry-insight"} />
  </div>;
}
