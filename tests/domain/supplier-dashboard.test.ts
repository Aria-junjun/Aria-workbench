import { describe, expect, it } from "vitest";
import { buildSupplierDashboard } from "@/features/workbench/supplier-dashboard";

const fixture = {
  suppliers: [
    { id: "quality", name: "质量供应商", evaluations: [{ period: "2026-07", scores: { total: 88, grade: "B" }, rawMetrics: { returnRate: 6 } }] },
    { id: "delivery", name: "交付供应商", evaluations: [{ period: "2026-07", scores: { total: 91, grade: "A" }, rawMetrics: { onTimeDeliveryRate: 70 } }] },
    { id: "missing", name: "待补数据供应商", evaluations: [] },
    { id: "normal", name: "正常供应商", evaluations: [{ period: "2026-07", scores: { total: 96, grade: "A" }, rawMetrics: { returnRate: 1 } }] },
  ],
  products: [],
  skuMasters: [],
  monthlyInboundSnapshots: [],
  skuOperatingSnapshots: [],
  productSupplierAssignments: [],
  offers: [],
} as never;

describe("supplier dashboard view model", () => {
  it("keeps the action queue focused on actionable problems", () => {
    const result = buildSupplierDashboard(fixture, "2026-07");
    expect(result.actionQueue.map((item) => item.issueType)).toEqual(["quality", "delivery"]);
    expect(result.stats.waitingData).toBe(1);
  });

  it("keeps ERP score separate from workbench judgment", () => {
    const result = buildSupplierDashboard(fixture, "2026-07");
    const quality = result.suppliers.find((item) => item.supplierId === "quality");
    expect(quality?.erpPerformanceScore).toBe(88);
    expect(quality?.workbenchJudgment).toBe("needs_review");
  });

  it("does not treat normal keep-primary decisions as actions", () => {
    const result = buildSupplierDashboard(fixture, "2026-07");
    expect(result.actionQueue.some((item) => item.action === "保持主供")).toBe(false);
  });
});
