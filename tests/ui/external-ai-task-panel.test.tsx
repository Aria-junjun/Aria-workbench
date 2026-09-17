// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AiTaskDraft } from "@/features/workbench/ai-task-protocol";
import { ExternalAiTaskPanel } from "@/components/workbench/external-ai-task-panel";

type Props = Parameters<typeof ExternalAiTaskPanel>[0];

const task: Props["task"] = {
  module: "competitor-analysis",
  projectId: "project-1",
  prompt: "任务包",
  allowedFields: [{ path: "summary", label: "分析结论", guidance: "" }],
};

afterEach(cleanup);

describe("外部 GPT 任务包面板", () => {
  it("通过真实 DOM 事件保存独立编辑稿和确认稿，并在重载后恢复历史", () => {
    const persistedDrafts: AiTaskDraft[] = [];
    const formalRecord = { summary: "正式结论" };
    const saveDraft = (draft: AiTaskDraft) => {
      persistedDrafts.push(JSON.parse(JSON.stringify(draft)) as AiTaskDraft);
    };
    const { unmount } = render(<ExternalAiTaskPanel task={task} onSaveDraft={saveDraft} savedDrafts={[]} />);

    fireEvent.change(screen.getByLabelText("AI 初稿导入内容"), {
      target: { value: "summary：原始结论\nunknown.field：保留" },
    });
    fireEvent.click(screen.getByRole("button", { name: "导入识别" }));
    expect(screen.getByText("原始 AI 初稿")).toBeTruthy();
    expect(screen.getByText("未识别内容：unknown.field：保留")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "修改" }));
    fireEvent.change(screen.getByLabelText("修改分析结论"), { target: { value: "人工修改结论" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    expect(persistedDrafts).toHaveLength(1);
    expect(persistedDrafts[0]).toMatchObject({
      recognizedFields: { summary: "人工修改结论" },
      rawText: "summary：原始结论\nunknown.field：保留",
      unrecognizedLines: ["unknown.field：保留"],
    });

    fireEvent.click(screen.getByRole("button", { name: "确认保存 AI 初稿" }));
    expect(persistedDrafts).toHaveLength(2);
    expect(persistedDrafts[0].id).not.toBe(persistedDrafts[1].id);
    expect(formalRecord).toEqual({ summary: "正式结论" });

    unmount();
    render(<ExternalAiTaskPanel task={task} onSaveDraft={saveDraft} savedDrafts={persistedDrafts} />);

    expect(screen.getByText("历史 AI 初稿（2）")).toBeTruthy();
    expect(screen.getAllByText("人工修改结论")).toHaveLength(2);
    expect(persistedDrafts.every((draft) => draft.rawText.includes("unknown.field：保留"))).toBe(true);
    expect(persistedDrafts.every((draft) => draft.unrecognizedLines.includes("unknown.field：保留"))).toBe(true);
  });
});
