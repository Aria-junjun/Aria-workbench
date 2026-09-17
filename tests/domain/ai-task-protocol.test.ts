import { describe, expect, it } from "vitest";
import { buildAiTaskPackage, type AiTaskField } from "@/features/workbench/ai-task-protocol";

describe("统一 AI 任务协议", () => {
  it("生成包含上下文、统一字段和证据边界的中文任务包", () => {
    const fields: AiTaskField[] = [
      { path: "summary", label: "分析结论", guidance: "只写当前材料支持的结论" },
      { path: "evidence", label: "证据", guidance: "标明来源和时间" },
    ];
    const task = buildAiTaskPackage({
      module: "competitor-analysis",
      projectId: "project-1",
      title: "白板贴竞品分析",
      context: "研究对象：白板贴\n目标用户：家庭办公用户",
      fields,
    });

    expect(task.module).toBe("competitor-analysis");
    expect(task.prompt).toContain("模块：竞品分析");
    expect(task.prompt).toContain("项目 ID：project-1");
    expect(task.prompt).toContain("研究对象：白板贴");
    expect(task.prompt).toContain("分析结论");
    expect(task.prompt).toContain("不得编造来源、样本、销量或用户原话");
    expect(task.prompt).toContain("事实 / 推断 / 待验证");
  });
});
