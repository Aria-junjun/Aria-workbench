import { describe, expect, it } from "vitest";
import { buildProductInboundSummary, buildProductInboundSupplierSummary, buildProductSupplierDecisionRows } from "@/features/workbench/product-master";

describe("product master inbound summary", () => {
  it("aggregates inbound facts and shipped quantity by product family", () => {
    const summary = buildProductInboundSummary(
      [
        { id: "a", internalSkuCode: "Y-01", productName: "白板贴0.45*2m", specification: "0.45*2m", productFamilyKey: "白板贴" },
        { id: "b", internalSkuCode: "Y-02", productName: "白板贴0.45*3m", specification: "0.45*3m", productFamilyKey: "白板贴" },
      ],
      [
        { id: "in-a", skuMasterId: "a", period: "2026-07", receivedQuantity: 500, actualStock: 300, availableStock: 250, sourceFileName: "a.xlsx", sourceSheetName: "Sheet1", importedAt: "now" },
        { id: "in-b", skuMasterId: "b", period: "2026-07", receivedQuantity: 200, actualStock: 100, availableStock: 80, sourceFileName: "a.xlsx", sourceSheetName: "Sheet1", importedAt: "now" },
      ],
      [
        { id: "sales-a", skuMasterId: "a", period: "2026-07", shippedQuantity: 100, source: "imported", createdAt: "now", updatedAt: "now" },
        { id: "sales-b", skuMasterId: "b", period: "2026-07", shippedQuantity: 50, source: "imported", createdAt: "now", updatedAt: "now" },
      ],
      "2026-07"
    );

    expect(summary).toMatchObject({ receivedQuantity: 700, actualStock: 400, availableStock: 330, inventoryGap: 70, receivedToShippedRatio: 4.67, missingPreviousPeriod: true });
  });

  it("leaves unavailable inventory values unavailable", () => {
    expect(buildProductInboundSummary(
      [{ id: "a", internalSkuCode: "Y-01", productName: "白板贴", specification: "0.45*2m", productFamilyKey: "白板贴" }],
      [{ id: "in-a", skuMasterId: "a", period: "2026-07", receivedQuantity: 500, sourceFileName: "a.xlsx", sourceSheetName: "Sheet1", importedAt: "now" }],
      [],
      "2026-07"
    )).toEqual({ receivedQuantity: 500, actualStock: undefined, availableStock: undefined, inventoryGap: undefined, inTransitQuantity: undefined, receivedToShippedRatio: undefined, missingPreviousPeriod: true });
  });

  it("aggregates a product-family inbound fact without assigning it to every SKU", () => {
    const summary = buildProductInboundSummary(
      [
        { id: "a", internalSkuCode: "Y-05BBT", productName: "白板贴", specification: "0.45*10m", productFamilyKey: "whiteboard-family" },
        { id: "b", internalSkuCode: "Y-05BBT-8", productName: "白板贴", specification: "0.45*10m+8支笔", productFamilyKey: "whiteboard-family" },
      ],
      [{ id: "family-in", skuMasterId: "a", productFamilyKey: "whiteboard-family", mappingLevel: "product_family", period: "2026-07", receivedQuantity: 120, sourceFileName: "inbound.xlsx", sourceSheetName: "Sheet1", importedAt: "now" }],
      [
        { id: "sales-a", skuMasterId: "a", period: "2026-07", shippedQuantity: 80 },
        { id: "sales-b", skuMasterId: "b", period: "2026-07", shippedQuantity: 40 },
      ],
      "2026-07",
    );

    expect(summary).toMatchObject({ receivedQuantity: 120, receivedToShippedRatio: 1 });
  });

  it("identifies actual inbound suppliers and flags split supply by product", () => {
    const result = buildProductInboundSupplierSummary(
      [
        { id: "sku-a", internalSkuCode: "Y-01", productName: "白板贴", specification: "60*2" },
        { id: "sku-b", internalSkuCode: "Y-02", productName: "白板贴", specification: "90*2" },
      ],
      [
        { skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 100, supplierId: "s1", supplierName: "供应商甲" },
        { skuMasterId: "sku-b", period: "2026-07", receivedQuantity: 80, supplierId: "s2", supplierName: "供应商乙" },
      ],
      "2026-07",
    );

    expect(result.totalReceivedQuantity).toBe(180);
    expect(result.suppliers).toEqual([
      { supplierId: "s1", supplierName: "供应商甲", receivedQuantity: 100, skuCount: 1 },
      { supplierId: "s2", supplierName: "供应商乙", receivedQuantity: 80, skuCount: 1 },
    ]);
    expect(result.isSplit).toBe(true);
  });

  it("turns product and supplier facts into an actionable decision row", () => {
    const rows = buildProductSupplierDecisionRows(
      [{
        familyKey: "白板贴",
        productName: "白板贴",
        skus: [
          { id: "sku-a", internalSkuCode: "Y-01", productName: "白板贴60*2", specification: "60*2" },
          { id: "sku-b", internalSkuCode: "Y-02", productName: "白板贴90*2", specification: "90*2" },
        ],
      }],
      [
        { skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 100, supplierId: "s1", supplierName: "供应商甲" },
        { skuMasterId: "sku-b", period: "2026-07", receivedQuantity: 80, supplierId: "s1", supplierName: "供应商甲" },
      ],
      [
        { skuMasterId: "sku-a", period: "2026-07", shippedQuantity: 100, returnQuantity: 1 },
        { skuMasterId: "sku-b", period: "2026-07", shippedQuantity: 80, returnQuantity: 0 },
      ],
      "2026-07",
    );

    expect(rows).toEqual([expect.objectContaining({
      familyKey: "白板贴",
      supplierName: "供应商甲",
      coveredSkuCount: 2,
      totalSkuCount: 2,
      receivedQuantity: 180,
      decision: "maintain_primary",
      actionLabel: "保持主供",
    })]);
  });

  it("flags split supply, missing supplier, and high return signals for action", () => {
    const rows = buildProductSupplierDecisionRows(
      [
        { familyKey: "分拆品", productName: "分拆品", skus: [
          { id: "sku-a", internalSkuCode: "A", productName: "分拆品1", specification: "1" },
          { id: "sku-b", internalSkuCode: "B", productName: "分拆品2", specification: "2" },
        ] },
        { familyKey: "待确认品", productName: "待确认品", skus: [
          { id: "sku-c", internalSkuCode: "C", productName: "待确认品", specification: "1" },
        ] },
      ],
      [
        { skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 10, supplierId: "s1", supplierName: "供应商甲" },
        { skuMasterId: "sku-b", period: "2026-07", receivedQuantity: 10, supplierId: "s2", supplierName: "供应商乙" },
        { skuMasterId: "sku-c", period: "2026-07", receivedQuantity: 10 },
      ],
      [
        { skuMasterId: "sku-a", period: "2026-07", shippedQuantity: 10, returnQuantity: 1 },
        { skuMasterId: "sku-b", period: "2026-07", shippedQuantity: 10, returnQuantity: 0 },
        { skuMasterId: "sku-c", period: "2026-07", shippedQuantity: 10, returnQuantity: 2 },
      ],
      "2026-07",
    );

    expect(rows.map((row) => row.decision)).toEqual(["review_split", "confirm_supplier"]);
    expect(rows[0].reason).toContain("供应商分拆");
    expect(rows[1].actionLabel).toBe("补充实际供应商");
  });

  it("keeps partial SKU coverage as reference instead of a supplier action", () => {
    const rows = buildProductSupplierDecisionRows(
      [{
        familyKey: "白板贴",
        productName: "白板贴",
        skus: [
          { id: "sku-a", internalSkuCode: "Y-01", productName: "白板贴60*2", specification: "60*2" },
          { id: "sku-b", internalSkuCode: "Y-02", productName: "白板贴90*2", specification: "90*2" },
        ],
      }],
      [{ skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 100, supplierId: "s1", supplierName: "供应商甲" }],
      [{ skuMasterId: "sku-a", period: "2026-07", shippedQuantity: 100, returnQuantity: 0 }],
      "2026-07",
    );

    expect(rows[0]).toMatchObject({
      coveredSkuCount: 1,
      totalSkuCount: 2,
      decision: "maintain_primary",
      actionLabel: "保持主供",
    });
  });
});
