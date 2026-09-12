import { describe, expect, it } from "vitest";
import {
  buildIndustryInsightReport,
  createIndustryInsightProject,
  getIndustryInsightCompleteness,
  updateIndustryInsightProject,
} from "@/features/workbench/industry-insight";

describe("industry insight domain", () => {
  it("creates an empty six-step project without prefilled case data", () => {
    const project = createIndustryInsightProject({ title: "白板贴行业判断", productName: "白板贴" });
    expect(project.steps).toEqual({ purpose: "draft", boundary: "draft", dimensions: "draft", stage: "draft", chain: "draft", conclusion: "draft" });
    expect(project.dimensions).toHaveLength(4);
    expect(project.boundary.object).toBe("");
    expect(project.createdAt).toBeTruthy();
  });

  it("classifies facts separately from inferences and excludes examples from the report", () => {
    const project = updateIndustryInsightProject(createIndustryInsightProject({ title: "测试" }), {
      dimensions: [{ key: "scale", fact: "已收集销售记录", evidence: "销售台账", judgment: "规模仍需外部数据验证", tag: "inference" }, ...createIndustryInsightProject({ title: "seed" }).dimensions.slice(1)],
    });
    const report = buildIndustryInsightReport(project);
    expect(report.sections.find((section) => section.key === "dimensions")?.content).toContain("已收集销售记录");
    expect(report.sections.map((section) => section.content).join(" ")).not.toContain("示例：");
  });

  it("flags missing evidence and reports the next action instead of auto-judging a stage", () => {
    const project = updateIndustryInsightProject(createIndustryInsightProject({ title: "测试" }), {
      stage: { currentStage: "unclear", basis: "", milestones: [], nextInflection: "", durationAssumption: "", evidenceIds: [] },
    });
    const completeness = getIndustryInsightCompleteness(project);
    expect(completeness.missing).toContain("阶段判断依据");
    expect(buildIndustryInsightReport(project).limitations).toContain("不会自动判定行业阶段");
  });

  it("archives and restores without changing the record id", () => {
    const original = createIndustryInsightProject({ title: "测试" });
    const archived = updateIndustryInsightProject(original, { status: "archived" });
    const restored = updateIndustryInsightProject(archived, { status: "draft" });
    expect(restored.id).toBe(original.id);
    expect(restored.status).toBe("draft");
  });
});
