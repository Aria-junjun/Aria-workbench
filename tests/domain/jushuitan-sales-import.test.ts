import { describe, expect, it } from "vitest";
import { formatJushuitanImportError, parseJushuitanSalesRows } from "@/features/workbench/jushuitan-sales-import";

describe("Jushuitan sales import", () => {
  it("turns low-level workbook allocation errors into an actionable message", () => {
    expect(formatJushuitanImportError(new RangeError("Array buffer allocation failed"))).toContain("另存为普通 .xlsx");
  });

  it("maps product management fields and ignores the total row", () => {
    const result = parseJushuitanSalesRows([
      ["图片", "商品编码", "颜色规格", "商品简称", "成本价", "销售数量", "实发数量", "实发金额", "实退数量", "净销量", "净销售额"],
      ["", "Y-10BBT-8", "90CM*2M", "白板贴+白板笔", "7.8750", "1538", "1538", "39571.75", "55", "1443", "37404.61"],
      ["", "", "", "", "", "6243", "6241", "162874.66", "304", "5727", "150148.47"]
    ], { fileName: "销售表.xlsx", sheetName: "Sheet1", importedAt: "2026-08-22T00:00:00.000Z" });

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      internalSkuCode: "Y-10BBT-8",
      productName: "白板贴+白板笔",
      specification: "90CM*2M",
      monthlySales: 1538,
      netSalesQuantity: 1443,
      salesAmount: 37404.61,
      erpCostPrice: 7.875,
      shippedQuantity: 1538,
      returnQuantity: 55,
      returnRate: 3.58,
      source: "imported"
    });
  });

  it("uses shipped quantity as the product-management sales volume", () => {
    const result = parseJushuitanSalesRows([
      ["商品编码", "实发数量", "实退数量", "净销量"],
      ["Y-01", "100", "4", "96"]
    ], { fileName: "销售表.xlsx", sheetName: "Sheet1", importedAt: "2026-08-22T00:00:00.000Z" });

    expect(result.rows[0]).toMatchObject({ monthlySales: 100, netSalesQuantity: 96, returnRate: 4 });
  });

  it("ignores a blank-code total row", () => {
    const result = parseJushuitanSalesRows([
      ["商品编码", "商品简称", "净销量"],
      ["", "汇总", "100"],
      ["Y-01", "白板贴", "10"]
    ], { fileName: "销售表.xlsx", sheetName: "Sheet1", importedAt: "2026-08-22T00:00:00.000Z" });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].internalSkuCode).toBe("Y-01");
    expect(result.errors).toHaveLength(0);
  });
});
