import type {
  IndustryDimensionKey,
  IndustryEvidenceTag,
  IndustryInsightProject,
  IndustryStage,
} from "@/features/workbench/industry-insight";

export type IndustryInsightDraftStatus = "draft" | "accepted" | "edited" | "needs_verification" | "rejected";

export type IndustryInsightDraftField = {
  id: string;
  fieldPath: string;
  value: string;
  status: IndustryInsightDraftStatus;
  sourceRefs: string[];
  importedAt: string;
  editedValue?: string;
};

export type IndustryInsightImportResult = {
  drafts: IndustryInsightDraftField[];
  warnings: string[];
};

type IndustryInsightFieldDefinition = {
  path: string;
  section: string;
  label: string;
  guidance: string;
};

export const INDUSTRY_INSIGHT_FIELD_CATALOG: readonly IndustryInsightFieldDefinition[] = [
  { path: "purpose.decisionQuestion", section: "研究目的", label: "决策问题", guidance: "本次研究需要支持的具体决策。" },
  { path: "purpose.expectedAction", section: "研究目的", label: "预期行动", guidance: "研究确认后准备采取的动作。" },
  { path: "boundary.object", section: "行业边界", label: "研究对象", guidance: "产品或行业对象的明确名称。" },
  { path: "boundary.scenarios", section: "行业边界", label: "目标场景", guidance: "实际使用场景，不扩展成泛人群描述。" },
  { path: "boundary.region", section: "行业边界", label: "地域", guidance: "研究的地域口径。" },
  { path: "boundary.timeRange", section: "行业边界", label: "时间范围", guidance: "研究统计的时间范围。" },
  { path: "boundary.exclusions", section: "行业边界", label: "排除范围", guidance: "明确不纳入的产品、用户或区域。" },
  ...(["scale", "trend", "share_shift", "substitution"] as IndustryDimensionKey[]).flatMap((key) => {
    const label = { scale: "行业规模", trend: "发展趋势", share_shift: "市场占比", substitution: "此消彼长" }[key];
    return [
      { path: `dimensions.${key}.fact`, section: "四维分析", label: `${label}·观察事实`, guidance: "只写观察到的事实或数据。" },
      { path: `dimensions.${key}.judgment`, section: "四维分析", label: `${label}·判断`, guidance: "写基于事实的判断，不足时标记待验证。" },
      { path: `dimensions.${key}.evidence`, section: "四维分析", label: `${label}·证据`, guidance: "写来源、口径或证据摘要。" },
      { path: `dimensions.${key}.tag`, section: "四维分析", label: `${label}·信息类型`, guidance: "只能是事实、推断、待验证或策略建议。" },
    ];
  }),
  { path: "stage.currentStage", section: "阶段判断", label: "暂定阶段", guidance: "只能使用页面已有阶段选项。" },
  { path: "stage.basis", section: "阶段判断", label: "阶段判断依据", guidance: "合并规模、趋势、里程碑和行为变化证据。" },
  { path: "stage.nextInflection", section: "阶段判断", label: "下一次转折因素", guidance: "可能改变阶段判断的外部或内部因素。" },
  { path: "stage.durationAssumption", section: "阶段判断", label: "持续时间假设", guidance: "预计何时复盘或该判断有效的时间假设。" },
  { path: "chainNodes[].layer", section: "产业链", label: "层级", guidance: "只能是上游、中游、下游或支持。" },
  { path: "chainNodes[].role", section: "产业链", label: "角色", guidance: "该节点在产业链中的角色。" },
  { path: "chainNodes[].participants", section: "产业链", label: "参与者与价值流", guidance: "合并参与者、价值流和产品关联。" },
  { path: "chainNodes[].valueFlow", section: "产业链", label: "参与者与价值流·价值流", guidance: "写参与者之间如何传递产品、成本或价值。" },
  { path: "conclusion.opportunity", section: "结论与下一步", label: "机会判断", guidance: "写值得验证的机会，不直接写已决定进入。" },
  { path: "conclusion.risks", section: "结论与下一步", label: "主要风险", guidance: "写可能阻止判断成立的风险。" },
  { path: "conclusion.unverifiedQuestions", section: "结论与下一步", label: "待验证问题", guidance: "承接无法确认或无法归类的关键问题。" },
  { path: "conclusion.nextAction", section: "结论与下一步", label: "下一步动作", guidance: "写动作和目标模块。" },
] as const;

