import { describe, expect, it } from "vitest";
import {
  addCompetitorProfile,
  archiveCompetitorAnalysisProject,
  buildCompetitorAnalysisReport,
  createCompetitorAnalysisProject,
  createWhiteboardCompetitorAnalysisProject,
  restoreCompetitorAnalysisProject,
  updateCompetitorProfile,
  updateFiveLayerAnalysis,
  addCompetitorStageRecord,
  addProductComparison,
  addCompetitorStrategy,
  type CompetitorAnalysisProject,
} from "@/features/workbench/competitor-analysis";

function project(): CompetitorAnalysisProject {
  return createCompetitorAnalysisProject({
    title: "白板贴工作台竞品分析",
    productName: "个人商业工作台",
    targetUsers: "产品经理和业务负责人",
    analysisTheme: "产品工作台如何支持从需求到决策",
    decisionQuestion: "下一阶段优先补齐哪些产品能力？",
    expectedAction: "形成工作台版本优化计划",
    productStage: "验证期",
  });
}

describe("competitor analysis domain", () => {
  it("creates the whiteboard sticker case with traceable starter materials", () => {
    const result = createWhiteboardCompetitorAnalysisProject({
      title: "白板贴竞品分析",
      targetUsers: "家庭用户、教师和培训场景使用者",
      analysisTheme: "白板贴的书写、擦除和重复使用体验",
      decisionQuestion: "白板贴下一步应优先改善什么？",
      expectedAction: "形成产品优化优先级和验证计划",
      productStage: "销售验证期",
    });
    expect(result.productName).toBe("白板贴");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence.some((item) => item.sourceName.includes("白板贴内部经营记录"))).toBe(true);
    expect(result.evidence.some((item) => item.tag === "unverified")).toBe(true);
  });

  it("creates a guided project without prefilled example data", () => {
    const result = project();
    expect(result.title).toBe("白板贴工作台竞品分析");
    expect(result.competitors).toEqual([]);
    expect(result.evidence).toEqual([]);
    expect(result.status).toBe("draft");
  });

  it("adds a competitor and stores its relation and evidence references", () => {
    const result = addCompetitorProfile(project(), {
      name: "Notion",
      users: "知识工作者",
      scenarios: "项目和知识协作",
      problem: "把分散信息组织成可协作的工作区",
      relation: "reference",
      selectionReason: "参考工作区结构和知识组织方式",
      evidenceIds: ["evidence-1"],
    });
    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0].relation).toBe("reference");
    expect(result.status).toBe("in_progress");
  });

  it("updates the saved competitor profile without replacing its id", () => {
    const withCompetitor = addCompetitorProfile(project(), { name: "传统白板", users: "教师", relation: "substitute" });
    const savedId = withCompetitor.competitors[0].id;
    const result = updateCompetitorProfile(withCompetitor, savedId, { users: "家庭用户和教师", scenarios: "会议结束后继续擦除和复用", selectionReason: "验证重复使用场景" });
    expect(result.competitors[0]).toEqual(expect.objectContaining({ id: savedId, name: "传统白板", users: "家庭用户和教师", scenarios: "会议结束后继续擦除和复用" }));
  });

  it("updates one five-layer record without turning examples into user data", () => {
    const withCompetitor = addCompetitorProfile(project(), { name: "Notion", relation: "reference" });
    const competitorId = withCompetitor.competitors[0].id;
    const result = updateFiveLayerAnalysis(withCompetitor, competitorId, "strategy", {
      observation: "提供灵活的知识工作区",
      evidenceIds: ["evidence-2"],
      implication: "用户可以按自己的方式组织信息",
      inspiration: "工作台需要支持自定义产品工作流",
      tag: "inference",
    });
    expect(result.layerAnalyses[competitorId].strategy.observation).toBe("提供灵活的知识工作区");
    expect(result.layerAnalyses[competitorId].strategy.tag).toBe("inference");
  });

  it("archives and restores the project while preserving its history", () => {
    const archived = archiveCompetitorAnalysisProject(project());
    expect(archived.status).toBe("archived");
    expect(restoreCompetitorAnalysisProject(archived).status).toBe("draft");
  });

  it("builds traceable report sections and flags unverified content", () => {
    const result = buildCompetitorAnalysisReport(project());
    expect(result.sections.map((section) => section.key)).toEqual([
      "summary", "scope", "competitors", "five_layers", "stages", "self_state", "strategy", "evidence", "limitations",
    ]);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it("stores stages, product comparisons, and traceable strategies", () => {
    const withCompetitor = addCompetitorProfile(project(), { name: "Notion", relation: "reference" });
    const competitorId = withCompetitor.competitors[0].id;
    const withStage = addCompetitorStageRecord(withCompetitor, { competitorId, stage: "扩展期", versionOrPeriod: "2024", change: "增加团队工作流能力", evidenceIds: ["evidence-3"] });
    const withComparison = addProductComparison(withStage, { competitorId, layer: "structure", competitorPractice: "模块之间可以互相引用", ourState: "目前需要手动搬运", differenceType: "incomplete", evidenceIds: ["evidence-3"], act: true, reason: "影响跨模块闭环" });
    const result = addCompetitorStrategy(withComparison, { type: "differentiate", title: "让分析结论进入产品进程", problem: "分析与执行断开", basis: "结构层对比", goal: "减少重复录入", solution: "增加需求到产品进程的引用", expectedValue: "提高闭环效率", effort: "中", priority: "高", nextAction: "先设计引用字段", validation: "完成一次真实项目串联", evidenceIds: ["evidence-3"] });
    expect(result.stageRecords).toHaveLength(1);
    expect(result.comparisons[0].differenceType).toBe("incomplete");
    expect(result.strategies[0].type).toBe("differentiate");
  });
});
