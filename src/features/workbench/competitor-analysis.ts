export type CompetitorProjectStatus = "draft" | "in_progress" | "completed" | "archived";
export type CompetitorRelation = "direct" | "substitute" | "reference" | "not_competitor";
export type EvidenceTag = "fact" | "inference" | "unverified" | "strategy";
export type FiveLayerKey = "strategy" | "scope" | "structure" | "framework" | "presentation";
export type DifferenceType = "missing" | "incomplete" | "replaceable" | "available" | "differentiation" | "not_applicable";
export type StrategyType = "follow" | "borrow" | "differentiate" | "defer";
import type { NeutralResearchSummary, ResearchInput } from "./research-context";

export type CompetitorEvidence = {
  id: string;
  sourceName: string;
  sourceType: string;
  collectedAt: string;
  reference: string;
  statement: string;
  note: string;
  tag: EvidenceTag;
};

export type CompetitorProfile = {
  id: string;
  name: string;
  users: string;
  scenarios: string;
  problem: string;
  relation: CompetitorRelation;
  selectionReason: string;
  evidenceIds: string[];
};

export type FiveLayerRecord = {
  observation: string;
  evidenceIds: string[];
  implication: string;
  inspiration: string;
  tag: EvidenceTag;
  updatedAt: string;
};

export type FiveLayerAnalysis = Record<FiveLayerKey, FiveLayerRecord>;

export type CompetitorStageRecord = {
  id: string;
  competitorId: string;
  stage: string;
  stageGoal: string;
  versionOrPeriod: string;
  change: string;
  reason: string;
  borrow: string;
  avoidCopying: string;
  evidenceIds: string[];
};

export type ProductComparison = {
  id: string;
  competitorId: string;
  layer: FiveLayerKey;
  competitorPractice: string;
  ourState: string;
  differenceType: DifferenceType;
  evidenceIds: string[];
  act: boolean;
  reason: string;
};

export type CompetitorStrategy = {
  id: string;
  type: StrategyType;
  title: string;
  problem: string;
  basis: string;
  goal: string;
  solution: string;
  expectedValue: string;
  effort: string;
  priority: string;
  nextAction: string;
  validation: string;
  evidenceIds: string[];
};