const fieldByPath = new Map(INDUSTRY_INSIGHT_FIELD_CATALOG.map((field) => [field.path, field]));
const formalPathAliases: Record<string, string> = {
  decisionQuestion: "purpose.decisionQuestion",
  expectedAction: "purpose.expectedAction",
};
const sectionNames = new Set(INDUSTRY_INSIGHT_FIELD_CATALOG.map((field) => field.section));
const labelAliases: Record<string, string> = {
  决策问题: "purpose.decisionQuestion",
  预期行动: "purpose.expectedAction",
  研究对象: "boundary.object",
  目标场景: "boundary.scenarios",
  地域: "boundary.region",
  时间范围: "boundary.timeRange",
  排除范围: "boundary.exclusions",
  暂定阶段: "stage.currentStage",
  阶段判断依据: "stage.basis",
  下一次转折因素: "stage.nextInflection",
  持续时间假设: "stage.durationAssumption",
  机会判断: "conclusion.opportunity",
  主要风险: "conclusion.risks",
  待验证问题: "conclusion.unverifiedQuestions",
  下一步动作: "conclusion.nextAction",
  观察事实: "fact",
  判断: "judgment",
  证据: "evidence",
  信息类型: "tag",
};

const dimensionLabels: Record<string, IndustryDimensionKey> = {
  行业规模: "scale",
  发展趋势: "trend",
  市场占比: "share_shift",
  此消彼长: "substitution",
};

const id = () => `industry-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function buildIndustryInsightResearchPrompt(project: IndustryInsightProject): string {
  const fields = INDUSTRY_INSIGHT_FIELD_CATALOG.map((field) => `- ${field.path}（${field.section} / ${field.label}）：${field.guidance}`).join("\n");
  return [
    "你是产品经理研究助手。请只根据公开且可核验的资料，按下面唯一字段协议输出 Markdown。",
    `研究项目：${project.title}`,
    `研究对象：${project.productName || "未填写"}`,
    `目标用户：${project.targetUsers || "未填写"}`,
    `分析主题：${project.analysisTheme || "未填写"}`,
    `决策问题：${project.decisionQuestion || "未填写"}`,
    `预期行动：${project.expectedAction || "未填写"}`,
    "输出要求：每个字段单独回答；区分事实、推断、待验证和策略建议；无数据写“未找到”；不要编造市场规模、销量或占比；关键事实附来源、发布时间和抓取时间。",
    "必须严格按照下面的字段路径和 Markdown 格式输出，不得使用编号列表代替字段，不得改写字段路径，不得把多个字段合并成一段：",
    "### purpose.decisionQuestion",
    "事实：",
    "推断：",
    "待验证：",
    "策略建议：",
    "### purpose.expectedAction",
    "事实：",
    "推断：",
    "待验证：",
    "策略建议：",
    "其余字段也必须使用同样的 `### 字段路径` 标题；没有内容时填写“未找到”。",
    "只能使用以下字段路径，不得创建其他字段：",
    fields,
  ].join("\n");
}

