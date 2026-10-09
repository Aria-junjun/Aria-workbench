import { RESEARCH_INTEGRITY_RULES } from "./research-integrity";

export type AiTaskModule = "industry-insight" | "demand-exploration" | "competitor-analysis" | "product-decomposition";

export type AiTaskField = {
  path: string;
  label: string;
  guidance: string;
};

export type AiTaskPackage = {
  module: AiTaskModule;
  projectId: string;
  prompt: string;
  allowedFields: AiTaskField[];
};

export type AiTaskDraft = {
  id: string;
  importedAt: string;
  rawText: string;
  recognizedFields: Record<string, string>;
  unrecognizedLines: string[];
  status: "draft";
  fieldDecisions?: Record<string, AiTaskFieldDecisionRecord>;
};

export type AiTaskFieldDecision = "pending" | "adopted" | "edited" | "needs_verification" | "excluded";
export type AiTaskFieldDecisionRecord = { decision: AiTaskFieldDecision; value: string; reviewedAt: string; reason?: string };

export function applyAiTaskFieldDecision(draft: AiTaskDraft, path: string, decision: AiTaskFieldDecision, value = draft.recognizedFields[path], reason?: string): AiTaskDraft {
  if (!(path in draft.recognizedFields)) return draft;
  return {
    ...draft,
    fieldDecisions: {
      ...(draft.fieldDecisions ?? {}),
      [path]: { decision, value, reviewedAt: new Date().toISOString(), ...(reason ? { reason } : {}) },
    },
  };
}

export function createAiTaskDraftRevision(draft: AiTaskDraft, recognizedFields: Record<string, string>): AiTaskDraft {
  return {
    ...draft,
    id: `ai-draft-${crypto.randomUUID()}`,
    importedAt: new Date().toISOString(),
    recognizedFields: { ...recognizedFields },
  };
}

const moduleLabels: Record<AiTaskModule, string> = {
  "industry-insight": "行业洞察",
  "demand-exploration": "需求探索",
  "competitor-analysis": "竞品分析",
  "product-decomposition": "产品拆解",
};

export function buildAiTaskPackage(input: {
  module: AiTaskModule;
  projectId: string;
  title: string;
  context: string;
  fields: AiTaskField[];
  referencedEvidence?: string;
}): AiTaskPackage {
  const uniqueFields = input.fields.filter((field, index, fields) => fields.findIndex((item) => item.path === field.path) === index);
  const fieldLines = uniqueFields.map((field) => `- ${field.path}（${field.label}）：${field.guidance}`).join("\n");
  const prompt = [
    "你是产品经理研究助手。只根据用户提供的材料和可核验公开资料输出 Markdown。",
    `模块：${moduleLabels[input.module]}`,
    `项目 ID：${input.projectId}`,
    `项目名称：${input.title || "未命名项目"}`,
    "",
    "研究上下文：",
    input.context || "未提供研究上下文。",
    ...(input.referencedEvidence ? ["", input.referencedEvidence] : []),
    "",
    "只能输出以下字段，不得创建其他字段：",
    fieldLines || "- 暂无字段",
    "",
    "统一要求：每条内容标注事实 / 推断 / 待验证；证据写明来源板块、来源名称、时间和口径。不得编造来源、样本、销量或用户原话。找不到资料时明确写‘未找到’。不得替用户做最终商业化、采购或入仓决策。",
    RESEARCH_INTEGRITY_RULES,
    "请按字段逐项输出，内容不足的字段保留并写‘未找到’。",
  ].join("\n");
  return { module: input.module, projectId: input.projectId, prompt, allowedFields: uniqueFields };
}

export function parseAiTaskDraft(text: string, task: AiTaskPackage): AiTaskDraft {
  const allowed = new Set(task.allowedFields.map((field) => field.path));
  const recognizedFields: Record<string, string> = {};
  const unrecognizedLines: string[] = [];
  let currentPath: string | undefined;
  let currentContent: string[] = [];

  const flush = () => {
    if (currentPath) {
      recognizedFields[currentPath] = currentContent.join("\n").trim();
    }
    currentPath = undefined;
    currentContent = [];
  };

  const findFieldHeading = (line: string) => {
    for (const path of allowed) {
      const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = line.match(new RegExp(`^#{0,6}\\s*${escapedPath}(?:\\s*(?:（[^）]*）|\\([^)]*\\)))?\\s*(?:[：:]\\s*(.*))?$`));
      if (match) return { path, inlineContent: match[1]?.trim() ?? "" };
    }
    return undefined;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = findFieldHeading(line);
    if (heading) {
      flush();
      currentPath = heading.path;
      if (heading.inlineContent) currentContent.push(heading.inlineContent);
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      flush();
      unrecognizedLines.push(line);
      continue;
    }
    if (currentPath && /^(?:[-*]\s*)?[A-Za-z][\w.-]*\s*[：:]/.test(line)) {
      flush();
      unrecognizedLines.push(line);
      continue;
    }
    if (currentPath) currentContent.push(line);
    else unrecognizedLines.push(line);
  }
  flush();
  return { id: `ai-draft-${crypto.randomUUID()}`, importedAt: new Date().toISOString(), rawText: text, recognizedFields, unrecognizedLines, status: "draft" };
}
