import { z } from "zod";

export const DecisionModelIdSchema = z.literal("business-model-canvas");

export const DecisionModelSectionSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  value: z.string().trim().default(""),
  placeholder: z.string().trim().default("")
});

export const DecisionAnalysisSchema = z.object({
  summary: z.string().trim().min(1),
  initialJudgement: z.string().trim().optional(),
  recommendedModelId: DecisionModelIdSchema.optional(),
  recommendationReason: z.string().trim().optional(),
  modelSections: z.array(DecisionModelSectionSchema).default([]),
  openQuestions: z.array(z.string().trim().min(1)).default([]),
  nextActions: z.array(z.string().trim().min(1)).default([])
});

export type DecisionAnalysis = z.infer<typeof DecisionAnalysisSchema>;
export type DecisionModelSection = z.infer<typeof DecisionModelSectionSchema>;

export type DecisionModelDefinition = {
  id: z.infer<typeof DecisionModelIdSchema>;
  name: string;
  sections: Array<Omit<DecisionModelSection, "value">>;
};

export const BUSINESS_MODEL_CANVAS: DecisionModelDefinition = {
  id: "business-model-canvas",
  name: "商业模式画布",
  sections: [
    { key: "customer-segments", label: "客户细分", placeholder: "例如：有学龄儿童、重视家庭计划管理的家长" },
    { key: "value-propositions", label: "价值主张", placeholder: "例如：比普通白板贴更美观、可重复书写并能固定在冰箱上" },
    { key: "channels", label: "渠道通路", placeholder: "例如：天猫、拼多多、抖音内容种草和直播" },
    { key: "customer-relationships", label: "客户关系", placeholder: "例如：说明书引导、使用内容、售后答疑和复购提醒" },
    { key: "revenue-streams", label: "收入来源", placeholder: "例如：单品销售、套装加购、定制款溢价" },
    { key: "key-resources", label: "核心资源", placeholder: "例如：稳定货源、原创视觉、产品测试数据和品牌内容" },
    { key: "key-activities", label: "关键业务", placeholder: "例如：选品打样、内容制作、投放测试和供应链管理" },
    { key: "key-partners", label: "重要伙伴", placeholder: "例如：板材工厂、印刷厂、包装厂和仓配服务商" },
    { key: "cost-structure", label: "成本结构", placeholder: "例如：产品、包装、运费、平台佣金、投放和售后损耗" }
  ]
};

export function normalizeDecisionAnalysis(value: unknown): DecisionAnalysis {
  const parsed = DecisionAnalysisSchema.parse(value);
  const questions = [...new Set(parsed.openQuestions.map((item) => item.trim()).filter(Boolean))].slice(0, 3);
  const actions = [...new Set(parsed.nextActions.map((item) => item.trim()).filter(Boolean))];

  if (parsed.recommendedModelId !== BUSINESS_MODEL_CANVAS.id) {
    return { ...parsed, modelSections: [], openQuestions: questions, nextActions: actions };
  }

  const values = new Map(parsed.modelSections.map((section) => [section.key, section.value]));
  return {
    ...parsed,
    modelSections: BUSINESS_MODEL_CANVAS.sections.map((section) => ({
      ...section,
      value: values.get(section.key)?.trim() ?? ""
    })),
    openQuestions: questions,
    nextActions: actions
  };
}
