import { describe, expect, it } from "vitest";
import { buildDecisionCyclePrompt } from "@/features/workbench/decision-analysis-ai";

describe("decision analysis prompt", () => {
  it("synthesizes the current cycle without treating history as fact", () => {
    const prompt = buildDecisionCyclePrompt({
      rawInput: "判断新品是否进入",
      initialJudgement: "先小批量测试",
      toolContributions: [],
      currentActions: [],
      previousCycleSummary: "上次决定暂缓"
    });

    expect(prompt).toContain("综合当前周期全部工具分析");
    expect(prompt).toContain("不得把上一周期结论当作当前事实");
    expect(prompt).toContain("不得推测补全");
  });

  it("bounds output and preserves the user's wording", () => {
    const prompt = buildDecisionCyclePrompt({
      rawInput: "原始判断：先小批量测试",
      toolContributions: [],
      currentActions: []
    });

    expect(prompt).toContain("最多3个");
    expect(prompt).toContain("保留用户原话");
    expect(prompt).toContain("简短");
    expect(prompt).toContain("原始判断：先小批量测试");
  });
});
