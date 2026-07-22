import OpenAI from "openai";
import { normalizeDecisionAnalysis, type DecisionAnalysis } from "./decision-analysis";
import type { ToolContribution } from "./decision-cases";

export type DecisionCycleAnalysisInput = {
  rawInput: string;
  initialJudgement?: string;
  toolContributions: ToolContribution[];
  currentActions: Array<{ action: string; sourceToolIds: string[] }>;
  previousCycleSummary?: string;
};

export function buildDecisionCyclePrompt(input: DecisionCycleAnalysisInput) {
  return `你是个人商业工作台的决策综合助手。现在不是第一次分析问题，而是根据用户已经完成的思考生成商业模式画布。

规则：
1. 综合当前周期全部工具分析、用户初步判断和行动。
2. 上一周期内容只作为历史参考，不得把上一周期结论当作当前事实。
3. 缺少证据的字段保持空白并提出问题，不得推测补全。
4. 保留用户原话和不同工具的有效差异，不要生成通用套话。
5. 输出简短：摘要不超过120字，待确认问题最多3个，下一步行动最多5个。
6. 输出 JSON：summary、initialJudgement、recommendedModelId、recommendationReason、modelSections、openQuestions、nextActions。
7. recommendedModelId 固定为 business-model-canvas。
8. modelSections 只使用以下9个 key：
customer-segments, value-propositions, channels, customer-relationships, revenue-streams,
key-resources, key-activities, key-partners, cost-structure。

当前周期资料：
${JSON.stringify(input)}`;
}

export async function analyzeDecisionCycle(input: DecisionCycleAnalysisInput): Promise<DecisionAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("未配置 OpenAI API Key，暂时无法生成商业模式画布。");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-4.1-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "你只输出符合要求的 JSON，不输出解释。" },
      { role: "user", content: buildDecisionCyclePrompt(input) }
    ]
  });
  const content = response.choices[0]?.message.content;
  if (!content) throw new Error("AI 未返回画布分析结果。");
  return normalizeDecisionAnalysis({
    ...JSON.parse(content),
    recommendedModelId: "business-model-canvas"
  });
}
