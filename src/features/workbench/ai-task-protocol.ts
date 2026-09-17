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
    "",
    "只能输出以下字段，不得创建其他字段：",
    fieldLines || "- 暂无字段",
    "",
    "统一要求：每条内容标注事实 / 推断 / 待验证；证据写明来源板块、来源名称、时间和口径。不得编造来源、样本、销量或用户原话。找不到资料时明确写‘未找到’。不得替用户做最终商业化、采购或入仓决策。",
    "请按字段逐项输出，内容不足的字段保留并写‘未找到’。",
  ].join("\n");
  return { module: input.module, projectId: input.projectId, prompt, allowedFields: uniqueFields };
}
