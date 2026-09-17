import { describe, expect, it } from "vitest";
import { createDemandConfirmationDocument } from "@/features/workbench/demand-confirmation";
import { createCompetitorAnalysisProject } from "@/features/workbench/competitor-analysis";
import { createProductDecompositionProject } from "@/features/workbench/product-decomposition";
import { setOpportunityProductLink } from "@/features/workbench/research-project-links";

describe("研究项目与机会产品的可选关联", () => {
  it("新建研究项目默认不强制关联机会产品", () => {
    const demand = createDemandConfirmationDocument({ title: "需求", productName: "白板贴" });
    const competitor = createCompetitorAnalysisProject({ title: "竞品", productName: "白板贴", targetUsers: "家庭办公", analysisTheme: "擦除", decisionQuestion: "比较替代方案", expectedAction: "补充证据", productStage: "机会" });
    const decomposition = createProductDecompositionProject({ title: "拆解", centralQuestion: "为什么留痕" });
    expect(demand.opportunityProductId).toBeUndefined();
    expect(competitor.opportunityProductId).toBeUndefined();
    expect(decomposition.opportunityProductId).toBeUndefined();
  });

  it("设置或清除关联只改变机会产品 ID，不覆盖研究内容", () => {
    const project = createDemandConfirmationDocument({ title: "需求", productName: "白板贴", problem: "擦除留痕" });
    const linked = setOpportunityProductLink(project, "opportunity-1");
    expect(linked.opportunityProductId).toBe("opportunity-1");
    expect(linked.problem).toBe("擦除留痕");
    const unlinked = setOpportunityProductLink(linked);
    expect(unlinked.opportunityProductId).toBeUndefined();
    expect(unlinked.problem).toBe("擦除留痕");
  });
});