export function parseIndustryInsightMarkdown(input: string): IndustryInsightImportResult {
  const drafts: IndustryInsightDraftField[] = [];
  const warnings: string[] = [];
  const lines = input.replace(/\r/g, "").split("\n");
  let section = "";
  let dimension: IndustryDimensionKey | undefined;
  let fieldPath: string | undefined;
  let buffer: string[] = [];
  let unrecognized: string[] = [];

  const flush = () => {
    const value = buffer.join("\n").trim();
    if (!value || !fieldPath) return;
    if (fieldByPath.has(fieldPath) || Boolean(formalPathAliases[fieldPath])) {
      drafts.push({ id: id(), fieldPath, value, status: "draft", sourceRefs: [], importedAt: new Date().toISOString() });
    }
    buffer = [];
  };

  const resolveFieldPath = (heading: string) => {
    const pathHeading = heading.match(/^([a-z]+(?:\.[A-Za-z_]+|\[\])+(?:\.[A-Za-z_]+)?)(?:（[^）]*）)?\s*[:：]?$/)?.[1];
    if (pathHeading && (fieldByPath.has(pathHeading) || formalPathAliases[pathHeading])) {
      return formalPathAliases[pathHeading] ?? pathHeading;
    }
    const alias = labelAliases[heading];
    const normalized = alias && dimension && ["fact", "judgment", "evidence", "tag"].includes(alias)
      ? `dimensions.${dimension}.${alias}`
      : alias;
    return normalized && fieldByPath.has(normalized)
      ? Object.entries(formalPathAliases).find(([, canonical]) => canonical === normalized)?.[0] ?? normalized
      : undefined;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(/^#{2,3}\s+(.+?)\s*$/)?.[1]?.trim();
    const pathLine = line.match(/^([a-z]+(?:\.[A-Za-z_]+|\[\])+(?:\.[A-Za-z_]+)?)(?:（[^）]*）)?\s*[:：]\s*$/)?.[1];
    if (!heading && pathLine) {
      flush();
      fieldPath = resolveFieldPath(line);
      if (!fieldPath) warnings.push(`未识别字段路径：${pathLine}`);
      continue;
    }
    if (heading) {
      flush();
      if (line.startsWith("## ")) {
        section = heading;
        dimension = dimensionLabels[heading];
        fieldPath = undefined;
        if (!sectionNames.has(section)) warnings.push(`未识别板块标题：${heading}`);
      } else {
        fieldPath = resolveFieldPath(heading);
        if (!fieldPath && !sectionNames.has(heading)) warnings.push(`未识别字段标题：${heading}`);
      }
      continue;
    }
    if (fieldPath) buffer.push(rawLine);
    else if (line) unrecognized.push(line);
  }
  flush();
  if (unrecognized.length > 0) warnings.push(`未识别内容：${unrecognized.slice(0, 3).join(" / ")}${unrecognized.length > 3 ? " …" : ""}`);
  return { drafts, warnings };
}

function setFormalField(project: IndustryInsightProject, fieldPath: string, value: string): IndustryInsightProject {
  const next = structuredClone(project);
  const parts = fieldPath.split(".");
  if (parts[0] === "purpose" && parts[1] in next) (next as unknown as Record<string, string>)[parts[1]] = value;
  else if (parts[0] === "boundary" && parts[1] in next.boundary) next.boundary[parts[1] as keyof typeof next.boundary] = value;
  else if (parts[0] === "dimensions" && parts[1] && parts[2]) {
    const dimension = next.dimensions.find((item) => item.key === parts[1]);
    if (dimension && parts[2] in dimension) (dimension as unknown as Record<string, string>)[parts[2]] = value;
  } else if (parts[0] === "stage" && parts[1] in next.stage) {
    if (parts[1] === "currentStage") next.stage.currentStage = value as IndustryStage;
    else if (parts[1] === "milestones") next.stage.milestones = value.split(/\n|、/).map((item) => item.trim()).filter(Boolean);
    else (next.stage as unknown as Record<string, string>)[parts[1]] = value;
  } else if (parts[0] === "conclusion" && parts[1] in next.conclusion) {
    if (parts[1] === "nextModule") next.conclusion.nextModule = value as IndustryInsightProject["conclusion"]["nextModule"];
    else (next.conclusion as unknown as Record<string, string>)[parts[1]] = value;
  }
  return next;
}

export function applyIndustryInsightDraft(project: IndustryInsightProject, draft: IndustryInsightDraftField): IndustryInsightProject {
  const canonicalPath = formalPathAliases[draft.fieldPath] ?? draft.fieldPath;
  if (!fieldByPath.has(canonicalPath) || !["accepted", "edited"].includes(draft.status)) return project;
  return setFormalField(project, canonicalPath, draft.status === "edited" ? draft.editedValue ?? draft.value : draft.value);
}

export type { IndustryEvidenceTag };
