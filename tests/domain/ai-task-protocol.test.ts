import { describe, expect, it } from "vitest";
import { applyAiTaskFieldDecision, buildAiTaskPackage, parseAiTaskDraft, type AiTaskField } from "@/features/workbench/ai-task-protocol";
import { buildCompetitorAnalysisTaskPackage, buildProductDecompositionTaskPackage } from "@/features/workbench/research-ai-task-packages";

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

  it("兼容任务包要求的 Markdown 字段标题和多行内容", () => {
    const task = buildAiTaskPackage({ module: "demand-exploration", projectId: "project-1", title: "需求", context: "白板贴", fields: [{ path: "demand.problem", label: "需求问题", guidance: "" }] });
    const draft = parseAiTaskDraft("### demand.problem（需求探索 / 问题）：\n事实：用户反馈擦除后有痕迹。\n推断：问题可能影响复购。\n\n### unknown.field（其他）：\n不应进入正式字段。", task);
    expect(draft.recognizedFields["demand.problem"]).toContain("事实：用户反馈擦除后有痕迹。");
    expect(draft.recognizedFields["demand.problem"]).toContain("推断：问题可能影响复购。");
    expect(draft.unrecognizedLines.join("\n")).toContain("### unknown.field（其他）：");
  });

  it("竞品分析和产品拆解也使用同一套标题识别规则", () => {
    const competitorTask = buildCompetitorAnalysisTaskPackage({ projectId: "c-1", title: "竞品", productName: "白板贴", targetUsers: "家庭用户", analysisTheme: "擦除", decisionQuestion: "比较什么" });
    const decompositionTask = buildProductDecompositionTaskPackage({ projectId: "d-1", title: "拆解", targetUsers: "家庭用户", scenario: "书写", centralQuestion: "为什么", decisionGoal: "怎么改" });
    expect(parseAiTaskDraft("### competitor.boundary（竞品边界）：\n直接竞品：传统白板", competitorTask).recognizedFields["competitor.boundary"]).toContain("直接竞品");
    expect(parseAiTaskDraft("### decomposition.causes（原因拆解）：\n事实：擦除后有痕迹", decompositionTask).recognizedFields["decomposition.causes"]).toContain("擦除后有痕迹");
  });

  it("逐字段采用会保留原稿并记录正式字段候选状态", () => {
    const task = buildAiTaskPackage({ module: "demand-exploration", projectId: "project-1", title: "需求", context: "白板贴", fields: [{ path: "demand.problem", label: "需求问题", guidance: "" }] });
    const draft = parseAiTaskDraft("### demand.problem\n事实：擦除后有痕迹", task);
    const reviewed = applyAiTaskFieldDecision(draft, "demand.problem", "adopted");

    expect(reviewed.rawText).toBe(draft.rawText);
    expect(reviewed.fieldDecisions?.["demand.problem"]).toMatchObject({ decision: "adopted", value: draft.recognizedFields["demand.problem"] });
    expect(draft.fieldDecisions).toBeUndefined();
  });
});
