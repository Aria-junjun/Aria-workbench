import type { LocalWorkbenchData } from "./local-store";
import type { EvidenceReferenceModule, EvidenceReferenceStatus } from "./evidence-references";
import { INDUSTRY_DIMENSIONS } from "./industry-insight";

export type EvidenceSourceField = { path: string; label: string; snapshot: string; status: EvidenceReferenceStatus };
export type EvidenceSourceProject = { module: EvidenceReferenceModule; projectId: string; projectTitle: string; fields: EvidenceSourceField[] };
export type EvidenceFieldConfirmation = {
  module: EvidenceReferenceModule;
  projectId: string;
  path: string;
  snapshot: string;
  confirmedAt: string;
};

function fields<T extends object>(record: T, labels: Partial<Record<keyof T, string>>, prefix = "", status: EvidenceReferenceStatus = "original"): EvidenceSourceField[] {
  return Object.entries(labels).flatMap(([key, label]) => {
    const value = record[key as keyof T];
    return typeof value === "string" && value.trim()
      ? [{ path: `${prefix}${key}`, label: String(label), snapshot: value, status }]
      : [];
  });
}
function tagStatus(tag: string): EvidenceReferenceStatus {
  return tag === "unverified" ? "to-verify" : tag === "inference" || tag === "strategy" ? "inference" : "original";
}

