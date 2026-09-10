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

const titles: Record<AnalysisStepKey, string> = { goal: "分析目标", competitors: "竞品确认", layers: "五层拆解", stages: "阶段与版本", self_state: "我们的产品状态", strategy_report: "策略与报告" };
const descriptions: Record<AnalysisStepKey, string> = { goal: "先明确这次分析要支持什么决策。", competitors: "竞品不是越多越好，先说明为什么选择它。", layers: "从产品内核到页面表现逐层观察，不把界面当成全部。", stages: "把竞品放回发展阶段中理解，避免照搬最终形态。", self_state: "将竞品做法与我们的实际状态放在同一维度比较。", strategy_report: "把观察和差距转成有依据的产品取舍。" };

export function AnalysisWorkspace({ projectId }: { projectId: string }) {
  const initial = useMemo(() => loadCompetitorAnalysisProjects().find((project) => project.id === projectId), [projectId]);
  const [project, setProject] = useState(initial);
  const [activeStep, setActiveStep] = useState<AnalysisStepKey>("goal");
  if (!project) return <div className="rounded-2xl border border-danger/30 bg-surface p-6 text-sm text-danger">找不到这个竞品分析项目，请返回竞品分析首页。</div>;
  function persist(next: NonNullable<typeof project>) { setProject(next); saveCompetitorAnalysisProject(next); }
  const completed = project.competitors.length > 0 ? 1 : 0;
  const evidenceSummary = project.evidence.length > 0 ? `已记录 ${project.evidence.length} 条证据` : "尚未记录证据";
  const stepContent = activeStep === "competitors" ? <CompetitorStep project={project} onChange={persist} /> : activeStep === "layers" ? <FiveLayerStep project={project} onChange={persist} /> : activeStep === "stages" ? <StageStep project={project} onChange={persist} /> : activeStep === "self_state" ? <SelfStateStep project={project} onChange={persist} /> : activeStep === "strategy_report" ? <div className="space-y-6"><StrategyStep project={project} onChange={persist} /><ReportPreview project={project} /></div> : <div className="rounded-xl border border-dashed border-line bg-paper p-6 text-sm text-muted">本步骤基础信息已在创建项目时记录。后续可以在此处继续编辑分析目标。</div>;
  return <div className="space-y-6"><header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><Link href="/competitor-analysis" className="text-sm text-muted hover:text-action">← 返回竞品分析</Link><p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-action">Competitor Analysis</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">{project.title || "未命名分析项目"}</h1><p className="mt-2 text-sm text-muted">{project.productName || "未关联产品"} · {project.evidence.length} 条证据 · {completed} / 6 步已有内容</p></div><Link href="/competitor-analysis" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink">保存并退出</Link></header><div className="grid gap-5 lg:grid-cols-[230px_1fr]"><aside className="rounded-2xl border border-line bg-surface p-3 shadow-card"><p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">分析步骤</p><StepNavigation activeStep={activeStep} onChange={setActiveStep} /></aside><main className="space-y-5"><section className="rounded-2xl border border-line bg-surface p-6 shadow-card"><h2 className="font-display text-xl font-bold text-ink">{titles[activeStep]}</h2><p className="mt-2 text-sm leading-6 text-muted">{descriptions[activeStep]}</p><div className="mt-6">{stepContent}</div></section><div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">证据完整度：{evidenceSummary}</div>{activeStep !== "strategy_report" && <EvidencePanel project={project} onChange={persist} />}</main></div></div>;
}
