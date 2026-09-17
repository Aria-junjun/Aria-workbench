import { describe, expect, it } from "vitest";
import { buildAiTaskPackage, parseAiTaskDraft, type AiTaskField } from "@/features/workbench/ai-task-protocol";

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

  it("只识别当前任务包声明的字段，其余内容保留为未识别", () => {
    const task = buildAiTaskPackage({ module: "competitor-analysis", projectId: "project-1", title: "竞品", context: "白板贴", fields: [{ path: "summary", label: "分析结论", guidance: "" }] });
    const draft = parseAiTaskDraft("summary：竞品主要解决擦除问题\nunknown.field：不应进入正式字段", task);
    expect(draft.recognizedFields.summary).toBe("竞品主要解决擦除问题");
    expect(draft.unrecognizedLines).toContain("unknown.field：不应进入正式字段");
  });
});
