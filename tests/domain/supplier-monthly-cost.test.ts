import { describe, expect, it } from "vitest";
import { buildSupplierMonthlyCostRows, mergeInboundCostFacts, offerMatchesFamily } from "@/features/workbench/supplier-monthly-cost";

describe("supplier monthly cost linkage", () => {
  it("merges repeated inbound rows by total amount and quantity", () => {
    const result = mergeInboundCostFacts([
      { key: "sku-a", receivedQuantity: 100, settlementUnitPrice: 10, settlementAmount: 1000 },
      { key: "sku-a", receivedQuantity: 50, settlementUnitPrice: 12, settlementAmount: 600 },
    ]);

    expect(result).toEqual([{ key: "sku-a", receivedQuantity: 150, settlementUnitPrice: 10.666666666666666, settlementAmount: 1600 }]);
  });

  it("uses imported settlement values and matched offer prices by SKU without mixing families", () => {
    const result = buildSupplierMonthlyCostRows({
      supplierId: "supplier-1",
      period: "2026-07",
      skuMasters: [
        { id: "sku-a", internalSkuCode: "Y-05BBT", productName: "白板贴", specification: "0.45*10m", productFamilyKey: "白板贴", status: "ready", source: "excel", importedAt: "now" },
        { id: "sku-b", internalSkuCode: "Y-05BBT-8", productName: "白板贴", specification: "0.45*10m+8支笔", productFamilyKey: "白板贴", status: "ready", source: "excel", importedAt: "now" },
        { id: "sku-c", internalSkuCode: "静电白板", productName: "静电白板", specification: "0.6*2m", productFamilyKey: "静电白板", status: "ready", source: "excel", importedAt: "now" },
      ],
      inboundRows: [
        { id: "in-a", skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 100, settlementUnitPrice: 10, supplierId: "supplier-1", sourceFileName: "july.xlsx", sourceSheetName: "Sheet1", importedAt: "now" },
        { id: "in-b", skuMasterId: "sku-b", period: "2026-07", receivedQuantity: 50, settlementUnitPrice: 12, supplierId: "supplier-1", sourceFileName: "july.xlsx", sourceSheetName: "Sheet1", importedAt: "now" },
        { id: "in-c", skuMasterId: "sku-c", period: "2026-07", receivedQuantity: 80, settlementUnitPrice: 20, supplierId: "supplier-2", sourceFileName: "july.xlsx", sourceSheetName: "Sheet1", importedAt: "now" },
      ],
      offers: [{
        id: "offer-1", supplierId: "supplier-1", productName: "白板贴", name: "白板贴货盘报价", createdAt: "now",
        skus: [
          { id: "offer-a", specName: "0.45*10m", unitPrice: 9 },
          { id: "offer-b", specName: "0.45*10m+8支笔", unitPrice: 11 },
        ],
      }],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ productFamilyKey: "白板贴", purchaseQuantity: 150, baselineCost: 1450, settlementCost: 1600 });
    expect(result[0].skuRows).toHaveLength(2);
  });

  it("marks a family as pending when a settlement or baseline price cannot be matched", () => {
    const result = buildSupplierMonthlyCostRows({
      supplierId: "supplier-1",
      period: "2026-07",
      skuMasters: [{ id: "sku-a", internalSkuCode: "Y-05BBT", productName: "白板贴", specification: "0.45*10m", productFamilyKey: "白板贴", status: "ready", source: "excel", importedAt: "now" }],
      inboundRows: [{ id: "in-a", skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 100, supplierId: "supplier-1", sourceFileName: "july.xlsx", sourceSheetName: "Sheet1", importedAt: "now" }],
      offers: [],
    });

    expect(result[0].status).toBe("pending_review");
    expect(result[0].baselineCost).toBeUndefined();
  });

  it("matches supplier centimeter dimensions to SKU meter dimensions", () => {
    const result = buildSupplierMonthlyCostRows({
      supplierId: "supplier-1",
      period: "2026-06",
      skuMasters: [{ id: "sku-a", internalSkuCode: "Y-10BBT", productName: "白板贴", specification: "0.9*2m*1", productFamilyKey: "白板贴", status: "ready", source: "excel", importedAt: "now" }],
      inboundRows: [{ id: "in-a", skuMasterId: "sku-a", period: "2026-06", receivedQuantity: 10, settlementUnitPrice: 3.4, supplierId: "supplier-1", sourceFileName: "june.xlsx", sourceSheetName: "Sheet1", importedAt: "now" }],
      offers: [{ id: "offer-1", supplierId: "supplier-1", productName: "白板贴", name: "白板贴货盘报价", createdAt: "now", skus: [{ id: "offer-a", specName: "90CM*2米", unitPrice: 3.4 }, { id: "offer-b", specName: "120CM*2米", unitPrice: 4.8 }] }],
    });
    expect(result[0].status).toBe("measured");
    expect(result[0].baselineCost).toBe(34);
  });

  it("recognizes whiteboard and matte family synonyms when finding a supplier offer", () => {
    expect(offerMatchesFamily({ id: "w", name: "聚赢 - 白板贴/静电白板", category: "白板贴/静电白板", supplierName: "聚赢", createdAt: "now" }, "无胶白板贴小纸管")).toBe(true);
    expect(offerMatchesFamily({ id: "m", name: "聚赢 - 哑光墙贴/静电保护膜（哑面款）", category: "哑光墙贴/静电保护膜", supplierName: "聚赢", createdAt: "now" }, "静电哑光墙贴")).toBe(true);
    expect(offerMatchesFamily({ id: "m", name: "聚赢 - 哑光墙贴/静电保护膜（哑面款）", category: "哑光墙贴/静电保护膜", supplierName: "聚赢", createdAt: "now" }, "无胶白板贴小纸管")).toBe(false);
  });
});
