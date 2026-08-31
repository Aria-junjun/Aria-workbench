import { describe, expect, it } from "vitest";
import type { LocalProductSupplierAssignment } from "@/features/workbench/local-store";
import { classifySkuRelationship, formatSkuRelationshipStatus, getActiveProductSupplierAssignments } from "@/features/workbench/relationship-rules";

const familyPrimary = (supplierName: string): LocalProductSupplierAssignment => ({
  id: `family-${supplierName}`,
  productFamilyKey: "白板贴",
  supplierId: supplierName === "供应商A" ? "supplier-a" : "supplier-b",
  supplierName,
  role: "primary",
  effectiveFrom: "2026-01",
  status: "active",
  source: "manual",
});

describe("SKU relationship rules", () => {
  it("returns the active primary and backup suppliers for a product family", () => {
    const assignments = [
      familyPrimary("供应商A"),
      { ...familyPrimary("供应商B"), id: "backup", role: "backup" as const },
    ];

    expect(getActiveProductSupplierAssignments(assignments, "白板贴", "2026-08").map((item) => [item.role, item.supplierName])).toEqual([
      ["primary", "供应商A"],
      ["backup", "供应商B"],
    ]);
  });

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

  it("uses the product-family primary supplier for every SKU by default", () => {
    const result = classifySkuRelationship({
      skuMasterId: "sku-a",
      skuCode: "Y-01",
      productFamilyKey: "白板贴",
      period: "2026-07",
      offerLinks: [],
      assignments: [],
      productSupplierAssignments: [familyPrimary("供应商A")],
      inboundFacts: [],
    });

    expect(result.supplyStatus).toBe("assigned");
    expect(result.supplierName).toBe("供应商A");
    expect(result.supplierRelationshipSource).toBe("family_assignment");
  });

  it("lets a SKU exception override the family default", () => {
    const result = classifySkuRelationship({
      skuMasterId: "sku-a",
      skuCode: "Y-02",
      productFamilyKey: "白板贴",
      period: "2026-07",
      offerLinks: [],
      assignments: [{ id: "sku-exception", skuCode: "Y-02", supplierName: "供应商B", effectiveFrom: "2026-07", status: "active", source: "manual" }],
      productSupplierAssignments: [familyPrimary("供应商A")],
      inboundFacts: [],
    });

    expect(result.supplierName).toBe("供应商B");
    expect(result.supplierRelationshipSource).toBe("sku_assignment");
  });

  it("does not turn a matched offer into a primary supplier", () => {
    const result = classifySkuRelationship({
      skuMasterId: "sku-a",
      skuCode: "Y-01",
      productFamilyKey: "白板贴",
      period: "2026-07",
      offerLinks: [{ id: "link-1", skuMasterId: "sku-a", offerId: "offer-a", status: "confirmed", confirmedAt: "2026-07-01" }],
      assignments: [],
      productSupplierAssignments: [],
      inboundFacts: [],
    });

    expect(result.supplyStatus).toBe("unconfirmed");
    expect(result.supplierRelationshipSource).toBe("offer_match");
  });
});
