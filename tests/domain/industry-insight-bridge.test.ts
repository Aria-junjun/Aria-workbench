import { describe, expect, it } from "vitest";
import { createIndustryInsightProject } from "@/features/workbench/industry-insight";
import {
  applyIndustryInsightDraft,
  buildIndustryInsightResearchPrompt,
  getIndustryInsightFieldDisplay,
  parseIndustryInsightMarkdown,
} from "@/features/workbench/industry-insight-bridge";

describe("industry insight external GPT bridge", () => {
  it("builds a prompt with only the current field catalog", () => {
    const project = createIndustryInsightProject({
      title: "白板贴行业判断",
      productName: "白板贴",
      decisionQuestion: "是否优先验证重复擦写场景？",
      expectedAction: "进入需求探索",
    });

    const prompt = buildIndustryInsightResearchPrompt(project);

    expect(prompt).toContain("purpose.decisionQuestion");
    expect(prompt).toContain("boundary.exclusions");
    expect(prompt).toContain("dimensions.scale.fact");
    expect(prompt).toContain("stage.nextInflection");
    expect(prompt).toContain("chainNodes[].participants");
    expect(prompt).toContain("chainNodes[].valueFlow");
    expect(prompt).toContain("conclusion.nextAction");
    expect(prompt).toContain("### purpose.decisionQuestion");
    expect(prompt).toContain("不得使用编号列表代替字段");
    expect(prompt).not.toContain("研究背景");
    expect(prompt).not.toContain("成功标准");
    expect(prompt).not.toContain("stage.milestones");
  });

  it("parses recognized fields and keeps unknown content as warnings", () => {
    const result = parseIndustryInsightMarkdown(`
## 研究目的
### 决策问题
是否优先验证重复擦写场景？
### 预期行动
进入需求探索。
## 额外结论
这是不能归位的内容。
`);

    expect(result.drafts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldPath: "decisionQuestion",
        value: "是否优先验证重复擦写场景？",
        status: "draft",
      }),
      expect.objectContaining({
        fieldPath: "expectedAction",
        value: "进入需求探索。",
        status: "draft",
      }),
    ]));
    expect(result.warnings.join(" ")).toContain("未识别板块");
  });

  it("parses field-path labels returned by external GPT", () => {
    const result = parseIndustryInsightMarkdown(`
purpose.decisionQuestion（研究目的 / 决策问题）：
事实：公开资料显示用户关注擦除留痕。
推断：材料性能可能是关键因素。
待验证：需要进一步测试。
策略建议：先建立统一测试矩阵。
`);
    expect(result.drafts).toEqual(expect.arrayContaining([
        expect.objectContaining({ fieldPath: "purpose.decisionQuestion", status: "draft" }),
    ]));
    expect(result.drafts[0]?.value).toContain("事实：");
  });

  it("parses markdown-escaped field paths and keeps their Chinese field meaning", () => {
    const result = parseIndustryInsightMarkdown(`
dimensions.share\\_shift.fact：
事实：市场占比数据尚未完整。
`);

    expect(result.warnings).toHaveLength(0);
    expect(result.drafts[0]).toEqual(expect.objectContaining({
      fieldPath: "dimensions.share_shift.fact",
      status: "draft",
    }));
    expect(getIndustryInsightFieldDisplay("dimensions.share_shift.fact")).toBe("四维分析 · 市场占比 · 观察事实");
  });

  it("describes unknown fields in Chinese without exposing a raw path", () => {
    const result = parseIndustryInsightMarkdown("unknown\\_field：\n这是一段无法归类的内容。");

    expect(result.warnings.join(" ")).toContain("无法归类");
    expect(result.warnings.join(" ")).not.toContain("unknown_field");
  });

  it("warns instead of silently dropping non-empty unrecognized content", () => {
    const result = parseIndustryInsightMarkdown("这是一段没有字段标题的研究内容。");
    expect(result.drafts).toHaveLength(0);
    expect(result.warnings.join(" ")).toContain("未识别");
  });

  it("applies only an accepted draft to an existing formal field", () => {
    const project = createIndustryInsightProject({ title: "测试" });
    const draft = {
      id: "draft-1",
      fieldPath: "decisionQuestion",
      value: "新的决策问题",
      status: "accepted" as const,
      sourceRefs: [],
      importedAt: "2026-09-15T00:00:00.000Z",
    };

    expect(applyIndustryInsightDraft(project, draft).decisionQuestion).toBe("新的决策问题");
  });

  it("does not apply an unreviewed draft to a formal field", () => {
    const project = createIndustryInsightProject({ title: "测试" });
    const draft = {
      id: "draft-2",
      fieldPath: "decisionQuestion",
      value: "未经确认的问题",
      status: "draft" as const,
      sourceRefs: [],
      importedAt: "2026-09-15T00:00:00.000Z",
    };

    expect(applyIndustryInsightDraft(project, draft).decisionQuestion).toBe("");
  });
});
