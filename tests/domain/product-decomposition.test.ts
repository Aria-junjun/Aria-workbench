import { describe, expect, it } from "vitest";
import {
  addProductDecompositionCause,
  addProductDecompositionSolution,
  buildProductDecompositionReport,
  createProductDecompositionProject,
  getProductDecompositionCompleteness,
} from "@/features/workbench/product-decomposition";

describe("product decomposition domain", () => {
  it("creates an unlinked project with five draft steps", () => {
    const project = createProductDecompositionProject({
      title: "白板贴重复使用体验拆解",
      targetUsers: "家庭办公用户",
      scenario: "会议结束后擦除并继续使用",
      centralQuestion: "怎样降低擦除残留对下一次书写的影响？",
      decisionGoal: "判断优先改善的产品能力",
    });

    expect(project.linkedProductId).toBeUndefined();
    expect(Object.values(project.steps)).toEqual(["draft", "draft", "draft", "draft", "draft"]);
    expect(getProductDecompositionCompleteness(project).complete).toBe(false);
  });

  it("keeps cause and solution relations explicit", () => {
    const project = createProductDecompositionProject({ title: "测试拆解", centralQuestion: "测试问题" });
    const withCause = addProductDecompositionCause(project, {
      title: "擦除行为",
      parentId: undefined,
      level: "major",
      fact: "用户需要在会议后擦除内容",
      judgment: "擦除体验影响重复使用",
      evidence: "用户反馈记录",
    });
    const causeId = withCause.causeNodes[0].id;
    const withSolution = addProductDecompositionSolution(withCause, {
      causeNodeId: causeId,
      title: "补充擦除效果验证",
      description: "用真实书写和擦除结果验证残留程度",
      kano: "unclassified",
      priority: 1,
    });

    expect(withSolution.solutions[0].causeNodeId).toBe(causeId);
    expect(withSolution.solutions[0].kano).toBe("unclassified");
  });

  it("supports multiple solutions for one cause and groups them in the report", () => {
    const project = createProductDecompositionProject({ title: "测试拆解", centralQuestion: "测试问题" });
    const withCause = addProductDecompositionCause(project, {
      title: "擦除后残留",
      parentId: undefined,
      level: "major",
      fact: "擦除后能看到之前写过的痕迹",
      judgment: "会影响下一次使用",
      evidence: "实际测试",
      gap: "还没有不同笔迹和擦除次数的对比",
    });
    const causeId = withCause.causeNodes[0].id;
    const first = addProductDecompositionSolution(withCause, {
      causeNodeId: causeId,
      title: "验证不同擦拭工具",
      description: "比较擦除效果",
      kano: "performance",
      priority: 1,
    });
    const second = addProductDecompositionSolution(first, {
      causeNodeId: causeId,
      title: "优化表面涂层",
      description: "验证材料改善方向",
      kano: "must_be",
      priority: 2,
    });

    const report = buildProductDecompositionReport(second);
    expect(second.solutions.filter((solution) => solution.causeNodeId === causeId)).toHaveLength(2);
    expect(report.sections.find((section) => section.key === "solutions")?.content).toContain("擦除后残留");
    expect(report.sections.find((section) => section.key === "solutions")?.content).toContain("验证不同擦拭工具");
    expect(report.sections.find((section) => section.key === "solutions")?.content).toContain("优化表面涂层");
    expect(report.sections.find((section) => section.key === "causes")?.content).toContain("信息缺口");
    expect(report.sections.find((section) => section.key === "causes")?.content).toContain("不同笔迹和擦除次数");
  });
});
