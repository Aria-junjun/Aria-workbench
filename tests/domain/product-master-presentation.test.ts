import { describe, expect, it } from "vitest";
import { getProductFamilyAttention } from "@/features/workbench/product-master-presentation";

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
});
