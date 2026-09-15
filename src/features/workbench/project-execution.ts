import { randomId } from "@/lib/random-id";

export type ProjectExecutionStatus = "draft" | "in_progress" | "completed" | "archived";
export type ProjectExecutionStepKey = "definition" | "stakeholders" | "constraints" | "planning" | "risks";
export type ProjectExecutionStepStatus = "draft" | "in_progress" | "completed";
export type ProjectExecutionTaskStatus = "not_started" | "in_progress" | "completed" | "blocked";
export type ProjectExecutionRiskLevel = "low" | "medium" | "high";

export const PROJECT_EXECUTION_STEP_LABELS: Record<ProjectExecutionStepKey, string> = { definition: "项目定义", stakeholders: "项目相关方", constraints: "约束与范围", planning: "计划与里程碑", risks: "风险与复盘" };
export const PROJECT_EXECUTION_TASK_STATUS_LABELS: Record<ProjectExecutionTaskStatus, string> = { not_started: "未开始", in_progress: "进行中", completed: "已完成", blocked: "受阻" };
export const PROJECT_EXECUTION_RISK_LEVEL_LABELS: Record<ProjectExecutionRiskLevel, string> = { low: "低", medium: "中", high: "高" };

export type ProjectExecutionStakeholder = { id: string; name: string; role: string; responsibility: string; influence: ProjectExecutionRiskLevel; interest: ProjectExecutionRiskLevel; communication: string };
export type ProjectExecutionMilestone = { id: string; title: string; targetDate: string; deliverable: string; status: ProjectExecutionTaskStatus };
export type ProjectExecutionTask = { id: string; sourceActionId?: string; milestoneId?: string; title: string; description?: string; owner: string; startDate?: string; dueDate?: string; prerequisite?: string; deliverable: string; status: ProjectExecutionTaskStatus };
export type ProjectExecutionRisk = { id: string; title: string; probability: ProjectExecutionRiskLevel; impact: ProjectExecutionRiskLevel; mitigation: string; owner?: string; status: "open" | "monitoring" | "closed" };

export type ProjectExecutionProject = {
  id: string; title: string; linkedProductId?: string; sourceDecompositionProjectId?: string; background: string; objective: string; successCriteria: string; scope: string; outOfScope: string; status: ProjectExecutionStatus; currentStep: ProjectExecutionStepKey; steps: Record<ProjectExecutionStepKey, ProjectExecutionStepStatus>;
  stakeholders: ProjectExecutionStakeholder[]; qualityConstraint: string; timeConstraint: string; costConstraint: string; nonNegotiables: string; resourceLimits: string; milestones: ProjectExecutionMilestone[]; tasks: ProjectExecutionTask[]; risks: ProjectExecutionRisk[]; review: { planned: string; actual: string; learnings: string; nextAdjustment: string }; createdAt: string; updatedAt: string; archivedAt?: string;
};

const now = () => new Date().toISOString();
const touch = (project: ProjectExecutionProject, patch: Partial<ProjectExecutionProject>) => ({ ...project, ...patch, id: project.id, updatedAt: now() });

export function createProjectExecutionProject(input: { title: string; linkedProductId?: string; sourceDecompositionProjectId?: string; background?: string; objective: string; successCriteria?: string; scope?: string; outOfScope?: string }): ProjectExecutionProject {
  const timestamp = now();
  return { id: randomId(), title: input.title.trim(), linkedProductId: input.linkedProductId, sourceDecompositionProjectId: input.sourceDecompositionProjectId, background: input.background?.trim() ?? "", objective: input.objective.trim(), successCriteria: input.successCriteria?.trim() ?? "", scope: input.scope?.trim() ?? "", outOfScope: input.outOfScope?.trim() ?? "", status: "draft", currentStep: "definition", steps: { definition: "draft", stakeholders: "draft", constraints: "draft", planning: "draft", risks: "draft" }, stakeholders: [], qualityConstraint: "", timeConstraint: "", costConstraint: "", nonNegotiables: "", resourceLimits: "", milestones: [], tasks: [], risks: [], review: { planned: "", actual: "", learnings: "", nextAdjustment: "" }, createdAt: timestamp, updatedAt: timestamp };
}
export function updateProjectExecutionProject(project: ProjectExecutionProject, patch: Partial<ProjectExecutionProject>) { return touch(project, patch); }
export function addProjectExecutionStakeholder(project: ProjectExecutionProject, input: Omit<ProjectExecutionStakeholder, "id">) { return touch(project, { stakeholders: [...project.stakeholders, { ...input, id: randomId() }] }); }
export function addProjectExecutionMilestone(project: ProjectExecutionProject, input: Omit<ProjectExecutionMilestone, "id">) { return touch(project, { milestones: [...project.milestones, { ...input, id: randomId() }] }); }
export function addProjectExecutionTask(project: ProjectExecutionProject, input: Omit<ProjectExecutionTask, "id">) { return touch(project, { tasks: [...project.tasks, { ...input, id: randomId() }] }); }
export function addProjectExecutionRisk(project: ProjectExecutionProject, input: Omit<ProjectExecutionRisk, "id" | "status"> & Partial<Pick<ProjectExecutionRisk, "status">>) { return touch(project, { risks: [...project.risks, { ...input, id: randomId(), status: input.status ?? "open" }] }); }
export function getProjectExecutionCompleteness(project: ProjectExecutionProject) { const checks = [["项目目标", Boolean(project.objective)], ["成功标准", Boolean(project.successCriteria)], ["项目相关方", project.stakeholders.length > 0], ["约束", Boolean(project.qualityConstraint || project.timeConstraint || project.costConstraint)], ["任务计划", project.tasks.length > 0], ["风险记录", project.risks.length > 0]] as const; const missing = checks.filter(([, ok]) => !ok).map(([label]) => label); return { complete: missing.length === 0, missing, filled: checks.length - missing.length, total: checks.length }; }
export function buildProjectExecutionReport(project: ProjectExecutionProject) { return { title: project.title, sections: [{ key: "definition", title: "项目定义", content: `${project.objective}\n成功标准：${project.successCriteria || "尚未填写"}` }, { key: "stakeholders", title: "项目相关方", content: project.stakeholders.map((item) => `${item.name}｜${item.role}｜${item.responsibility}`).join("\n") || "尚未形成记录" }, { key: "constraints", title: "约束与范围", content: `质量：${project.qualityConstraint || "暂无"}\n时间：${project.timeConstraint || "暂无"}\n成本：${project.costConstraint || "暂无"}` }, { key: "planning", title: "计划与里程碑", content: project.tasks.map((task) => `${task.title}｜${PROJECT_EXECUTION_TASK_STATUS_LABELS[task.status]}｜${task.owner || "未指定负责人"}`).join("\n") || "尚未形成记录" }, { key: "risks", title: "风险与复盘", content: project.risks.map((risk) => `${risk.title}｜${PROJECT_EXECUTION_RISK_LEVEL_LABELS[risk.impact]}影响｜${risk.mitigation}`).join("\n") || "尚未形成记录" }], completeness: getProjectExecutionCompleteness(project) }; }
