import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("外部 GPT 任务包面板", () => {
  it("明确任务包只生成草稿，不直接覆盖正式记录", () => {
    const panel = readFileSync("src/components/workbench/external-ai-task-panel.tsx", "utf8");
    expect(panel).toContain("外部 GPT 任务包");
    expect(panel).toContain("复制任务包");
    expect(panel).toContain("不会直接覆盖正式记录");
    expect(panel).toContain("确认保存 AI 初稿");
    expect(panel).toContain("task.allowedFields.find");
    expect(panel).toContain(">修改</button>");
    expect(panel).toContain(">保存修改</button>");
  });
});
