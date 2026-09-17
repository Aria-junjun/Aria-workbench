"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { loadCompetitorAnalysisProjects, saveCompetitorAnalysisProject } from "@/features/workbench/local-store";
import { CompetitorStep } from "./competitor-step";
import { EvidencePanel } from "./evidence-panel";
import { FiveLayerStep } from "./five-layer-step";
import { ReportPreview } from "./report-preview";
import { SelfStateStep } from "./self-state-step";
import { StageStep } from "./stage-step";
import { StepNavigation, type AnalysisStepKey } from "./step-navigation";
import { StrategyStep } from "./strategy-step";
import { emptyNeutralResearchSummary, emptyResearchInput } from "@/features/workbench/research-context";
import { ResearchInputFields } from "@/components/workbench/research-input-fields";
import { ExternalAiTaskPanel } from "@/components/workbench/external-ai-task-panel";
import { buildCompetitorAnalysisTaskPackage } from "@/features/workbench/research-ai-task-packages";
import type { AiTaskDraft } from "@/features/workbench/ai-task-protocol";
import { WorkbenchEvidencePanel } from "../workbench-evidence-panel";

const titles: Record<AnalysisStepKey, string> = { goal: "分析目标", competitors: "竞品确认", layers: "五层拆解", stages: "阶段与版本", self_state: "我们的产品状态", strategy_report: "策略与报告" };
const descriptions: Record<AnalysisStepKey, string> = { goal: "先明确白板贴这次要解决的用户问题和产品决策。", competitors: "围绕白板贴的 C 端使用场景，说明为什么选择这个竞品或替代方案。", layers: "从白板贴的产品内核到详情页表现逐层观察，不把页面好看当成全部。", stages: "把竞品放回面向消费者的发展阶段中理解，避免把成熟款直接照搬到白板贴。", self_state: "将竞品的书写、擦除、安装和重复使用体验与白板贴现状逐项比较。", strategy_report: "把销售、反馈和竞品观察转成白板贴的产品取舍。" };

export function AnalysisWorkspace({ projectId }: { projectId: string }) {
  const initial = useMemo(() => loadCompetitorAnalysisProjects().find((project) => project.id === projectId), [projectId]);
  const [project, setProject] = useState(initial);
  const [activeStep, setActiveStep] = useState<AnalysisStepKey>("goal");
  if (!project) return <div className="rounded-2xl border border-danger/30 bg-surface p-6 text-sm text-danger">找不到这个竞品分析项目，请返回竞品分析首页。</div>;
  function persist(next: NonNullable<typeof project>) { setProject(next); saveCompetitorAnalysisProject(next); }
  const completed = project.competitors.length > 0 ? 1 : 0;
  const evidenceSummary = project.evidence.length > 0 ? `已记录 ${project.evidence.length} 条证据` : "尚未记录证据";
  const stepContent = activeStep === "competitors" ? <CompetitorStep project={project} onChange={persist} /> : activeStep === "layers" ? <FiveLayerStep project={project} onChange={persist} /> : activeStep === "stages" ? <StageStep project={project} onChange={persist} /> : activeStep === "self_state" ? <SelfStateStep project={project} onChange={persist} /> : activeStep === "strategy_report" ? <div className="space-y-6"><StrategyStep project={project} onChange={persist} /><NeutralSummaryStep project={project} onChange={persist} /><ReportPreview project={project} /></div> : <div className="rounded-xl border border-dashed border-line bg-paper p-6 text-sm text-muted">本步骤基础信息已在创建项目时记录。后续可以在此处继续编辑分析目标。</div>;
  const task = buildCompetitorAnalysisTaskPackage({ projectId: project.id, title: project.title, productName: project.productName, targetUsers: project.targetUsers, analysisTheme: project.analysisTheme, decisionQuestion: project.decisionQuestion });
  const saveDraft = (draft: AiTaskDraft) => persist({ ...project, aiDrafts: [...(project.aiDrafts ?? []), draft] });
  return <div className="space-y-6"><header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><Link href="/competitor-analysis" className="text-sm text-muted hover:text-action">← 返回竞品分析</Link><p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-action">Competitor Analysis</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">{project.title || "未命名分析项目"}</h1><p className="mt-2 text-sm text-muted">{project.productName || "未关联产品"} · {project.evidence.length} 条证据 · {completed} / 6 步已有内容</p></div><Link href="/competitor-analysis" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink">保存并退出</Link></header><ResearchInputPanel project={project} onChange={persist} /><ExternalAiTaskPanel task={task} savedDrafts={project.aiDrafts} onSaveDraft={saveDraft} /><WorkbenchEvidencePanel targetModule="competitor-analysis" targetProjectId={project.id} /><div className="grid gap-5 lg:grid-cols-[230px_1fr]"><aside className="rounded-2xl border border-line bg-surface p-3 shadow-card"><p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">分析步骤</p><StepNavigation activeStep={activeStep} onChange={setActiveStep} /></aside><main className="space-y-5"><section className="rounded-2xl border border-line bg-surface p-6 shadow-card"><h2 className="font-display text-xl font-bold text-ink">{titles[activeStep]}</h2><p className="mt-2 text-sm leading-6 text-muted">{descriptions[activeStep]}</p><div className="mt-6">{stepContent}</div></section><div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">证据完整度：{evidenceSummary}</div>{activeStep !== "strategy_report" && <EvidencePanel project={project} onChange={persist} />}</main></div></div>;
}

function ResearchInputPanel({ project, onChange }: { project: NonNullable<ReturnType<typeof loadCompetitorAnalysisProjects>[number]>; onChange: (next: NonNullable<ReturnType<typeof loadCompetitorAnalysisProjects>[number]>) => void }) {
  const [input, setInput] = useState(project.researchInput ?? emptyResearchInput());
  return <section className="rounded-2xl border border-line bg-surface p-5 shadow-card"><ResearchInputFields value={input} onChange={setInput} /><div className="mt-4 flex justify-end"><button type="button" onClick={() => onChange({ ...project, researchInput: input })} className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white">保存研究前输入</button></div></section>;
}

function NeutralSummaryStep({ project, onChange }: { project: NonNullable<ReturnType<typeof loadCompetitorAnalysisProjects>[number]>; onChange: (next: typeof project) => void }) {
  const [summary, setSummary] = useState(project.neutralSummary ?? emptyNeutralResearchSummary());
  const field = (label: string, key: keyof typeof summary, placeholder: string, wide = false) => <label className={`text-sm font-semibold text-ink ${wide ? "md:col-span-2" : ""}`}>{label}<textarea value={summary[key]} onChange={(event) => setSummary((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} className="mt-2 min-h-20 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal placeholder:text-muted-light" /></label>;
  return <section className="rounded-xl border border-action/20 bg-action-soft/20 p-4"><h3 className="font-semibold text-ink">中立研究摘要</h3><p className="mt-1 text-xs leading-5 text-muted">只记录分析观察、信息缺口和来源板块，不替产品做进入、跟随或放弃决策。</p><div className="mt-4 grid gap-4 md:grid-cols-2">{field("摘要", "summary", "只总结当前资料显示了什么", true)}{field("关键观察", "keyObservations", "哪些现象在多个来源中重复出现", true)}{field("信息缺口", "informationGaps", "哪些内容还缺少可靠证据", true)}{field("来源板块", "sourceSection", "例如：行业洞察、竞品分析、需求探索", true)}</div><div className="mt-4 flex justify-end"><button type="button" onClick={() => onChange({ ...project, neutralSummary: summary })} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white">保存研究摘要</button></div></section>;
}
