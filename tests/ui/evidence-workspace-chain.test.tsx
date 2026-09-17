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
    fireEvent.click(screen.getByRole("button", { name: "确认来源：决策问题" }));
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

  it("需求侧编辑引用副本后不再成为拆解的 confirmed 来源", () => {
    const fixture = whiteboardEvidenceFixture();
    saveLocalWorkbenchData(fixture.data);
    const first = render(<InsightWorkspace projectId={fixture.industry.id} />);
    fireEvent.click(screen.getByRole("button", { name: "确认来源：决策问题" }));
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
