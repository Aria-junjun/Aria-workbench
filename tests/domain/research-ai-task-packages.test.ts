import { describe, expect, it } from "vitest";
import {
  buildCompetitorAnalysisTaskPackage,
  buildDemandExplorationTaskPackage,
  buildProductDecompositionTaskPackage,
} from "@/features/workbench/research-ai-task-packages";

describe("研究模块 AI 任务包", () => {
  it("需求探索任务包只要求需求证据和样本边界", () => {
    const task = buildDemandExplorationTaskPackage({ projectId: "demand-1", title: "白板贴需求", productName: "白板贴", userType: "家庭办公", scenario: "居家学习", problem: "擦除后留痕" });
    expect(task.module).toBe("demand-exploration");
    expect(task.prompt).toContain("需求真实性");
    expect(task.prompt).toContain("样本限制");
    expect(task.prompt).not.toContain("五层拆解");
  });

  it("竞品分析任务包包含竞品边界和证据要求", () => {
    const task = buildCompetitorAnalysisTaskPackage({ projectId: "competitor-1", title: "白板贴竞品", productName: "白板贴", targetUsers: "家庭办公", analysisTheme: "擦除体验", decisionQuestion: "哪些替代方案值得比较" });
    expect(task.module).toBe("competitor-analysis");
    expect(task.prompt).toContain("竞品边界");
    expect(task.prompt).toContain("直接竞品、替代方案、参考产品");
    expect(task.prompt).not.toContain("KANO");
  });

  it("产品拆解任务包要求原因、方案和验证动作引用已有上下文", () => {
    const task = buildProductDecompositionTaskPackage({ projectId: "decomposition-1", title: "白板贴拆解", targetUsers: "家庭办公", scenario: "居家学习", centralQuestion: "为什么擦除后留痕", decisionGoal: "找到可验证的改进方向" });
    expect(task.module).toBe("product-decomposition");
    expect(task.prompt).toContain("原因拆解");
    expect(task.prompt).toContain("方案与优先级");
    expect(task.prompt).toContain("行动计划");
    expect(task.prompt).toContain("不得把方案假设写成已验证需求");
  });

  it("只把已确认的目标项目引用注入下一个 GPT 任务包", () => {
    const task = buildDemandExplorationTaskPackage({ projectId: "demand-1", title: "白板贴需求", productName: "白板贴", userType: "家庭办公", scenario: "居家学习", problem: "擦除后留痕", referencedEvidence: "来源板块：行业洞察\n项目：白板贴行业洞察\n字段：决策问题\n内容：验证留痕原因" });
    expect(task.prompt).toContain("验证留痕原因");
  });
});
