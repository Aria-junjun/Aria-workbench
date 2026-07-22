import { describe, expect, it } from "vitest";
import { buildProductComparison } from "@/features/workbench/product-comparison";
import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

describe("buildProductComparison", () => {
  it("compares real procurement quotes without theoretical hard costs", () => {
    const comparison = buildProductComparison([
      product({ id: "a", name: "产品 A", procurementQuotes: [{ source: "1688", specification: "20×30cm", price: "12元/套" }] }),
      product({ id: "b", name: "产品 B", procurementQuotes: [{ source: "供应商", specification: "20×30cm", price: "15元/套" }] })
    ]);

    expect(comparison.rows.some((row) => row.label === "产品硬成本")).toBe(false);
    expect(comparison.rows.find((row) => row.label === "采购报价")?.values).toEqual([
      "1688｜20×30cm｜12元/套",
      "供应商｜20×30cm｜15元/套"
    ]);
  });

  it("compares material structures, machinery and quality controls", () => {
    const comparison = buildProductComparison([
      product({ id: "a", name: "产品 A", materialStructures: [{ name: "亚克力", role: "板材" }], machinery: ["激光切割机"] }),
      product({ id: "b", name: "产品 B", materialStructures: [{ name: "PET", role: "板材" }], qualityControls: ["检查平整度"] })
    ]);

    expect(comparison.rows.find((row) => row.label === "原料与结构")?.values).toEqual(["亚克力（板材）", "PET（板材）"]);
    expect(comparison.rows.find((row) => row.label === "所需机器")?.values).toEqual(["激光切割机", "未记录"]);
    expect(comparison.rows.find((row) => row.label === "质量控制点")?.values).toEqual(["未记录", "检查平整度"]);
  });
});

function product(overrides: Partial<ProductKnowledgeV2>): ProductKnowledgeV2 {
  return {
    schemaVersion: 2,
    id: "product",
    name: "测试产品",
    useScenarios: [],
    specifications: [],
    procurementQuotes: [],
    materialStructures: [],
    machinery: [],
    qualityControls: [],
    industryClusters: [],
    costItems: [],
    hardCostStatus: "pending",
    manufacturing: { processes: [] },
    optimizationOptions: [],
    risks: { quality: [], supply: [], compliance: [], other: [] },
    opportunities: [],
    decision: { status: "undecided" },
    importIssues: [],
    createdAt: "2026-07-17T00:00:00.000Z",
    ...overrides
  };
}
