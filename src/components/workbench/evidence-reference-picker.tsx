"use client";

import React from "react";
import {
  canReferenceEvidence,
  createEvidenceReference,
  isEvidenceReferenceDirectionAllowed,
  type EvidenceReference,
  type EvidenceReferenceModule,
  type EvidenceReferenceStatus,
} from "@/features/workbench/evidence-references";

export type EvidenceSourceField = {
  path: string;
  label: string;
  snapshot: string;
  status: EvidenceReferenceStatus;
};

export type EvidenceSourceProject = {
  module: EvidenceReferenceModule;
  projectId: string;
  projectTitle: string;
  fields: EvidenceSourceField[];
};

export function confirmedEvidenceReferenceSources(references: EvidenceReference[]): EvidenceSourceProject[] {
  const projects = new Map<string, EvidenceSourceProject>();
  for (const reference of references) {
    if (!canReferenceEvidence(reference.status)) continue;
    const key = `${reference.sourceModule}:${reference.sourceProjectId}`;
    const project = projects.get(key) ?? {
      module: reference.sourceModule,
      projectId: reference.sourceProjectId,
      projectTitle: reference.sourceProjectTitle,
      fields: [],
    };
    if (!project.fields.some((field) => field.path === reference.sourceFieldPath && field.snapshot === reference.snapshot)) {
      project.fields.push({ path: reference.sourceFieldPath, label: reference.sourceFieldLabel, snapshot: reference.snapshot, status: reference.status });
    }
    projects.set(key, project);
  }
  return [...projects.values()];
}

const moduleLabels: Record<EvidenceReferenceModule, string> = {
  "industry-insight": "行业洞察",
  "demand-exploration": "需求探索",
  "competitor-analysis": "竞品分析",
  "product-decomposition": "产品拆解",
};

type EvidenceReferencePickerProps = {
  targetModule: EvidenceReferenceModule;
  targetProjectId: string;
  currentReferences: EvidenceReference[];
  sourceProjects: EvidenceSourceProject[];
  onReferencesChange: (references: EvidenceReference[]) => void;
  sourceOnly?: boolean;
};

export function EvidenceReferencePicker({
  targetModule,
  targetProjectId,
  currentReferences,
  sourceProjects,
  onReferencesChange,
  sourceOnly = false,
}: EvidenceReferencePickerProps) {
  const selectableFields = sourceProjects.flatMap((project) => project.fields
    .filter((field) => canReferenceEvidence(field.status) && isEvidenceReferenceDirectionAllowed(project.module, targetModule))
    .map((field) => ({ project, field })));
  const targetReferences = currentReferences.filter((reference) => reference.targetModule === targetModule && reference.targetProjectId === targetProjectId);

  function addReference(project: EvidenceSourceProject, field: EvidenceSourceField) {
    onReferencesChange([...currentReferences, createEvidenceReference({
      targetModule,
      targetProjectId,
      sourceModule: project.module,
      sourceProjectId: project.projectId,
      sourceProjectTitle: project.projectTitle,
      sourceFieldPath: field.path,
      sourceFieldLabel: field.label,
      snapshot: field.snapshot,
      status: field.status,
    })]);
  }

  function updateSnapshot(referenceId: string, snapshot: string) {
    onReferencesChange(currentReferences.map((reference) => reference.id === referenceId ? { ...reference, snapshot } : reference));
  }

  if (sourceOnly) {
    const confirmedSources = sourceProjects.flatMap((project) => project.fields
      .filter((field) => canReferenceEvidence(field.status))
      .map((field) => ({ project, field })));
    return <section className="rounded-2xl border border-line bg-surface p-5 shadow-card"><h2 className="font-display text-lg font-bold text-ink">可供引用的已确认资料</h2><p className="mt-1 text-sm text-muted">行业洞察只作为来源，不接收其他工作区的回写。</p><EvidenceSourceList rows={confirmedSources} /></section>;
  }

  return <section className="rounded-2xl border border-line bg-surface p-5 shadow-card"><h2 className="font-display text-lg font-bold text-ink">引用已确认资料</h2><p className="mt-1 text-sm text-muted">只可引用已确认内容；引用会创建目标侧副本，不会覆盖当前字段，也不会自动回写来源。</p><EvidenceSourceList rows={selectableFields} onAdd={addReference} />{targetReferences.length > 0 ? <div className="mt-5 space-y-3"><h3 className="text-sm font-semibold text-ink">本项目引用</h3>{targetReferences.map((reference) => <article key={reference.id} className="rounded-xl border border-line bg-paper p-4"><p className="text-xs font-semibold text-action">引用自：{moduleLabels[reference.sourceModule]} / {reference.sourceProjectTitle} / {reference.sourceFieldLabel}</p><label className="mt-3 block text-sm font-semibold text-ink">引用副本：{reference.sourceFieldLabel}<textarea aria-label={`引用副本：${reference.sourceFieldLabel}`} value={reference.snapshot} onChange={(event) => updateSnapshot(reference.id, event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-normal" /></label></article>)}</div> : null}</section>;
}

function EvidenceSourceList({ rows, onAdd }: { rows: Array<{ project: EvidenceSourceProject; field: EvidenceSourceField }>; onAdd?: (project: EvidenceSourceProject, field: EvidenceSourceField) => void }) {
  if (rows.length === 0) return <p className="mt-4 rounded-xl border border-dashed border-line bg-paper p-4 text-sm text-muted">暂无符合方向且已确认的可引用资料。</p>;
  return <div className="mt-4 space-y-3">{rows.map(({ project, field }) => <article key={`${project.projectId}:${field.path}`} className="rounded-xl border border-line bg-paper p-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><p className="text-xs font-semibold text-action">{moduleLabels[project.module]}</p><p className="mt-1 text-sm font-semibold text-ink"><span>项目：</span><span>{project.projectTitle}</span></p><p className="mt-1 text-sm text-ink"><span>字段：</span><span>{field.label}</span></p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{field.snapshot}</p></div>{onAdd ? <button type="button" onClick={() => onAdd(project, field)} className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-action hover:bg-action-soft">引用</button> : null}</div></article>)}</div>;
}
