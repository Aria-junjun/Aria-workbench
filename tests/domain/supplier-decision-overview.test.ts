import { describe, expect, it } from "vitest";
import { buildSupplierDecisionOverviewRows } from "@/features/workbench/product-master";

describe("supplier decision overview", () => {
  it("aggregates actual supply scope and flags split supply with evidence", () => {
    const rows = buildSupplierDecisionOverviewRows(
      [
        {
          familyKey: "白板贴",
          productName: "白板贴",
          skus: [
            { id: "sku-a", internalSkuCode: "Y-01", productName: "白板贴60*2", specification: "60*2" },
            { id: "sku-b", internalSkuCode: "Y-02", productName: "白板贴90*2", specification: "90*2" },
          ],
        },
      ],
      [
        { skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 100, supplierId: "s1", supplierName: "供应商甲" },
        { skuMasterId: "sku-b", period: "2026-07", receivedQuantity: 80, supplierId: "s2", supplierName: "供应商乙" },
      ],
      "2026-07",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ supplierName: "供应商甲", productCount: 1, coveredSkuCount: 1, receivedQuantity: 100, decision: "review_split", actionLabel: "复核主供/备供" });
    expect(rows[0].evidence).toContain("白板贴");
    expect(rows[1]).toMatchObject({ supplierName: "供应商乙", coveredSkuCount: 1, receivedQuantity: 80, decision: "review_split" });
  });

  it("keeps missing supplier evidence actionable without inventing a score", () => {
    const rows = buildSupplierDecisionOverviewRows(
      [{ familyKey: "墙贴", productName: "墙贴", skus: [{ id: "sku-a", internalSkuCode: "A", productName: "墙贴", specification: "60*3" }] }],
      [{ skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 60 }],
      "2026-07",
    );

    expect(rows).toEqual([expect.objectContaining({ supplierName: "供应商待确认", decision: "confirm_supplier", actionLabel: "补充实际供应商" })]);
    expect(rows[0].score).toBeUndefined();
  });

  it("flags incomplete SKU coverage instead of recommending primary supply", () => {
    const rows = buildSupplierDecisionOverviewRows(
      [{
        familyKey: "白板贴",
        productName: "白板贴",
        skus: [
          { id: "sku-a", internalSkuCode: "Y-01", productName: "白板贴60*2", specification: "60*2" },
          { id: "sku-b", internalSkuCode: "Y-02", productName: "白板贴90*2", specification: "90*2" },
        ],
      }],
      [{ skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 100, supplierId: "s1", supplierName: "供应商甲" }],
      "2026-07",
    );

    expect(rows).toEqual([expect.objectContaining({
      supplierName: "供应商甲",
      coveredSkuCount: 1,
      totalSkuCount: 2,
      decision: "complete_coverage",
      actionLabel: "补齐未覆盖 SKU",
    })]);
  });

  it("carries product return signals into supplier decisions without treating them as direct attribution", () => {
    const rows = buildSupplierDecisionOverviewRows(
      [{
        familyKey: "白板贴",
        productName: "白板贴",
        skus: [{ id: "sku-a", internalSkuCode: "Y-01", productName: "白板贴60*2", specification: "60*2" }],
      }],
      [{ skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 100, supplierId: "s1", supplierName: "供应商甲" }],
      "2026-07",
      [{ skuMasterId: "sku-a", period: "2026-07", shippedQuantity: 100, returnQuantity: 6 }],
    );

    expect(rows[0]).toMatchObject({
      supplierName: "供应商甲",
      returnRate: 6,
      decision: "review_quality",
      actionLabel: "复核产品/供应商质量",
    });
    expect(rows[0].evidence).toContain("退货率 6%");
  });
});
