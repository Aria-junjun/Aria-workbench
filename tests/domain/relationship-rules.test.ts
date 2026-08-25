import { describe, expect, it } from "vitest";
import { classifySkuRelationship, formatSkuRelationshipStatus } from "@/features/workbench/relationship-rules";

describe("SKU relationship rules", () => {
  it("treats a confirmed offer link as a match but does not infer a primary supplier", () => {
    const result = classifySkuRelationship({
      skuMasterId: "sku-a",
      skuCode: "Y-01",
      period: "2026-07",
      offerLinks: [{ id: "link-1", skuMasterId: "sku-a", offerId: "offer-a", status: "confirmed", confirmedAt: "2026-07-01" }],
      assignments: [],
      inboundFacts: [],
    });

    expect(result.matchStatus).toBe("matched");
    expect(result.supplyStatus).toBe("unconfirmed");
    expect(result.supplierName).toBeUndefined();
  });

  it("uses the active assignment for the requested month only", () => {
    const result = classifySkuRelationship({
      skuMasterId: "sku-a",
      skuCode: "Y-01",
      period: "2026-07",
      offerLinks: [],
      assignments: [
        { id: "old", skuCode: "Y-01", supplierName: "供应商甲", effectiveFrom: "2026-01", effectiveTo: "2026-06", status: "ended", source: "manual" },
        { id: "current", skuCode: "Y-01", supplierName: "供应商乙", effectiveFrom: "2026-07", status: "active", source: "manual" },
      ],
      inboundFacts: [],
    });

    expect(result.supplyStatus).toBe("assigned");
    expect(result.supplierName).toBe("供应商乙");
  });

  it("keeps revoked links and missing supplier evidence out of the confirmed relationship", () => {
    const result = classifySkuRelationship({
      skuMasterId: "sku-a",
      skuCode: "Y-01",
      period: "2026-07",
      offerLinks: [{ id: "link-1", skuMasterId: "sku-a", offerId: "offer-a", status: "revoked", confirmedAt: "2026-07-01" }],
      assignments: [],
      inboundFacts: [{ skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 10 }],
    });

    expect(result.matchStatus).toBe("unmatched");
    expect(result.supplyStatus).toBe("supplier_unconfirmed");
  });

  it("uses distinct labels for matching and actual supply", () => {
    expect(formatSkuRelationshipStatus({
      matchStatus: "matched",
      supplyStatus: "unconfirmed",
    })).toEqual({ matchLabel: "货盘已匹配", supplyLabel: "实际供应待确认" });
  });
});
