import { randomId } from "@/lib/random-id";

export type ProductDecompositionStatus = "draft" | "in_progress" | "completed" | "archived";
export type ProductDecompositionStepKey = "positioning" | "scope" | "causes" | "solutions" | "actions";
export type ProductDecompositionStepStatus = "draft" | "in_progress" | "completed";
export type ProductDecompositionKano = "must_be" | "performance" | "attractive" | "indifferent" | "unclassified";
export type ProductDecompositionActionStatus = "not_started" | "in_progress" | "completed" | "paused";

export const PRODUCT_DECOMPOSITION_STEP_LABELS: Record<ProductDecompositionStepKey, string> = {
  positioning: "定位与中心问题",
  scope: "目标与范围",
  causes: "原因拆解",
  solutions: "方案与优先级",
  actions: "行动计划",
};

export const PRODUCT_DECOMPOSITION_KANO_LABELS: Record<ProductDecompositionKano, string> = {
  must_be: "必备属性",
  performance: "期望属性",
  attractive: "魅力属性",
  indifferent: "无差异属性",
  unclassified: "待判断",
};

export const PRODUCT_DECOMPOSITION_ACTION_STATUS_LABELS: Record<ProductDecompositionActionStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  paused: "已暂停",
};

export type ProductDecompositionScopeItem = {
  id: string;
  title: string;
  problem: string;
  inScope: boolean;
  judgment: string;
  evidence: string;
};

export type ProductDecompositionCauseNode = {
  id: string;
  parentId?: string;
  level: "major" | "minor" | "terminal";
  title: string;
  fact: string;
  judgment: string;
  evidence: string;
  gap: string;
  solutionDirection: string;
};

export type ProductDecompositionSolution = {
  id: string;
  causeNodeId?: string;
  title: string;
  description: string;
  userProblem: string;
  evidence: string;
  kano: ProductDecompositionKano;
  priority: number;
  status: "candidate" | "selected" | "deferred";
};

export type ProductDecompositionActionItem = {
  id: string;
  solutionId?: string;
  title: string;
  deliverable: string;
  prerequisite: string;
  owner: string;
  status: ProductDecompositionActionStatus;
  note: string;
};