export type CompetitorAnalysisProject = {
  id: string;
  title: string;
  productName: string;
  opportunityProductId?: string;
  targetUsers: string;
  analysisTheme: string;
  decisionQuestion: string;
  expectedAction: string;
  productStage: string;
  researchInput?: ResearchInput;
  neutralSummary?: NeutralResearchSummary;
  competitors: CompetitorProfile[];
  evidence: CompetitorEvidence[];
  layerAnalyses: Record<string, FiveLayerAnalysis>;
  stageRecords: CompetitorStageRecord[];
  comparisons: ProductComparison[];
  strategies: CompetitorStrategy[];
  status: CompetitorProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type CompetitorReportSection = { key: string; title: string; content: string; evidenceIds: string[] };
export type CompetitorAnalysisReport = { sections: CompetitorReportSection[]; limitations: string[] };

const whiteboardCaseMaterials = [
  {
    sourceName: "白板贴内部经营记录",
    sourceType: "内部产品记录",
    collectedAt: "2026-07-20",
    reference: "产品判断记录，需回到销售明细复核",
    statement: "记录中提到：白板贴日常出货量约100单；拼多多平台曾出现日销约500单的高峰，当前天猫平台约100单。",
    note: "原记录未标明统计周期、平台口径和SKU范围，先作为待核验销售证据，不能直接当作最终销量结论。",
    tag: "unverified" as EvidenceTag,
  },
  {
    sourceName: "白板贴内部经营判断",
    sourceType: "内部分析记录",
    collectedAt: "2026-07-20",
    reference: "产品判断记录，非用户原话",
    statement: "已有判断认为白板贴属于价格竞争较明显的通用产品，教育场景和真实使用内容可能是差异化方向。",
    note: "这是内部推断，不等于用户反馈；需要补充评价、退货、客服记录或访谈原话。",
    tag: "inference" as EvidenceTag,
  },
];

function id(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
function now(): string { return new Date().toISOString(); }
function emptyLayerRecord(): FiveLayerRecord { return { observation: "", evidenceIds: [], implication: "", inspiration: "", tag: "fact", updatedAt: now() }; }
function emptyLayers(): FiveLayerAnalysis { return { strategy: emptyLayerRecord(), scope: emptyLayerRecord(), structure: emptyLayerRecord(), framework: emptyLayerRecord(), presentation: emptyLayerRecord() }; }

export function createCompetitorAnalysisProject(input: Omit<CompetitorAnalysisProject, "id" | "competitors" | "evidence" | "layerAnalyses" | "stageRecords" | "comparisons" | "strategies" | "status" | "createdAt" | "updatedAt">): CompetitorAnalysisProject {
  const timestamp = now();
  return { ...input, id: id("competitor-project"), competitors: [], evidence: [], layerAnalyses: {}, stageRecords: [], comparisons: [], strategies: [], status: "draft", createdAt: timestamp, updatedAt: timestamp };
}

export function createWhiteboardCompetitorAnalysisProject(input: Omit<CompetitorAnalysisProject, "id" | "productName" | "competitors" | "evidence" | "layerAnalyses" | "stageRecords" | "comparisons" | "strategies" | "status" | "createdAt" | "updatedAt">): CompetitorAnalysisProject {
  const project = createCompetitorAnalysisProject({ ...input, productName: "白板贴" });
  const evidence = whiteboardCaseMaterials.map((item) => ({ ...item, id: id("evidence") }));
  return { ...project, evidence };
}

export function addCompetitorProfile(project: CompetitorAnalysisProject, input: Partial<Omit<CompetitorProfile, "id">> & Pick<CompetitorProfile, "name">): CompetitorAnalysisProject {
  const competitor: CompetitorProfile = { id: id("competitor"), name: input.name.trim(), users: input.users?.trim() ?? "", scenarios: input.scenarios?.trim() ?? "", problem: input.problem?.trim() ?? "", relation: input.relation ?? "reference", selectionReason: input.selectionReason?.trim() ?? "", evidenceIds: input.evidenceIds ?? [] };
  return { ...project, competitors: [...project.competitors, competitor], status: "in_progress", updatedAt: now() };
}

export function updateCompetitorProfile(project: CompetitorAnalysisProject, competitorId: string, patch: Partial<Omit<CompetitorProfile, "id" | "evidenceIds">>): CompetitorAnalysisProject {
  return {
    ...project,
    competitors: project.competitors.map((competitor) => competitor.id === competitorId
      ? { ...competitor, ...patch, name: patch.name?.trim() ?? competitor.name, selectionReason: patch.selectionReason?.trim() ?? competitor.selectionReason }
      : competitor),
    updatedAt: now(),
  };
}

export function updateFiveLayerAnalysis(project: CompetitorAnalysisProject, competitorId: string, layer: FiveLayerKey, patch: Partial<Omit<FiveLayerRecord, "updatedAt">>): CompetitorAnalysisProject {
  const current = project.layerAnalyses[competitorId] ?? emptyLayers();
  const next: FiveLayerRecord = { ...current[layer], ...patch, updatedAt: now() };
  return { ...project, layerAnalyses: { ...project.layerAnalyses, [competitorId]: { ...current, [layer]: next } }, updatedAt: now() };
}

export function addCompetitorStageRecord(project: CompetitorAnalysisProject, input: Pick<CompetitorStageRecord, "competitorId" | "stage" | "versionOrPeriod" | "change"> & Partial<Omit<CompetitorStageRecord, "id" | "competitorId" | "stage" | "versionOrPeriod" | "change">>): CompetitorAnalysisProject {
  const record: CompetitorStageRecord = { id: id("stage-record"), competitorId: input.competitorId, stage: input.stage, stageGoal: input.stageGoal ?? "", versionOrPeriod: input.versionOrPeriod, change: input.change, reason: input.reason ?? "", borrow: input.borrow ?? "", avoidCopying: input.avoidCopying ?? "", evidenceIds: input.evidenceIds ?? [] };
  return { ...project, stageRecords: [...project.stageRecords, record], status: "in_progress", updatedAt: now() };
}

export function addProductComparison(project: CompetitorAnalysisProject, input: Omit<ProductComparison, "id">): CompetitorAnalysisProject {
  return { ...project, comparisons: [...project.comparisons, { ...input, id: id("comparison") }], status: "in_progress", updatedAt: now() };
}

export function addCompetitorStrategy(project: CompetitorAnalysisProject, input: Omit<CompetitorStrategy, "id">): CompetitorAnalysisProject {
  return { ...project, strategies: [...project.strategies, { ...input, id: id("strategy") }], status: "in_progress", updatedAt: now() };
}

export function archiveCompetitorAnalysisProject(project: CompetitorAnalysisProject): CompetitorAnalysisProject { return { ...project, status: "archived", updatedAt: now() }; }
export function restoreCompetitorAnalysisProject(project: CompetitorAnalysisProject): CompetitorAnalysisProject { return { ...project, status: project.competitors.length > 0 ? "in_progress" : "draft", updatedAt: now() }; }

export function buildCompetitorAnalysisReport(project: CompetitorAnalysisProject): CompetitorAnalysisReport {
  const sections: CompetitorReportSection[] = [
    { key: "summary", title: "执行摘要", content: project.decisionQuestion, evidenceIds: [] },
    { key: "scope", title: "分析目的、对象和范围", content: `${project.productName}｜${project.targetUsers}｜${project.analysisTheme}`, evidenceIds: [] },
    { key: "competitors", title: "竞品选择依据", content: project.competitors.map((item) => `${item.name}：${item.selectionReason || "待补充"}`).join("\n"), evidenceIds: project.competitors.flatMap((item) => item.evidenceIds) },
    { key: "five_layers", title: "五层对比", content: Object.values(project.layerAnalyses).flatMap((layers) => Object.values(layers).map((item) => item.observation)).filter(Boolean).join("\n"), evidenceIds: Object.values(project.layerAnalyses).flatMap((layers) => Object.values(layers).flatMap((item) => item.evidenceIds)) },
    { key: "stages", title: "竞品阶段和版本变化", content: project.stageRecords.map((item) => `${item.versionOrPeriod}：${item.change}`).join("\n"), evidenceIds: project.stageRecords.flatMap((item) => item.evidenceIds) },
    { key: "self_state", title: "我们的产品状态", content: project.comparisons.map((item) => `${item.layer}：${item.ourState}`).join("\n"), evidenceIds: project.comparisons.flatMap((item) => item.evidenceIds) },
    { key: "strategy", title: "策略分类和优先级行动计划", content: project.strategies.map((item) => `[${item.type}] ${item.title}`).join("\n"), evidenceIds: project.strategies.flatMap((item) => item.evidenceIds) },
    { key: "evidence", title: "证据附录", content: project.evidence.map((item) => `[${item.tag}] ${item.sourceName}：${item.statement}`).join("\n"), evidenceIds: project.evidence.map((item) => item.id) },
    { key: "limitations", title: "未验证信息和分析限制", content: "本报告基于已记录的公开资料、实际体验和内部观察，不代表竞品完整真实情况。", evidenceIds: [] },
  ];
  return { sections, limitations: ["未被证据支持的内容不得作为确定事实。", "竞品的内部数据、商业数据和未公开机制需要进一步验证。"] };
}
