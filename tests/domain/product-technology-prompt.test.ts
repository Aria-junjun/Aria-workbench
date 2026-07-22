import { describe, expect, it } from "vitest";
import { buildProductTechnologyPrompt } from "@/features/workbench/product-technology-prompt";
import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

describe("buildProductTechnologyPrompt", () => {
  it("builds an opt-in trend prompt from existing product facts", () => {
    const prompt = buildProductTechnologyPrompt(product());

    expect(prompt).toContain("亚克力留言板");
    expect(prompt).toContain("亚克力板");
    expect(prompt).toContain("当前主流技术路线");
    expect(prompt).toContain("正在进入市场的新材料");
    expect(prompt).toContain("区分已验证事实、公开行业动向和推断");
    expect(prompt).toContain("不要重复基础产品介绍");
  });
});

function product(): ProductKnowledgeV2 {
  return {
    schemaVersion: 2,
    id: "technology-product",
    name: "亚克力留言板",
    useScenarios: ["冰箱留言"],
    specifications: [{ name: "厚度", value: "2", unit: "mm" }],
    procurementQuotes: [],
    materialStructures: [{ name: "亚克力板", role: "主体板材" }],
    machinery: ["激光切割机"],
    qualityControls: [],
    industryClusters: [],
    costItems: [],
    hardCostStatus: "pending",
    manufacturing: { processes: ["激光切割"] },
    optimizationOptions: [],
    risks: { quality: [], supply: [], compliance: [], other: [] },
    opportunities: [],
    decision: { status: "undecided" },
    importIssues: [],
    createdAt: "2026-07-21T00:00:00.000Z"
  };
}
