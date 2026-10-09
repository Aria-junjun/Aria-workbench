import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("industry insight external GPT bridge UI", () => {
  it("exposes a bridge panel with copy, import, review, and warning states", () => {
    const panel = readFileSync("src/components/workbench/industry-insight/insight-bridge-panel.tsx", "utf8");
    const workspace = readFileSync("src/components/workbench/industry-insight/insight-workspace.tsx", "utf8");

    expect(panel).toContain("复制外部 GPT 任务包");
    expect(panel).toContain("导入 AI 初稿");
    expect(panel).toContain("AI 初稿不会直接写入正式记录");
    expect(panel).toContain("识别失败内容");
    expect(panel).toContain("parseIndustryInsightMarkdown");
    expect(panel).toContain("buildIndustryInsightResearchPrompt");
    expect(panel).toContain("展开 AI 辅助");
    expect(panel).toContain("aria-expanded={open}");
    expect(panel).toContain("{open &&");
    expect(workspace).toContain("InsightBridgePanel");
  });

  it("exposes four review actions and applies only accepted or edited drafts", () => {
    const panel = readFileSync("src/components/workbench/workbench-evidence-panel.tsx", "utf8");
    const workspace = readFileSync("src/components/workbench/industry-insight/insight-workspace.tsx", "utf8");

    expect(panel).toContain("aiDrafts");
    expect(panel).toContain("AI 初稿审核");
    expect(panel).toContain("采用");
    expect(panel).toContain("修改后采用");
    expect(panel).toContain("待验证");
    expect(panel).toContain("暂不采用");
    expect(panel).toContain("editedValue");
    expect(workspace).toContain("applyIndustryInsightDraft");
    expect(panel).toContain("accepted");
    expect(panel).toContain("needs_verification");
    expect(panel).toContain("rejected");
    expect(panel).toContain("aria-expanded");
    expect(panel).not.toContain("open={pendingCount > 0}");
  });

  it("shows the review count while keeping the formal report read-only", () => {
    const report = readFileSync("src/components/workbench/industry-insight/insight-report.tsx", "utf8");
    expect(report).toContain("未审核");
    expect(report).toContain("needs_verification");
    expect(report).toContain("正式报告只读取已确认字段");
  });
});
