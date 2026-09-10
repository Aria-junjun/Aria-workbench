import { beforeEach, describe, expect, it, vi } from "vitest";
import { addCompetitorProfile, addCompetitorStageRecord, addCompetitorStrategy, addProductComparison, buildCompetitorAnalysisReport, createCompetitorAnalysisProject, updateFiveLayerAnalysis } from "@/features/workbench/competitor-analysis";
import { loadCompetitorAnalysisProjects, saveCompetitorAnalysisProject } from "@/features/workbench/local-store";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });
});

describe("competitor analysis save-load pipeline", () => {
  it("keeps competitors, five-layer evidence, stage, comparison, and strategy after reload", () => {
    let project = createCompetitorAnalysisProject({ title: "白板贴工作台竞品分析", productName: "个人商业工作台", targetUsers: "产品经理", analysisTheme: "需求到决策", decisionQuestion: "先做什么？", expectedAction: "形成计划", productStage: "验证期" });
    project = addCompetitorProfile(project, { name: "Notion", relation: "reference", selectionReason: "参考工作区结构" });
    const competitorId = project.competitors[0].id;
    project = updateFiveLayerAnalysis(project, competitorId, "structure", { observation: "模块可以互相引用", evidenceIds: ["evidence-1"], implication: "减少重复搬运", inspiration: "建立跨模块链接", tag: "fact" });
    project = addCompetitorStageRecord(project, { competitorId, stage: "扩展期", versionOrPeriod: "2024", change: "增加团队协作", evidenceIds: ["evidence-1"] });
    project = addProductComparison(project, { competitorId, layer: "structure", competitorPractice: "模块互相引用", ourState: "目前手动复制", differenceType: "incomplete", evidenceIds: ["evidence-1"], act: true, reason: "影响闭环" });
    project = addCompetitorStrategy(project, { type: "borrow", title: "增加跨模块引用", problem: "分析与执行断开", basis: "结构层对比", goal: "减少重复录入", solution: "增加引用字段", expectedValue: "提高闭环效率", effort: "中", priority: "高", nextAction: "设计字段", validation: "串联一个真实项目", evidenceIds: ["evidence-1"] });
    saveCompetitorAnalysisProject(project);

    const reloaded = loadCompetitorAnalysisProjects()[0];
    const report = buildCompetitorAnalysisReport(reloaded);
    expect(reloaded.competitors).toHaveLength(1);
    expect(reloaded.layerAnalyses[competitorId].structure.inspiration).toBe("建立跨模块链接");
    expect(reloaded.stageRecords).toHaveLength(1);
    expect(reloaded.comparisons[0].differenceType).toBe("incomplete");
    expect(reloaded.strategies[0].title).toBe("增加跨模块引用");
    expect(report.sections.find((section) => section.key === "strategy")?.evidenceIds).toEqual(["evidence-1"]);
  });
});
