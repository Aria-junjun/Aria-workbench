import { describe, expect, it } from "vitest";
import { findSupplierAssignmentAtPeriod, parseSkuCompositionCode } from "@/features/workbench/sku-composition";

describe("SKU composition domain", () => {
  it("suggests a base SKU for a confirmed-looking bundle name", () => {
    expect(parseSkuCompositionCode("Y-02BBT-8", "无胶白板贴0.45*2m+8支彩色白板笔")).toEqual({
      baseSkuCode: "Y-02BBT",
      accessoryCount: 8,
      confidence: "suggested",
    });
  });

  it("keeps the exact base SKU unchanged", () => {
    expect(parseSkuCompositionCode("Y-02BBT", "无胶白板贴0.45*2m")).toEqual({
      baseSkuCode: "Y-02BBT",
      confidence: "exact",
    });
  });

  it("does not infer a bundle when the product name does not support it", () => {
    expect(parseSkuCompositionCode("Y-02BBT-8", "无胶白板贴0.45*2m")).toEqual({
      confidence: "manual",
    });
  });

  it("uses the assignment effective in the requested month", () => {
    const assignments = [
      { id: "july", skuCode: "Y-02BBT", supplierName: "供应商A", effectiveFrom: "2026-07", status: "active" as const, source: "manual" as const },
      { id: "august", skuCode: "Y-02BBT", supplierName: "供应商B", effectiveFrom: "2026-08", status: "active" as const, source: "manual" as const },
    ];
    expect(findSupplierAssignmentAtPeriod(assignments, "Y-02BBT", "2026-07")?.supplierName).toBe("供应商A");
    expect(findSupplierAssignmentAtPeriod(assignments, "Y-02BBT", "2026-08")?.supplierName).toBe("供应商B");
  });
});
