export type IndustryInsightStatus = "draft" | "in_progress" | "completed" | "archived";
export type IndustryEvidenceTag = "fact" | "inference" | "unverified" | "strategy";
export type IndustryDimensionKey = "scale" | "trend" | "share_shift" | "substitution";
export type IndustryStage = "emerging" | "exploring" | "growth" | "expansion" | "bubble" | "mature" | "unclear";
export type IndustryStepKey = "purpose" | "boundary" | "dimensions" | "stage" | "chain" | "conclusion";
export type IndustryChainLayer = "upstream" | "midstream" | "downstream" | "support";

export const INDUSTRY_DIMENSIONS: Array<{ key: IndustryDimensionKey; label: string; question: string }> = [
  { key: "scale", label: "行业规模", question: "这个市场现在有多大，规模口径是什么？" },
  { key: "trend", label: "发展趋势", question: "规模、需求或行为正在往什么方向变化？" },
  { key: "share_shift", label: "市场占比", question: "不同细分市场或参与者的占比如何变化？" },
  { key: "substitution", label: "此消彼长", question: "哪些方案正在替代或被替代，原因是什么？" },
];

export const INDUSTRY_STEP_LABELS: Record<IndustryStepKey, string> = {
  purpose: "研究目的",
  boundary: "行业边界",
  dimensions: "四维分析",
  stage: "阶段判断",
  chain: "产业链",
  conclusion: "结论与下一步",
};

export const INDUSTRY_FIELD_EXAMPLES = {
  purpose: "例如：判断可重复使用书写材料是否值得进入家庭办公和学习场景，并明确下一步研究重点。",
  boundary: "例如：研究中国大陆家庭办公场景的可擦写墙面材料，暂不纳入一次性纸质白板和企业会议室采购。",
  scale: "例如：整理近两年的销售量、搜索热度或公开市场规模数据，并注明统计口径。",
  trend: "例如：记录家庭办公空间增加、短视频种草或可持续消费等趋势及其证据。",
  stage: "例如：观察到用户教育成本仍较高，但复购和替换场景开始出现；这只是待验证判断。",
  chain: "例如：上游为基材和涂层，中游为加工与品牌，下游为电商零售和家庭使用场景。",
  conclusion: "例如：机会是验证高频擦写场景，风险是用户对残留痕迹的容忍度未知。",
} as const;

export type IndustryInsightBoundary = {
  object: string;
  scenarios: string;
  region: string;
  timeRange: string;
  exclusions: string;
};

export type IndustryDimension = {
  key: IndustryDimensionKey;
  fact: string;
  evidence: string;
  judgment: string;
  tag: IndustryEvidenceTag;
};

export type IndustryStageRecord = {
  currentStage: IndustryStage;
  basis: string;
  milestones: string[];
  durationAssumption: string;
  nextInflection: string;
  evidenceIds: string[];
};

export type IndustryChainNode = {
  id: string;
  layer: IndustryChainLayer;
  role: string;
  participants: string;
  valueFlow: string;
  productRelation: string;
  evidenceIds: string[];
};

export type IndustryEvidence = {
  id: string;
  source: string;
  sourceType: string;
  collectedAt: string;
  reference: string;
  statement: string;
  tag: IndustryEvidenceTag;
};

export type IndustryInsightConclusion = {
  opportunity: string;
  risks: string;
  unverifiedQuestions: string;
  nextModule: "competitor-analysis" | "demand-exploration" | "none";
  nextAction: string;
};

