import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductKnowledgeEditor } from "@/components/workbench/product-knowledge-editor";
import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

describe("ProductKnowledgeEditor", () => {
  it("renders editable production-intelligence modules without theoretical hard costs", () => {
    const html = renderToStaticMarkup(
      <ProductKnowledgeEditor issues={[]} onChange={vi.fn()} value={productFixture()} />
    );

    [
      "产品定位",
      "关键规格",
      "1688采购参考",
      "原料与结构",
      "生产流程与设备",
      "成熟替代与优化",
      "缺陷与风险",
      "采购与验证"
    ].forEach((heading) => expect(html).toContain(heading));
    expect(html).toContain("新增规格");
    expect(html).toContain("新增采购报价");
    expect(html).toContain("新增原料或结构");
    expect(html).toContain("新增替代项");
    expect(html).toContain("删除规格");
    expect(html).toContain("删除采购报价");
    expect(html).toContain("删除替代项");
    expect(html).not.toContain("硬成本合计");
    expect(html).toContain("启用技术趋势记录");
  });

  it("keeps every input controlled and edits structured production fields", () => {
    const source = readFileSync("src/components/workbench/product-knowledge-editor.tsx", "utf8");

    expect(source).not.toMatch(/defaultValue=/);
    expect(source).toContain("onChange({ ...value, specifications:");
    expect(source).toContain("onChange({ ...value, procurementQuotes:");
    expect(source).toContain("onChange({ ...value, materialStructures:");
    expect(source).toContain("onChange({ ...value, optimizationOptions:");
  });
});

function productFixture(): ProductKnowledgeV2 {
  return {
    schemaVersion: 2,
    id: "product-1",
    name: "亚克力留言板",
    category: "桌面文具",
    coreUse: "记录提醒",
    targetUsers: "办公人群",
    useScenarios: ["书桌"],
    defaultUnit: "个",
    specifications: [{ id: "spec-1", name: "厚度", value: "3", unit: "mm", source: "research" }],
    procurementQuotes: [{ source: "1688", specification: "20×30cm", price: "12元/套", moq: "10套" }],
    materialStructures: [{ name: "亚克力板", role: "主体板材", keyParameters: "厚度、透光率", weaknesses: "易划伤" }],
    machinery: ["激光切割机"],
    qualityControls: ["检查边缘"],
    industryClusters: ["浙江台州"],
    costItems: [{
      id: "cost-1",
      category: "主材",
      name: "亚克力板",
      quantity: 1,
      unit: "个",
      unitCost: 10,
      subtotal: 10,
      currency: "CNY",
      included: true,
      source: "厂家报价；浙江；2026-07-15；高"
    }],
    hardCostTotal: 10,
    hardCostStatus: "confirmed",
    manufacturing: { processes: ["激光切割"], leadTime: "7 天", minimumOrderQuantity: "100 个", notes: "检查边缘" },
    optimizationOptions: [{ id: "option-1", name: "PVC 板", description: "替代亚克力", impact: "成本降低", status: "candidate" }],
    risks: { quality: ["易划伤"], supply: ["色差"], compliance: [], other: [] },
    opportunities: ["磁吸款"],
    decision: { summary: "板材是主要成本", recommendation: "继续打样", rationale: "验证耐刮性", status: "proceed" },
    importIssues: [],
    createdAt: "2026-07-16T00:00:00.000Z"
  };
}
