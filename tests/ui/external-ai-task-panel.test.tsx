// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemandConfirmationDocument } from "@/features/workbench/demand-confirmation";
import { createCompetitorAnalysisProject } from "@/features/workbench/competitor-analysis";
import { createProductDecompositionProject } from "@/features/workbench/product-decomposition";
import {
  loadCompetitorAnalysisProjects,
  loadDemandConfirmationDocuments,
  loadProductDecompositionProjects,
  saveCompetitorAnalysisProject,
  saveDemandConfirmationDocument,
  saveProductDecompositionProject,
} from "@/features/workbench/local-store";
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

function withoutAiDrafts<T extends { aiDrafts?: AiTaskDraft[] }>(record: T) {
  const { aiDrafts: _aiDrafts, ...formalFields } = record;
  return JSON.parse(JSON.stringify(formalFields));
}

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
    expect(screen.getAllByText((_, element) => element?.tagName === "PRE" && element.textContent === "summary：原始结论\nunknown.field：保留")).toHaveLength(2);
    expect(screen.getAllByText("未识别内容：unknown.field：保留")).toHaveLength(2);
    expect(persistedDrafts.every((draft) => draft.rawText.includes("unknown.field：保留"))).toBe(true);
    expect(persistedDrafts.every((draft) => draft.unrecognizedLines.includes("unknown.field：保留"))).toBe(true);
  });

  it("通过三个工作区的本地保存和重新读取保留 AI 初稿且不覆盖正式字段", () => {
    window.localStorage.clear();
    const draft: AiTaskDraft = {
      id: "ai-draft-persistence",
      importedAt: "2026-09-17T00:00:00.000Z",
      rawText: "summary：AI 初稿结论\nunknown.field：需人工核验",
      recognizedFields: { summary: "AI 初稿结论" },
      unrecognizedLines: ["unknown.field：需人工核验"],
      status: "draft",
    };
    const demand = createDemandConfirmationDocument({ title: "需求正式标题", productName: "需求正式产品", userType: "正式用户", scenario: "正式场景", problem: "正式问题", goal: "正式目标" });
    const competitor = createCompetitorAnalysisProject({ title: "竞品正式标题", productName: "竞品正式产品", targetUsers: "正式用户", analysisTheme: "正式主题", decisionQuestion: "正式问题", expectedAction: "正式行动", productStage: "正式阶段" });
    const decomposition = createProductDecompositionProject({ title: "拆解正式标题", targetUsers: "正式用户", scenario: "正式场景", centralQuestion: "正式中心问题", decisionGoal: "正式目标" });

    saveDemandConfirmationDocument({ ...demand, aiDrafts: [draft] });
    saveCompetitorAnalysisProject({ ...competitor, aiDrafts: [draft] });
    saveProductDecompositionProject({ ...decomposition, aiDrafts: [draft] });

    const reloadedDemand = loadDemandConfirmationDocuments().find((item) => item.id === demand.id);
    const reloadedCompetitor = loadCompetitorAnalysisProjects().find((item) => item.id === competitor.id);
    const reloadedDecomposition = loadProductDecompositionProjects().find((item) => item.id === decomposition.id);

    expect(reloadedDemand).toBeDefined();
    expect(reloadedCompetitor).toBeDefined();
    expect(reloadedDecomposition).toBeDefined();
    expect(withoutAiDrafts(reloadedDemand!)).toEqual(withoutAiDrafts(demand));
    expect(withoutAiDrafts(reloadedCompetitor!)).toEqual(withoutAiDrafts(competitor));
    expect(withoutAiDrafts(reloadedDecomposition!)).toEqual(withoutAiDrafts(decomposition));
    expect(reloadedDemand!.aiDrafts).toEqual([draft]);
    expect(reloadedCompetitor!.aiDrafts).toEqual([draft]);
    expect(reloadedDecomposition!.aiDrafts).toEqual([draft]);
  });
});
