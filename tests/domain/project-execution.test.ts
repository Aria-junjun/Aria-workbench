import { describe, expect, it } from "vitest";
import { addProjectExecutionRisk, addProjectExecutionTask, createProjectExecutionProject, getProjectExecutionCompleteness } from "@/features/workbench/project-execution";

describe("project execution domain", () => {
  it("creates a five-step project and keeps execution records structured", () => {
    const project = createProjectExecutionProject({ title: "白板贴擦除体验验证", objective: "验证不同笔迹与擦拭工具的效果" });
    const withTask = addProjectExecutionTask(project, { title: "完成擦除测试", deliverable: "测试记录", owner: "产品", status: "not_started" });
    const withRisk = addProjectExecutionRisk(withTask, { title: "测试样本不足", probability: "medium", impact: "high", mitigation: "补充真实使用场景" });
    expect(Object.values(project.steps)).toHaveLength(5);
    expect(withRisk.tasks[0].title).toBe("完成擦除测试");
    expect(withRisk.risks[0].impact).toBe("high");
    expect(getProjectExecutionCompleteness(withRisk).filled).toBeGreaterThan(0);
  });
});