export type IndustryInsightProject = {
  id: string;
  title: string;
  productName: string;
  targetUsers: string;
  analysisTheme: string;
  decisionQuestion: string;
  expectedAction: string;
  status: IndustryInsightStatus;
  steps: Record<IndustryStepKey, IndustryInsightStatus>;
  boundary: IndustryInsightBoundary;
  dimensions: IndustryDimension[];
  stage: IndustryStageRecord;
  chainNodes: IndustryChainNode[];
  conclusion: IndustryInsightConclusion;
  evidence: IndustryEvidence[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function createIndustryInsightProject(input: { title: string; productName?: string; targetUsers?: string; analysisTheme?: string; decisionQuestion?: string; expectedAction?: string }): IndustryInsightProject {
  const timestamp = now();
  return {
    id: id("industry-insight"),
    title: input.title.trim(),
    productName: input.productName?.trim() ?? "",
    targetUsers: input.targetUsers?.trim() ?? "",
    analysisTheme: input.analysisTheme?.trim() ?? "",
    decisionQuestion: input.decisionQuestion?.trim() ?? "",
    expectedAction: input.expectedAction?.trim() ?? "",
    status: "draft",
    steps: { purpose: "draft", boundary: "draft", dimensions: "draft", stage: "draft", chain: "draft", conclusion: "draft" },
    boundary: { object: "", scenarios: "", region: "", timeRange: "", exclusions: "" },
    dimensions: INDUSTRY_DIMENSIONS.map(({ key }) => ({ key, fact: "", evidence: "", judgment: "", tag: "fact" })),
    stage: { currentStage: "unclear", basis: "", milestones: [], durationAssumption: "", nextInflection: "", evidenceIds: [] },
    chainNodes: [],
    conclusion: { opportunity: "", risks: "", unverifiedQuestions: "", nextModule: "none", nextAction: "" },
    evidence: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateIndustryInsightProject(project: IndustryInsightProject, patch: Partial<IndustryInsightProject>): IndustryInsightProject {
  const nextStatus = patch.status ?? project.status;
  return {
    ...project,
    ...patch,
    status: nextStatus === "archived" ? "archived" : nextStatus,
    archivedAt: nextStatus === "archived" ? patch.archivedAt ?? now() : undefined,
    updatedAt: now(),
  };
}

export function getIndustryInsightCompleteness(project: IndustryInsightProject) {
  const missing: string[] = [];
  if (!project.title) missing.push("项目名称");
  if (!project.decisionQuestion) missing.push("研究决策问题");
  if (!project.boundary.object) missing.push("行业边界对象");
  if (!project.boundary.scenarios) missing.push("目标场景");
  if (project.dimensions.every((item) => !item.fact && !item.judgment)) missing.push("四维分析记录");
  if (!project.stage.basis) missing.push("阶段判断依据");
  if (project.chainNodes.length === 0) missing.push("产业链节点");
  if (!project.conclusion.opportunity && !project.conclusion.risks) missing.push("机会或风险结论");
  return { complete: missing.length === 0, missing, filled: 9 - missing.length, total: 9 };
}

export type IndustryInsightReport = {
  title: string;
  sections: Array<{ key: string; title: string; content: string; tag?: IndustryEvidenceTag }>;
  limitations: string;
  completeness: ReturnType<typeof getIndustryInsightCompleteness>;
};

export function buildIndustryInsightReport(project: IndustryInsightProject): IndustryInsightReport {
  const dimensionText = project.dimensions
    .filter((item) => item.fact || item.judgment || item.evidence)
    .map((item) => {
      const label = INDUSTRY_DIMENSIONS.find((definition) => definition.key === item.key)?.label ?? item.key;
      return `${label}：${item.fact || "暂无事实"}；判断：${item.judgment || "暂无判断"}；证据：${item.evidence || "暂无证据"}`;
    }).join("\n");
  const chainText = project.chainNodes.map((node) => `${node.layer} / ${node.role}：${node.participants}；价值流：${node.valueFlow}`).join("\n");
  return {
    title: project.title,
    sections: [
      { key: "boundary", title: "行业边界", content: `${project.boundary.object}｜${project.boundary.scenarios}｜${project.boundary.region}｜${project.boundary.timeRange}` },
      { key: "dimensions", title: "四维分析", content: dimensionText || "尚未形成四维分析记录" },
      { key: "stage", title: "阶段判断", content: `阶段：${project.stage.currentStage}；依据：${project.stage.basis || "尚未填写"}；下一转折：${project.stage.nextInflection || "尚未填写"}`, tag: project.stage.basis ? "inference" : "unverified" },
      { key: "chain", title: "产业链", content: chainText || "尚未添加产业链节点" },
      { key: "conclusion", title: "结论与下一步", content: `机会：${project.conclusion.opportunity || "暂无"}\n风险：${project.conclusion.risks || "暂无"}\n待验证：${project.conclusion.unverifiedQuestions || "暂无"}\n下一步：${project.conclusion.nextAction || "暂无"}`, tag: "strategy" },
    ],
    limitations: "本报告保留证据链与信息缺口，不会自动抓取外部数据、计算市场规模；不会自动判定行业阶段，阶段结论必须由执行人依据证据确认。",
    completeness: getIndustryInsightCompleteness(project),
  };
}
