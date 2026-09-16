import { describe, expect, it } from "vitest";
import {
  buildIndustryInsightReport,
  createIndustryInsightProject,
  getIndustryInsightCompleteness,
  updateIndustryInsightProject,
} from "@/features/workbench/industry-insight";
import { getIndustryInsightDraftReviewCounts } from "@/components/workbench/industry-insight/insight-report";
import { buildIndustryInsightResearchPrompt } from "@/features/workbench/industry-insight-bridge";

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

  it("counts unreviewed and needs-verification drafts without changing formal report data", () => {
    const project = createIndustryInsightProject({ title: "测试" });
    const withDrafts = {
      ...project,
      aiDrafts: [
        { id: "draft-1", fieldPath: "decisionQuestion", value: "待审", status: "draft" as const, sourceRefs: [], importedAt: "2026-09-15" },
        { id: "draft-2", fieldPath: "expectedAction", value: "需核验", status: "needs_verification" as const, sourceRefs: [], importedAt: "2026-09-15" },
        { id: "draft-3", fieldPath: "boundary.object", value: "已采用", status: "accepted" as const, sourceRefs: [], importedAt: "2026-09-15" },
      ],
    };

    expect(getIndustryInsightDraftReviewCounts(withDrafts)).toEqual({ unreviewed: 2, needsVerification: 1 });
    expect(buildIndustryInsightReport(withDrafts).sections[0].content).toBe("｜｜｜");
  });

  it("carries research-before-input into the external research prompt", () => {
    const project = createIndustryInsightProject({
      title: "白板贴研究",
      productName: "白板贴",
      decisionQuestion: "是否继续验证擦除体验？",
      researchInput: {
        knownMaterials: "已有商品评价和内部销售记录。",
        personalObservations: "我观察到用户反复提到留痕。",
        initialHypotheses: "材料性能可能比页面表达更关键。",
        focusQuestions: "核查留痕是否影响购买和复购。",
        excludedDirections: "暂不扩展到企业协作软件。",
      },
    });
    const prompt = buildIndustryInsightResearchPrompt(project);
    expect(prompt).toContain("用户提供的研究前材料");
    expect(prompt).toContain("我观察到用户反复提到留痕");
    expect(prompt).toContain("暂不扩展到企业协作软件");
  });
});
