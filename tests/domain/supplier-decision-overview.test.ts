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

  it("keeps partial SKU coverage as reference without creating a supplier action", () => {
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
      decision: "maintain_primary",
      actionLabel: "保持主供",
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

  it("includes a saved product-family relationship in the overview alongside inbound evidence", () => {
    const rows = buildSupplierDecisionOverviewRows(
      [{
        familyKey: "白板贴",
        productName: "白板贴",
        skus: [{ id: "sku-a", internalSkuCode: "Y-01", productName: "白板贴60*2", specification: "60*2" }],
      }],
      [{ skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 100, supplierId: "supplier-a", supplierName: "实际供货商" }],
      "2026-07",
      [],
      5,
      "2026-07",
      [{
        productFamilyKey: "白板贴",
        supplierId: "supplier-b",
        supplierName: "已维护主供",
        role: "primary",
        effectiveFrom: "2026-07",
        status: "active",
        source: "manual",
        reason: "确认当前主供",
        evidence: "实际入仓记录",
      }],
    );

    expect(rows.map((row) => row.supplierName)).toEqual(["实际供货商", "已维护主供"]);
    expect(rows[1]).toMatchObject({ productNames: ["白板贴"], receivedQuantity: 0, decision: "review_split" });
    expect(rows[1].evidence).toContain("已维护供应关系");
  });
});
