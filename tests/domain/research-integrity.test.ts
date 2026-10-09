import { expect, it } from "vitest";
import { buildAiTaskPackage } from "@/features/workbench/ai-task-protocol";
import { buildIndustryInsightResearchPrompt } from "@/features/workbench/industry-insight-bridge";
import { createIndustryInsightProject } from "@/features/workbench/industry-insight";
import { buildDemandExplorationTaskPackage } from "@/features/workbench/research-ai-task-packages";

it("四类任务包含真实数据、查询边界、反证和验证标准，不虚构经营结果", () => {
  const prompts = [
    buildIndustryInsightResearchPrompt(createIndustryInsightProject({ title: "测试" })),
    ...(["demand-exploration", "competitor-analysis", "product-decomposition"] as const).map(module => buildAiTaskPackage({ module, projectId: "test", title: "测试", context: "数据缺失", fields: [] }).prompt),
  ];
  for (const prompt of prompts) {
    expect(prompt).toContain("缺失不等于0");
    expect(prompt).toContain("没有实际检索或未读到原文");
    expect(prompt).toContain("目前无法判断");
    expect(prompt).toContain("推翻各假设");
    expect(prompt).toContain("判定标准");
    expect(prompt).toContain("不表示事实已经证实");
  }
});

it("无真实问卷不得生成KANO分类或满意度系数", () => {
  const task = buildDemandExplorationTaskPackage({ projectId: "test", title: "测试", productName: "测试产品", userType: "", scenario: "", problem: "销售下降" });
  expect(task.prompt).toContain("不输出属性分类、SI或DSI");
  expect(task.prompt).toContain("KANO不是必经步骤");
});
