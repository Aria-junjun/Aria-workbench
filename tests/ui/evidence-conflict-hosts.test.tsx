// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InsightReport } from "@/components/workbench/industry-insight/insight-report";
import { ReportPreview } from "@/components/workbench/competitor-analysis/report-preview";
import { DecompositionReport } from "@/components/workbench/product-decomposition/decomposition-report";
import { DocumentWorkspace } from "@/components/workbench/demand-exploration/document-workspace";
import { createIndustryInsightProject } from "@/features/workbench/industry-insight";
import { createWhiteboardCompetitorAnalysisProject } from "@/features/workbench/competitor-analysis";
import { createProductDecompositionProject } from "@/features/workbench/product-decomposition";
import { createDemandConfirmationDocument } from "@/features/workbench/demand-confirmation";
import { createEvidenceReference } from "@/features/workbench/evidence-references";
import { loadLocalWorkbenchData, saveLocalWorkbenchData } from "@/features/workbench/local-store";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: null }) }));
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function saveReference(targetModule: "industry-insight" | "demand-exploration" | "competitor-analysis" | "product-decomposition", targetProjectId: string, sourceProjectTitle: string) {
  const data = loadLocalWorkbenchData();
  saveLocalWorkbenchData({
    ...data,
    evidenceReferences: [createEvidenceReference({
      targetModule,
      targetProjectId,
      targetFieldPath: "evidenceReferences",
      targetFieldLabel: "引用证据",
      sourceModule: "industry-insight",
      sourceProjectId: "industry-source",
      sourceProjectTitle,
      sourceFieldPath: "decisionQuestion",
      sourceFieldLabel: "决策问题",
      snapshot: "事实：需验证擦除表现。",
      status: "confirmed",
    })],
  });
}

describe("报告宿主中的证据状态集成", () => {
  it("在行业洞察报告中显示该项目的来源状态", () => {
    const project = createIndustryInsightProject({ title: "行业项目" });
    saveReference("industry-insight", project.id, "行业来源");

    render(<InsightReport project={project} />);

    expect(screen.getByLabelText("证据状态与冲突")).toBeTruthy();
    expect(screen.getByText(/行业来源/)).toBeTruthy();
  });

  it("在竞品分析报告中显示该项目的来源状态", () => {
    const project = createWhiteboardCompetitorAnalysisProject({ title: "竞品项目", targetUsers: "用户", analysisTheme: "主题", decisionQuestion: "问题", expectedAction: "行动", productStage: "验证" });
    saveReference("competitor-analysis", project.id, "竞品来源");

    render(<ReportPreview project={project} />);

    expect(screen.getByLabelText("证据状态与冲突")).toBeTruthy();
    expect(screen.getByText(/竞品来源/)).toBeTruthy();
  });

  it("在产品拆解报告中显示该项目的来源状态", () => {
    const project = createProductDecompositionProject({ title: "拆解项目", centralQuestion: "问题" });
    saveReference("product-decomposition", project.id, "拆解来源");

    render(<DecompositionReport project={project} />);

    expect(screen.getByLabelText("证据状态与冲突")).toBeTruthy();
    expect(screen.getByText(/拆解来源/)).toBeTruthy();
  });

  it("在需求探索工作区中显示该项目的来源状态", () => {
    const document = createDemandConfirmationDocument({ title: "需求项目", productName: "白板贴" });
    const data = loadLocalWorkbenchData();
    saveLocalWorkbenchData({ ...data, demandConfirmationDocuments: [document] });
    saveReference("demand-exploration", document.id, "需求来源");

    render(<DocumentWorkspace documentId={document.id} />);

    expect(screen.getByLabelText("证据状态与冲突")).toBeTruthy();
    expect(screen.getAllByText(/需求来源/).length).toBeGreaterThan(0);
  });
});
