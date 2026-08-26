import { describe, expect, it } from "vitest";
import { aggregateSkuMetrics, aggregateSkuSnapshots, buildProductSupplierDisplay, deriveProductFamilyKey, groupSkuMastersByProduct, promoteProductToInbound, sortProductMasterGroupsByOperatingData, sortProductMasterSkusByOperatingData } from "@/features/workbench/product-master";

describe("inbound product master", () => {
  it("groups imported SKUs by product name without duplicating rows", () => {
    const groups = groupSkuMastersByProduct([
      { id: "sku-1", internalSkuCode: "Y-01", productName: "白板贴", specification: "30*60" },
      { id: "sku-2", internalSkuCode: "Y-02", productName: "白板贴", specification: "45*60" },
      { id: "sku-2", internalSkuCode: "Y-02", productName: "白板贴", specification: "45*60" },
      { id: "sku-3", internalSkuCode: "Y-03", productName: "静电贴", specification: "30*60" }
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ familyKey: "白板贴", productName: "白板贴", skuIds: ["sku-1", "sku-2"] });
    expect(groups[1].skuIds).toEqual(["sku-3"]);
  });

  it("uses the common product stem while keeping different product stems separate", () => {
    expect(deriveProductFamilyKey("无胶白板贴小纸管0.6*5m+8支彩色白板笔")).toBe("无胶白板贴小纸管");
    expect(deriveProductFamilyKey("无胶白板贴小纸管0.6*5m")).toBe("无胶白板贴小纸管");
    expect(deriveProductFamilyKey("白板贴背胶")).toBe("白板贴背胶");
  });

  it("uses the normalized family name instead of the first SKU specification", () => {
    const groups = groupSkuMastersByProduct([
      { id: "sku-1", internalSkuCode: "Y-01", productName: "无胶白板贴小纸管0.3*0.6m", specification: "0.3*0.6m" },
      { id: "sku-2", internalSkuCode: "Y-02", productName: "无胶白板贴小纸管0.45*2m", specification: "0.45*2m" },
    ]);

    expect(groups).toEqual([
      expect.objectContaining({ familyKey: "无胶白板贴小纸管", productName: "无胶白板贴小纸管", skuIds: ["sku-1", "sku-2"] }),
    ]);
  });

  it("promotes an opportunity without deleting its research fields", () => {
    const promoted = promoteProductToInbound({ name: "白板贴", recordKind: "opportunity", opportunities: ["市场需求"], lifecycleStage: "validate" });
    expect(promoted).toMatchObject({ name: "白板贴", recordKind: "existing", productMode: "inbound", portfolioStatus: "active", opportunities: ["市场需求"], lifecycleStage: "validate" });
  });

  it("aggregates family metrics from sku-level inputs and weights gross margin by sales", () => {
    const summary = aggregateSkuMetrics([
      { monthlySales: 10, salesAmount: 100, erpCostPrice: 2, shippedQuantity: 11, returnQuantity: 1 },
      { monthlySales: 30, salesAmount: 300, erpCostPrice: 4, shippedQuantity: 31, returnQuantity: 1 }
    ]);
    expect(summary).toMatchObject({ monthlySales: 40, salesAmount: 400, erpCostPrice: 3.5, returnQuantity: 2, returnRate: 4.76, source: "sku_manual" });
  });

  it("compares a selected month with the previous month without inventing missing values", () => {
    const comparison = aggregateSkuSnapshots(
      [{ monthlySales: 40, salesAmount: 400, erpCostPrice: 3.5 }],
      [{ monthlySales: 30, salesAmount: 300, erpCostPrice: 3.2 }],
      "2026-09"
    );

    expect(comparison.current).toMatchObject({ monthlySales: 40, salesAmount: 400, erpCostPrice: 3.5 });
    expect(comparison.previous).toMatchObject({ monthlySales: 30, salesAmount: 300, erpCostPrice: 3.2 });
    expect(comparison.delta).toMatchObject({ monthlySales: 10, salesAmount: 100 });
    expect(comparison.delta.erpCostPrice).toBeUndefined();
    expect(comparison.period).toBe("2026-09");
  });

  it("keeps a month pending when all selected-period metrics are empty", () => {
    const comparison = aggregateSkuSnapshots([{}], [], "2026-10");
    expect(comparison.current.source).toBe("pending");
    expect(comparison.current.monthlySales).toBeUndefined();
    expect(comparison.delta.monthlySales).toBeUndefined();
  });

  it("sorts product families by available data and shipped quantity", () => {
    const groups = groupSkuMastersByProduct([
      { id: "sku-a", internalSkuCode: "A", productName: "无数据产品", specification: "1" },
      { id: "sku-b", internalSkuCode: "B", productName: "低销量产品", specification: "1" },
      { id: "sku-c", internalSkuCode: "C", productName: "高销量产品", specification: "1" },
    ]);

    const sorted = sortProductMasterGroupsByOperatingData(groups, [
      { skuMasterId: "sku-b", period: "2026-07", shippedQuantity: 20 },
      { skuMasterId: "sku-c", period: "2026-07", shippedQuantity: 80 },
    ], [], "2026-07");

    expect(sorted.map((group) => group.productName)).toEqual(["高销量产品", "低销量产品", "无数据产品"]);
  });

  it("sorts expanded SKUs by shipped quantity and then inbound quantity", () => {
    const skus = [
      { id: "sku-a", internalSkuCode: "A", productName: "白板贴", specification: "1" },
      { id: "sku-b", internalSkuCode: "B", productName: "白板贴", specification: "2" },
      { id: "sku-c", internalSkuCode: "C", productName: "白板贴", specification: "3" },
    ];

    const sorted = sortProductMasterSkusByOperatingData(skus, [
      { skuMasterId: "sku-a", period: "2026-07", shippedQuantity: 10 },
      { skuMasterId: "sku-b", period: "2026-07", shippedQuantity: 30 },
    ], [
      { skuMasterId: "sku-c", period: "2026-07", receivedQuantity: 50 },
    ], "2026-07");

    expect(sorted.map((sku) => sku.internalSkuCode)).toEqual(["B", "A", "C"]);
  });

  it("keeps an established supplier relationship across months and treats inbound supplier as evidence", () => {
    const display = buildProductSupplierDisplay(
      [{ supplierName: "供应商甲", supplierRelationshipSource: "family_assignment" }],
      [{ supplierName: "供应商甲" }],
    );

    expect(display).toMatchObject({ label: "当前供应商", names: ["供应商甲"], note: "关系持续有效" });

    const changed = buildProductSupplierDisplay(
      [{ supplierName: "供应商甲", supplierRelationshipSource: "family_assignment" }],
      [{ supplierName: "供应商乙" }],
    );
    expect(changed).toMatchObject({ label: "当前供应商", names: ["供应商甲"] });
    expect(changed.note).toContain("本期入仓记录出现");
  });
});