/** Read actual saved business fields. Neither completion nor an AI acceptance implies confirmation. */
export function buildEvidenceSourceProjects(data: LocalWorkbenchData): EvidenceSourceProject[] {
  const projects: EvidenceSourceProject[] = [];
  const add = (module: EvidenceReferenceModule, project: { id: string; title: string; status: string }, nativeFields: EvidenceSourceField[]) => {
    if (project.status === "archived") return;
    const confirmedFields = nativeFields.map((field) => {
      const confirmation = data.evidenceFieldConfirmations?.find((item) => item.module === module && item.projectId === project.id && item.path === field.path);
      return { ...field, status: confirmation ? confirmation.snapshot === field.snapshot ? "confirmed" as const : "edited" as const : field.status };
    });
    // A target owns its independent copy. Keep its reference id as the next hop's field path,
    // so the original reference remains available for tracing the complete chain.
    const copies = (data.evidenceReferences ?? [])
      .filter((reference) => reference.targetModule === module && reference.targetProjectId === project.id && reference.snapshot.trim())
      .map((reference) => ({ path: `evidenceReferences.${reference.id}`, label: `引用副本·${reference.sourceFieldLabel}`, snapshot: reference.snapshot, status: reference.status }));
    projects.push({ module, projectId: project.id, projectTitle: project.title, fields: [...confirmedFields, ...copies] });
  };
  for (const project of data.industryInsightProjects ?? []) {
    add("industry-insight", project, [
      ...fields(project, { decisionQuestion: "决策问题", expectedAction: "预期行动", targetUsers: "目标用户", analysisTheme: "研究主题" }),
      ...fields(project.boundary, { object: "研究对象", scenarios: "目标场景", region: "地域", timeRange: "时间范围", exclusions: "排除范围" }, "boundary."),
      ...project.dimensions.flatMap((dimension) => {
        const label = INDUSTRY_DIMENSIONS.find((item) => item.key === dimension.key)?.label ?? "行业维度";
        return fields(dimension, { fact: `${label}·观察事实`, evidence: `${label}·证据`, judgment: `${label}·判断` }, `dimensions.${dimension.key}.`, tagStatus(dimension.tag));
      }),
      ...fields(project.stage, { basis: "阶段判断依据", nextInflection: "下一次转折因素", durationAssumption: "持续时间假设" }, "stage.", "inference"),
      ...project.chainNodes.flatMap((node) => fields(node, { role: "产业链角色", participants: "产业链参与者", valueFlow: "价值流", productRelation: "产品关联" }, `chainNodes.${node.id}.`)),
      ...fields(project.conclusion, { opportunity: "机会判断", risks: "主要风险", unverifiedQuestions: "待验证问题", nextAction: "下一步动作" }, "conclusion.", "inference"),
      ...project.evidence.flatMap((item) => fields(item, { statement: `证据·${item.source}` }, `evidence.${item.id}.`, tagStatus(item.tag))),
    ]);
  }
  for (const project of data.demandConfirmationDocuments ?? []) {
    add("demand-exploration", project, [
      ...fields(project, { userType: "目标用户", scenario: "使用场景", problem: "用户问题", goal: "研究目标", source: "资料来源" }),
      ...project.demandItems.filter((item) => item.status !== "archived").flatMap((item) => [
        ...fields(item, { needStatement: `需求·${item.subFeature}`, functionalQuestion: `正向问题·${item.subFeature}`, dysfunctionalQuestion: `反向问题·${item.subFeature}` }, `demandItems.${item.id}.`),
        ...item.evidence.flatMap((evidence) => fields(evidence, { statement: `需求证据·${evidence.source}` }, `demandItems.${item.id}.evidence.${evidence.id}.`)),
      ]),
    ]);
  }
  for (const project of data.competitorAnalysisProjects ?? []) {
    add("competitor-analysis", project, [
      ...fields(project, { targetUsers: "目标用户", analysisTheme: "分析主题", decisionQuestion: "决策问题", expectedAction: "预期行动", productStage: "产品阶段" }),
      ...project.competitors.flatMap((item) => fields(item, { users: `${item.name}·用户`, scenarios: `${item.name}·场景`, problem: `${item.name}·问题`, selectionReason: `${item.name}·选择依据` }, `competitors.${item.id}.`)),
      ...project.evidence.flatMap((item) => fields(item, { statement: `证据·${item.sourceName}` }, `evidence.${item.id}.`, tagStatus(item.tag))),
      ...Object.entries(project.layerAnalyses).flatMap(([id, layers]) => Object.entries(layers).flatMap(([layer, item]) => {
        const label = ({ strategy: "战略层", scope: "范围层", structure: "结构层", framework: "框架层", presentation: "表现层" } as Record<string, string>)[layer];
        return fields(item, { observation: `${label}·观察`, implication: `${label}·影响`, inspiration: `${label}·启发` }, `layerAnalyses.${id}.${layer}.`, tagStatus(item.tag));
      })),
      ...project.stageRecords.flatMap((item) => fields(item, { change: "阶段变化", reason: "变化原因", borrow: "可借鉴项", avoidCopying: "不可复制项" }, `stageRecords.${item.id}.`)),
      ...project.comparisons.flatMap((item) => fields(item, { competitorPractice: "竞品做法", ourState: "产品现状", reason: "差异依据" }, `comparisons.${item.id}.`)),
      ...project.strategies.flatMap((item) => fields(item, { problem: `${item.title}·问题`, basis: `${item.title}·依据`, goal: `${item.title}·目标`, solution: `${item.title}·方案`, validation: `${item.title}·验证`, nextAction: `${item.title}·行动` }, `strategies.${item.id}.`, "inference")),
    ]);
  }
  for (const project of data.productDecompositionProjects ?? []) {
    add("product-decomposition", project, [
      ...fields(project, { targetUsers: "目标用户", scenario: "使用场景", centralQuestion: "中心问题", decisionGoal: "决策目标" }),
      ...fields(project.positioning, { productValue: "产品价值", userNeed: "用户需求", decisionScope: "决策范围" }, "positioning."),
      ...project.scopeItems.flatMap((item) => fields(item, { problem: `${item.title}·问题`, judgment: `${item.title}·判断`, evidence: `${item.title}·证据` }, `scopeItems.${item.id}.`)),
      ...project.causeNodes.flatMap((item) => fields(item, { fact: `${item.title}·事实`, judgment: `${item.title}·判断`, evidence: `${item.title}·证据`, gap: `${item.title}·信息缺口`, solutionDirection: `${item.title}·方案方向` }, `causeNodes.${item.id}.`)),
      ...project.solutions.flatMap((item) => fields(item, { description: `${item.title}·方案`, userProblem: `${item.title}·用户问题`, evidence: `${item.title}·证据` }, `solutions.${item.id}.`)),
      ...project.actionItems.flatMap((item) => fields(item, { deliverable: `${item.title}·交付物`, prerequisite: `${item.title}·前置条件`, note: `${item.title}·备注` }, `actionItems.${item.id}.`)),
    ]);
  }
  return projects;
}
