import { describe, expect, it } from "vitest";
import { suggestInboundSku } from "@/components/workbench/supplier-inbound-import-preview";

describe("supplier inbound SKU matching", () => {
  const skuMasters = [
    { id: "sku-90-2", internalSkuCode: "Y-90-2", productName: "白板贴", specification: "90CM*2M", status: "ready" as const, source: "manual" as const, importedAt: "now" },
    { id: "sku-90-5", internalSkuCode: "Y-90-5", productName: "白板贴", specification: "90CM*5M", status: "ready" as const, source: "manual" as const, importedAt: "now" },
  ];

  it("matches equivalent dimension formats from a settlement sheet", () => {
    expect(suggestInboundSku({ supplierProductName: "白板贴", supplierSpec: "90*2" }, skuMasters)).toBe("sku-90-2");
  });

  it("does not match an ambiguous product/specification", () => {
    expect(suggestInboundSku({ supplierProductName: "白板贴", supplierSpec: "90" }, skuMasters)).toBeUndefined();
  });

  it("reuses a confirmed supplier-family relationship when names differ", () => {
    expect(suggestInboundSku(
      { supplierProductName: "白板墙贴", supplierSpec: "90*2" },
      [{ ...skuMasters[0], productName: "无胶白板贴小纸管", productFamilyKey: "whiteboard-family" }],
      {
        supplierId: "supplier-a",
        period: "2026-08",
        assignments: [{
          id: "assignment-1",
          productFamilyKey: "whiteboard-family",
          supplierId: "supplier-a",
          supplierName: "供应商A",
          role: "primary",
          effectiveFrom: "2026-07",
          status: "active",
          source: "manual",
        }],
      },
    )).toBe("sku-90-2");
  });
});
