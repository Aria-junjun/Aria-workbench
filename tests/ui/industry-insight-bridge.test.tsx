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
    expect(panel).toContain("saveIndustryInsightProject");
    expect(workspace).toContain("InsightBridgePanel");
  });

  it("keeps imported content in drafts and warnings without applying formal fields", () => {
    const panel = readFileSync("src/components/workbench/industry-insight/insight-bridge-panel.tsx", "utf8");

    expect(panel).toContain("aiDrafts");
    expect(panel).toContain("warnings");
    expect(panel).toContain("status: \"draft\"");
    expect(panel).not.toContain("applyIndustryInsightDraft");
  });
});
