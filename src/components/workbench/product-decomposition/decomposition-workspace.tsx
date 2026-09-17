"use client";

import Link from "next/link";
import { useState } from "react";
import { saveProductDecompositionProject } from "@/features/workbench/local-store";
import { PRODUCT_DECOMPOSITION_STEP_LABELS, updateProductDecompositionProject, type ProductDecompositionProject, type ProductDecompositionStepKey } from "@/features/workbench/product-decomposition";
import { StepNavigation } from "./step-navigation";
import { PositioningStep } from "./positioning-step";
import { ScopeStep } from "./scope-step";
import { CausesStep } from "./causes-step";
import { SolutionsStep } from "./solutions-step";
import { ActionsStep } from "./actions-step";
import { ExternalAiTaskPanel } from "../external-ai-task-panel";
import { buildProductDecompositionTaskPackage } from "@/features/workbench/research-ai-task-packages";
import type { AiTaskDraft } from "@/features/workbench/ai-task-protocol";
import { WorkbenchEvidencePanel } from "../workbench-evidence-panel";

export function DecompositionWorkspace({ project: initialProject }: { project: ProductDecompositionProject }) {
  const [project, setProject] = useState(initialProject);
  const [activeStep, setActiveStep] = useState<ProductDecompositionStepKey>(initialProject.currentStep);
  const persist = (patch: Partial<ProductDecompositionProject>) => {
    const next = updateProductDecompositionProject(project, patch);
    setProject(next);
    saveProductDecompositionProject(next);
  };
  const changeStep = (step: ProductDecompositionStepKey) => {
    setActiveStep(step);
    persist({ currentStep: step, status: project.status === "draft" ? "in_progress" : project.status, steps: { ...project.steps, [step]: project.steps[step] === "draft" ? "in_progress" : project.steps[step] } });
  };
  const content = activeStep === "positioning" ? <PositioningStep project={project} onChange={persist} /> : activeStep === "scope" ? <ScopeStep project={project} onChange={persist} /> : activeStep === "causes" ? <CausesStep project={project} onChange={persist} /> : activeStep === "solutions" ? <SolutionsStep project={project} onChange={persist} /> : <ActionsStep project={project} onChange={persist} />;
  const task = buildProductDecompositionTaskPackage({ projectId: project.id, title: project.title, targetUsers: project.targetUsers, scenario: project.scenario, centralQuestion: project.centralQuestion, decisionGoal: project.decisionGoal });
  const saveDraft = (draft: AiTaskDraft) => persist({ aiDrafts: [...(project.aiDrafts ?? []), draft] });
  return <div className="space-y-6"><header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><Link href="/product-decomposition" className="text-sm text-muted hover:text-action">← 返回产品拆解</Link><p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-action">Product Decomposition</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">{project.title || "未命名产品拆解"}</h1><p className="mt-2 text-sm text-muted">{project.linkedProductId || "未关联产品"} · {project.solutions.length} 个方案 · {project.actionItems.length} 个行动项</p></div><Link href={`/product-decomposition/${project.id}/report`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-action hover:text-action">查看拆解结果</Link></header><ExternalAiTaskPanel task={task} savedDrafts={project.aiDrafts} onSaveDraft={saveDraft} /><WorkbenchEvidencePanel targetModule="product-decomposition" targetProjectId={project.id} /><div className="grid gap-5 lg:grid-cols-[240px_1fr]"><aside className="rounded-2xl border border-line bg-surface p-3 shadow-card"><p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">拆解步骤</p><StepNavigation activeStep={activeStep} steps={project.steps} onChange={changeStep} /></aside><main className="space-y-5"><section className="rounded-2xl border border-line bg-surface p-6 shadow-card"><h2 className="font-display text-xl font-bold text-ink">{PRODUCT_DECOMPOSITION_STEP_LABELS[activeStep]}</h2><p className="mt-2 text-sm leading-6 text-muted">{stepDescription(activeStep)}</p><div className="mt-6">{content}</div></section><div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">当前保存：每一步都可以独立保存，填写内容不会自动替代你的判断。</div></main></div></div>;
}

function stepDescription(step: ProductDecompositionStepKey) {
  return { positioning: "先明确产品服务谁、解决什么问题，以及本次拆解要支持的决策。", scope: "把中心问题转成目标和能力方向，明确本次要分析什么、不分析什么。", causes: "用结构化鱼骨方法从中心问题向下追溯原因，事实、判断和证据分开填写。", solutions: "把原因转成可比较的产品方案，由执行人确认Kano分类并排序。", actions: "把优先方案转成下一步行动，不在本阶段展开项目排期。" }[step];
}
