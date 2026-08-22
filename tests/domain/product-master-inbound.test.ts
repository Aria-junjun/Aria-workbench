import { describe, expect, it } from "vitest";
import { buildProductInboundSummary } from "@/features/workbench/product-master";

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
});
