import { describe, expect, it } from "vitest";
import { buildProductBrief } from "@/features/workbench/product-brief";
import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

describe("buildProductBrief", () => {
  it("builds a concise brief from one product record", () => {
    const brief = buildProductBrief(product());

    expect(brief.title).toBe("亚克力留言板");
    expect(brief.facts).toContainEqual(["采购报价", "1688｜20×30cm｜12元/套"]);
    expect(brief.facts.some(([label]) => label === "产品硬成本")).toBe(false);
    expect(brief.sections.find((section) => section.title === "关键规格")?.items).toContain("厚度：3 mm");
    expect(brief.sections.find((section) => section.title === "生产流程与设备")?.items).toContain("设备：激光切割机");
    expect(brief.sections.find((section) => section.title === "缺陷与采购验证")?.items).toContain("确认打样");
  });
});

function product(): ProductKnowledgeV2 {
  return {
    schemaVersion: 2,
    id: "brief-product",
    name: "亚克力留言板",
    category: "家居用品",
    coreUse: "冰箱留言",
    targetUsers: "家庭用户",
    useScenarios: ["厨房"],
    defaultUnit: "件",
    specifications: [{ name: "厚度", value: "3", unit: "mm" }],
    procurementQuotes: [{ source: "1688", specification: "20×30cm", price: "12元/套" }],
    materialStructures: [{ name: "亚克力板", role: "主体板材", weaknesses: "易刮花" }],
    machinery: ["激光切割机"],
    qualityControls: ["检查板材平整度"],
    industryClusters: ["浙江台州"],
    costItems: [],
    hardCostTotal: 12,
    hardCostStatus: "confirmed",
    manufacturing: { processes: ["激光切割"] },
    optimizationOptions: [],
    risks: { quality: ["易刮花"], supply: [], compliance: [], other: [] },
    opportunities: ["礼品场景"],
    decision: { status: "proceed", recommendation: "继续询价", rationale: "确认打样" },
    importIssues: [],
    createdAt: "2026-07-17T00:00:00.000Z"
  };
}
