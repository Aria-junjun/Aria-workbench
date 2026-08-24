import { describe, expect, it } from "vitest";
import { buildSupplierAutoEvidence } from "@/features/workbench/supplier-evaluation";

describe("supplier automatic evidence", () => {
  it("calculates quality reference from shipped and returned quantities", () => {
    const result = buildSupplierAutoEvidence({
      supplierId: "supplier-a",
      period: "2026-07",
      periodType: "month",
      inboundSnapshots: [
        { skuMasterId: "sku-1", period: "2026-07", supplierId: "supplier-a", receivedQuantity: 500 },
        { skuMasterId: "sku-2", period: "2026-07", supplierId: "supplier-a", receivedQuantity: 300 },
      ],
      operatingSnapshots: [
        { skuMasterId: "sku-1", period: "2026-07", shippedQuantity: 100, returnQuantity: 4, erpCostPrice: 7.8 },
        { skuMasterId: "sku-2", period: "2026-07", shippedQuantity: 50, returnQuantity: 1, erpCostPrice: 4.2 },
      ],
    });

    expect(result).toMatchObject({
      inboundSkuCount: 2,
      inboundQuantity: 800,
      shippedQuantity: 150,
      returnQuantity: 5,
      returnRate: 3.33,
      qualityScore: 96.67,
      dataCoveragePct: 100,
    });
  });

  it("does not invent a score when no operating data is available", () => {
    const result = buildSupplierAutoEvidence({
      supplierId: "supplier-a",
      period: "2026-07",
      periodType: "month",
      inboundSnapshots: [{ skuMasterId: "sku-1", period: "2026-07", supplierId: "supplier-a", receivedQuantity: 500 }],
      operatingSnapshots: [],
    });

    expect(result.qualityScore).toBeUndefined();
    expect(result.returnRate).toBeUndefined();
    expect(result.dataCoveragePct).toBe(0);
  });
});
