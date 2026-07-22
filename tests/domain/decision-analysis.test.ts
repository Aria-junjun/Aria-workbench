import { describe, expect, it } from "vitest";
import {
  BUSINESS_MODEL_CANVAS,
  DecisionAnalysisSchema,
  normalizeDecisionAnalysis
} from "@/features/workbench/decision-analysis";

describe("decision analysis", () => {
  it("allows analysis without recommending a model", () => {
    const result = DecisionAnalysisSchema.parse({
      summary: "先核实需求，再决定是否行动。",
      modelSections: [],
      openQuestions: [],
      nextActions: ["确认近30天销量"]
    });

    expect(result.recommendedModelId).toBeUndefined();
  });

  it("rejects unknown model ids", () => {
    expect(() => DecisionAnalysisSchema.parse({
      summary: "测试",
      recommendedModelId: "unknown-model",
      modelSections: [],
      openQuestions: [],
      nextActions: []
    })).toThrow();
  });

  it("caps material questions at three and drops unknown sections", () => {
    const result = normalizeDecisionAnalysis({
      summary: "测试",
      recommendedModelId: "business-model-canvas",
      modelSections: [
        { key: "customer-segments", label: "错误标签", value: "家庭用户", placeholder: "错误提示" },
        { key: "unknown", label: "未知", value: "不应保留", placeholder: "" }
      ],
      openQuestions: ["问题1", "问题2", "问题3", "问题4"],
      nextActions: []
    });

    expect(result.openQuestions).toEqual(["问题1", "问题2", "问题3"]);
    expect(result.modelSections).toHaveLength(9);
    expect(result.modelSections[0]).toMatchObject({
      key: "customer-segments",
      label: "客户细分",
      value: "家庭用户"
    });
    expect(result.modelSections.some((section) => section.key === "unknown")).toBe(false);
  });

  it("defines nine canvas sections with Chinese guidance", () => {
    expect(BUSINESS_MODEL_CANVAS.sections).toHaveLength(9);
    expect(BUSINESS_MODEL_CANVAS.sections.every((section) => /[\u4e00-\u9fff]/.test(section.placeholder))).toBe(true);
  });
});
