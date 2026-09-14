import { describe, expect, it } from "vitest";
import {
  addProductDecompositionCause,
  addProductDecompositionSolution,
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
});
