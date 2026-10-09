// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InsightWorkspace } from "@/components/workbench/industry-insight/insight-workspace";
import { DocumentWorkspace } from "@/components/workbench/demand-exploration/document-workspace";
import { AnalysisWorkspace } from "@/components/workbench/competitor-analysis/analysis-workspace";
import { DecompositionWorkspace } from "@/components/workbench/product-decomposition/decomposition-workspace";
import { loadLocalWorkbenchData, saveLocalWorkbenchData } from "@/features/workbench/local-store";
import { whiteboardEvidenceFixture } from "../fixtures/whiteboard-evidence";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("React", React);
  // Only the remote transport is replaced; components, domain and local persistence are real.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: null }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("白板贴真实工作区引用链路", () => {
  it.each(["demand", "competitor"] as const)("首次确认行业实际字段 → %s → 产品拆解，保存重载保留两段来源", (middle) => {
    const fixture = whiteboardEvidenceFixture();
    saveLocalWorkbenchData(fixture.data);
    const first = render(<InsightWorkspace projectId={fixture.industry.id} />);
    expect(loadLocalWorkbenchData().evidenceReferences).toEqual([]);
    expect(screen.getByText("证据审核与引用")).toBeTruthy();
    expect(screen.getByRole("button", { name: "仅本项目使用：决策问题" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "确认并允许引用：决策问题" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认并允许引用：决策问题" }));
    expect(screen.getByText("可供引用的已确认资料")).toBeTruthy();
    first.unmount();

    const second = render(middle === "demand" ? <DocumentWorkspace documentId={fixture.demand.id} /> : <AnalysisWorkspace projectId={fixture.competitor.id} />);
    fireEvent.click(screen.getByRole("button", { name: "引用" }));
    expect((screen.getByLabelText("引用副本：决策问题") as HTMLTextAreaElement).value).toBe(fixture.record.problem);
    second.unmount();
    const firstReference = loadLocalWorkbenchData().evidenceReferences![0];
    expect(firstReference.sourceProjectId).toBe(fixture.industry.id);

    const third = render(<DecompositionWorkspace project={fixture.decomposition} />);
    fireEvent.click(screen.getByRole("button", { name: "引用" }));
    third.unmount();
    const saved = loadLocalWorkbenchData();
    expect(saved.evidenceReferences).toHaveLength(2);
    expect(saved.evidenceReferences![1]).toMatchObject({ sourceModule: middle === "demand" ? "demand-exploration" : "competitor-analysis", sourceProjectId: middle === "demand" ? fixture.demand.id : fixture.competitor.id, sourceFieldPath: `evidenceReferences.${firstReference.id}`, snapshot: fixture.record.problem, targetProjectId: fixture.decomposition.id });
    expect(saved.industryInsightProjects![0]).toEqual(fixture.industry);
    expect(saved.demandConfirmationDocuments![0]).toEqual(fixture.demand);
    expect(saved.competitorAnalysisProjects![0]).toEqual(fixture.competitor);
    expect(saved.productDecompositionProjects![0]).toEqual(fixture.decomposition);
    render(<DecompositionWorkspace project={saved.productDecompositionProjects![0]} />);
    expect(screen.getByText(new RegExp(`引用自：${middle === "demand" ? "需求探索" : "竞品分析"}`))).toBeTruthy();
    expect(screen.getAllByRole("textbox").some((element) => (element as HTMLTextAreaElement).value === fixture.record.problem)).toBe(true);
  });

  it("把行业洞察 AI 初稿审核明细收进证据审核与引用入口", () => {
    const fixture = whiteboardEvidenceFixture();
    fixture.industry.aiDrafts = [{ id: "draft-review", fieldPath: "purpose.decisionQuestion", value: "待审核的决策问题", status: "draft", sourceRefs: [], importedAt: "2026-09-18" }];
    fixture.data.industryInsightProjects![0].aiDrafts = fixture.industry.aiDrafts;
    saveLocalWorkbenchData(fixture.data);
    render(<InsightWorkspace projectId={fixture.industry.id} />);

    expect(screen.getByText("证据审核与引用")).toBeTruthy();
    expect(screen.getByText("AI 初稿审核")).toBeTruthy();
    expect(screen.getByText("研究目的 · 决策问题")).toBeTruthy();
    expect(screen.getByRole("button", { name: "采用" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "暂不采用" })).toBeTruthy();
  });

  it("待审核统计同时包含未处理的 AI 初稿", () => {
    const fixture = whiteboardEvidenceFixture();
    fixture.industry.aiDrafts = [{ id: "draft-pending-count", fieldPath: "purpose.decisionQuestion", value: "待审核的决策问题", status: "draft", sourceRefs: [], importedAt: "2026-09-18" }];
    fixture.data.industryInsightProjects![0].aiDrafts = fixture.industry.aiDrafts;
    saveLocalWorkbenchData(fixture.data);
    render(<InsightWorkspace projectId={fixture.industry.id} />);

    expect(screen.getByRole("button", { name: /^待审核 2$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "采用" }));
    expect(screen.getByRole("button", { name: /^待审核 1$/ })).toBeTruthy();
  });

  it("点击已确认统计后展示已确认资料明细", () => {
    const fixture = whiteboardEvidenceFixture();
    saveLocalWorkbenchData(fixture.data);
    render(<InsightWorkspace projectId={fixture.industry.id} />);

    fireEvent.click(screen.getByRole("button", { name: /已确认/ }));
    expect(screen.getByText("已确认资料")).toBeTruthy();
    expect(screen.getAllByText("决策问题").length).toBeGreaterThan(0);
  });

  it("保存研究前输入后显示已保存反馈", () => {
    const fixture = whiteboardEvidenceFixture();
    saveLocalWorkbenchData(fixture.data);
    render(<InsightWorkspace projectId={fixture.industry.id} />);

    fireEvent.change(screen.getByLabelText("已有资料"), { target: { value: "行业报告" } });
    fireEvent.click(screen.getByRole("button", { name: "保存研究前输入" }));
    expect(screen.getByRole("status").textContent).toContain("已保存研究前输入");
    expect(screen.getByText("已有研究前输入，AI 会继续将其作为研究约束。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "修改研究前输入" })).toBeTruthy();
  });

  it("外部 GPT 初稿逐字段采用后写入正式研究结论", () => {
    const fixture = whiteboardEvidenceFixture();
    fixture.demand.aiDrafts = [{ id: "demand-draft", importedAt: "2026-09-18", rawText: "### demand.problem\n事实：擦除后有痕迹", recognizedFields: { "demand.problem": "事实：擦除后有痕迹" }, unrecognizedLines: [], status: "draft" }];
    saveLocalWorkbenchData(fixture.data);
    render(<DocumentWorkspace documentId={fixture.demand.id} />);

    fireEvent.click(screen.getByRole("button", { name: /展开 AI 辅助/ }));
    fireEvent.click(screen.getByRole("button", { name: "采用写入正式字段" }));
    expect(loadLocalWorkbenchData().demandConfirmationDocuments![0].aiFindings?.["demand.problem"]).toBe("事实：擦除后有痕迹");
    expect(loadLocalWorkbenchData().demandConfirmationDocuments![0].aiDrafts![0].fieldDecisions?.["demand.problem"]?.decision).toBe("adopted");
  });

  it("待审核资料可以明确排除并在已排除视图留痕", () => {
    const fixture = whiteboardEvidenceFixture();
    saveLocalWorkbenchData(fixture.data);
    render(<InsightWorkspace projectId={fixture.industry.id} />);

    fireEvent.click(screen.getByRole("button", { name: "不采用并排除：决策问题" }));
    fireEvent.click(screen.getByRole("button", { name: /已排除/ }));
    expect(screen.getByText("已排除资料")).toBeTruthy();
    expect(screen.getAllByText("决策问题").length).toBeGreaterThan(0);
  });

  it("需求侧编辑引用副本后不再成为拆解的 confirmed 来源", () => {
    const fixture = whiteboardEvidenceFixture();
    saveLocalWorkbenchData(fixture.data);
    const first = render(<InsightWorkspace projectId={fixture.industry.id} />);
    fireEvent.click(screen.getByRole("button", { name: "确认并允许引用：决策问题" }));
    first.unmount();
    const second = render(<DocumentWorkspace documentId={fixture.demand.id} />);
    fireEvent.click(screen.getByRole("button", { name: "引用" }));
    fireEvent.change(screen.getByLabelText("引用副本：决策问题"), { target: { value: "目标新推断" } });
    second.unmount();
    expect(loadLocalWorkbenchData().evidenceReferences![0].status).toBe("edited");
    render(<DecompositionWorkspace project={fixture.decomposition} />);
    expect(screen.queryByRole("button", { name: "引用" })).toBeNull();
    expect(loadLocalWorkbenchData().industryInsightProjects![0].decisionQuestion).toBe(fixture.record.problem);
  });
});
