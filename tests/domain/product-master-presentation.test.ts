import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { deriveOperatingProductCode, getProductFamilyAttention, getSkuOperatingRole, isCompositeSalesSku } from "@/features/workbench/product-master-presentation";

describe("product family attention presentation", () => {
  it("prioritizes supplier coverage and return rate warnings", () => {
    expect(getProductFamilyAttention({ pendingSkuCount: 2, returnRate: 6.2, currentSales: 20, previousSales: 30, hasCurrentData: true })).toEqual([
      "供应覆盖待补",
      "退货率需复核",
    ]);
  });

  it("shows sales decline when there is no higher-priority warning", () => {
    expect(getProductFamilyAttention({ pendingSkuCount: 0, returnRate: 1.2, currentSales: 20, previousSales: 30, hasCurrentData: true })).toEqual([
      "实发较上月下降",
    ]);
  });

  it("falls back to missing data or no anomaly", () => {
    expect(getProductFamilyAttention({ pendingSkuCount: 0, hasCurrentData: false })).toEqual(["经营数据待补"]);
    expect(getProductFamilyAttention({ pendingSkuCount: 0, returnRate: 1.2, currentSales: 30, previousSales: 20, hasCurrentData: true })).toEqual(["当前无明显异常"]);
  });

  it("recognizes sales bundles without treating them as a missing inbound SKU", () => {
    expect(isCompositeSalesSku("无胶白板贴小纸管+8支彩色白板笔")).toBe(true);
    expect(isCompositeSalesSku("白板贴 90CM*2M")).toBe(false);
  });

  it("uses the existing base code as the operating product code without creating another level", () => {
    const skus = [
      { internalSkuCode: "Y-05BBT", productName: "白板贴", specification: "90*2" },
      { internalSkuCode: "Y-05BBT-8", productName: "白板贴+8支笔", specification: "90*2" },
    ];
    expect(deriveOperatingProductCode(skus)).toBe("Y-05BBT");
    expect(getSkuOperatingRole("Y-05BBT", "Y-05BBT")).toBe("采购/供货 SKU");
    expect(getSkuOperatingRole("Y-05BBT-8", "Y-05BBT")).toBe("销售变体");
  });

  it("keeps the product table header on one visual line with aligned column rules", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/product-master/page.tsx"), "utf8");

    expect(source).toContain("table-fixed");
    expect(source).toContain("whitespace-nowrap");
    expect(source).toContain("供应方案 <HelpHint");
    expect(source).toContain("text-center");
    expect(source).toContain("min-w-[1160px]");
  });
});