export type ProductDecompositionProject = {
  id: string;
  title: string;
  linkedProductId?: string;
  targetUsers: string;
  scenario: string;
  centralQuestion: string;
  decisionGoal: string;
  status: ProductDecompositionStatus;
  currentStep: ProductDecompositionStepKey;
  steps: Record<ProductDecompositionStepKey, ProductDecompositionStepStatus>;
  positioning: { productValue: string; userNeed: string; decisionScope: string };
  scopeItems: ProductDecompositionScopeItem[];
  causeNodes: ProductDecompositionCauseNode[];
  solutions: ProductDecompositionSolution[];
  actionItems: ProductDecompositionActionItem[];
  sourceIndustryInsightIds: string[];
  sourceDemandItemIds: string[];
  sourceCompetitorEvidenceIds: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

const timestamp = () => new Date().toISOString();

function touch(project: ProductDecompositionProject, patch: Partial<ProductDecompositionProject>): ProductDecompositionProject {
  return { ...project, ...patch, id: project.id, updatedAt: timestamp() };
}

export function createProductDecompositionProject(input: {
  title: string;
  linkedProductId?: string;
  targetUsers?: string;
  scenario?: string;
  centralQuestion: string;
  decisionGoal?: string;
}): ProductDecompositionProject {
  const now = timestamp();
  return {
    id: randomId(),
    title: input.title.trim(),
    linkedProductId: input.linkedProductId || undefined,
    targetUsers: input.targetUsers?.trim() ?? "",
    scenario: input.scenario?.trim() ?? "",
    centralQuestion: input.centralQuestion.trim(),
    decisionGoal: input.decisionGoal?.trim() ?? "",
    status: "draft",
    currentStep: "positioning",
    steps: { positioning: "draft", scope: "draft", causes: "draft", solutions: "draft", actions: "draft" },
    positioning: { productValue: "", userNeed: "", decisionScope: "" },
    scopeItems: [],
    causeNodes: [],
    solutions: [],
    actionItems: [],
    sourceIndustryInsightIds: [],
    sourceDemandItemIds: [],
    sourceCompetitorEvidenceIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateProductDecompositionProject(project: ProductDecompositionProject, patch: Partial<ProductDecompositionProject>) {
  return touch(project, patch);
}

export function addProductDecompositionScopeItem(project: ProductDecompositionProject, input: Omit<ProductDecompositionScopeItem, "id">) {
  return touch(project, { scopeItems: [...project.scopeItems, { ...input, id: randomId() }] });
}

export function addProductDecompositionCause(project: ProductDecompositionProject, input: Omit<ProductDecompositionCauseNode, "id" | "gap" | "solutionDirection"> & Partial<Pick<ProductDecompositionCauseNode, "gap" | "solutionDirection">>) {
  return touch(project, { causeNodes: [...project.causeNodes, { ...input, id: randomId(), gap: input.gap ?? "", solutionDirection: input.solutionDirection ?? "" }] });
}

export function addProductDecompositionSolution(project: ProductDecompositionProject, input: Omit<ProductDecompositionSolution, "id" | "userProblem" | "evidence" | "status"> & Partial<Pick<ProductDecompositionSolution, "userProblem" | "evidence" | "status">>) {
  return touch(project, { solutions: [...project.solutions, { ...input, id: randomId(), userProblem: input.userProblem ?? "", evidence: input.evidence ?? "", status: input.status ?? "candidate" }] });
}

export function addProductDecompositionAction(project: ProductDecompositionProject, input: Omit<ProductDecompositionActionItem, "id" | "owner" | "status" | "note"> & Partial<Pick<ProductDecompositionActionItem, "owner" | "status" | "note">>) {
  return touch(project, { actionItems: [...project.actionItems, { ...input, id: randomId(), owner: input.owner ?? "", status: input.status ?? "not_started", note: input.note ?? "" }] });
}

export function getProductDecompositionCompleteness(project: ProductDecompositionProject) {
  const checks = [
    ["项目名称", Boolean(project.title)],
    ["中心问题", Boolean(project.centralQuestion)],
    ["产品定位", Boolean(project.positioning.productValue || project.positioning.userNeed)],
    ["目标与范围", project.scopeItems.length > 0],
    ["原因拆解", project.causeNodes.length > 0],
    ["解决方案", project.solutions.length > 0],
    ["行动计划", project.actionItems.length > 0],
  ] as const;
  const missing = checks.filter(([, filled]) => !filled).map(([label]) => label);
  return { complete: missing.length === 0, missing, filled: checks.length - missing.length, total: checks.length };
}

export type ProductDecompositionReport = {
  title: string;
  sections: Array<{ key: string; title: string; content: string }>;
  completeness: ReturnType<typeof getProductDecompositionCompleteness>;
  sourceReferences: { industryInsight: number; demandItems: number; competitorEvidence: number };
};

export function buildProductDecompositionReport(project: ProductDecompositionProject): ProductDecompositionReport {
  const causeText = project.causeNodes.map((cause) => `${cause.title}：事实 ${cause.fact || "暂无"}；判断 ${cause.judgment || "暂无"}；证据 ${cause.evidence || "暂无"}`).join("\n") || "尚未形成记录";
  const solutionText = [...project.solutions].sort((a, b) => a.priority - b.priority).map((solution) => `${solution.priority}. ${solution.title}｜${PRODUCT_DECOMPOSITION_KANO_LABELS[solution.kano]}｜${solution.description || "暂无描述"}`).join("\n") || "尚未形成记录";
  const actionText = project.actionItems.map((action) => `${action.title}：${action.deliverable || "暂无交付成果"}（${PRODUCT_DECOMPOSITION_ACTION_STATUS_LABELS[action.status]}）`).join("\n") || "尚未形成记录";
  return {
    title: project.title,
    sections: [
      { key: "positioning", title: "定位与中心问题", content: `${project.positioning.productValue || "尚未填写产品价值"}；${project.centralQuestion}` },
      { key: "scope", title: "目标与范围", content: project.scopeItems.map((item) => `${item.title}：${item.inScope ? "纳入" : "排除"}；${item.problem || "暂无问题描述"}`).join("\n") || "尚未形成记录" },
      { key: "causes", title: "事实与判断", content: causeText },
      { key: "solutions", title: "方案与优先级", content: solutionText },
      { key: "actions", title: "行动计划", content: actionText },
    ],
    completeness: getProductDecompositionCompleteness(project),
    sourceReferences: {
      industryInsight: project.sourceIndustryInsightIds.length,
      demandItems: project.sourceDemandItemIds.length,
      competitorEvidence: project.sourceCompetitorEvidenceIds.length,
    },
  };
}
