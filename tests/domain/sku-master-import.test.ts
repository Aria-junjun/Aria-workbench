import { describe, expect, it } from "vitest";
import { parseSkuMasterRows } from "@/features/workbench/sku-master-import";

describe("SKU 主表导入解析", () => {
  it("按商品编码、商品名称、颜色及规格解析，并保留空规格警告", () => {
    const result = parseSkuMasterRows(
      [
        ["商品编码", "商品名称", "颜色及规格"],
        [" Y-01BBT ", "无胶白板贴小纸管", "0.3*0.6m*1"],
        ["Y-01SGZ", "手工皂", ""]
      ],
      { fileName: "新建 XLSX 工作表.xlsx", sheetName: "Sheet1", importedAt: "2026-08-20T00:00:00.000Z" }
    );

    expect(result.rows).toMatchObject([
      { rowNumber: 2, internalSkuCode: "Y-01BBT", productName: "无胶白板贴小纸管", specification: "0.3*0.6m*1", status: "ready" },
      { rowNumber: 3, internalSkuCode: "Y-01SGZ", productName: "手工皂", specification: "", status: "needs_spec" }
    ]);
    expect(result.warnings).toEqual([{ rowNumber: 3, code: "Y-01SGZ", message: "缺少颜色及规格，已导入但需要补充" }]);
  });

  it("拒绝重复编码和缺少必填编码/名称的行", () => {
    const result = parseSkuMasterRows([
      ["商品编码", "商品名称", "颜色及规格"],
      ["Y-01", "商品A", "规格1"],
      ["Y-01", "商品A-重复", "规格2"],
      ["", "没有编码", "规格3"],
      ["Y-02", "", "规格4"]
    ], { fileName: "test.xlsx", sheetName: "Sheet1", importedAt: "2026-08-20T00:00:00.000Z" });

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([
      { rowNumber: 3, code: "Y-01", message: "商品编码重复，已跳过" },
      { rowNumber: 4, code: "", message: "缺少商品编码，已跳过" },
      { rowNumber: 5, code: "Y-02", message: "缺少商品名称，已跳过" }
    ]);
  });

  it("校验表头，避免把错误表格写入主表", () => {
    expect(() => parseSkuMasterRows([["编码", "名称", "规格"]], {
      fileName: "bad.xlsx", sheetName: "Sheet1", importedAt: "2026-08-20T00:00:00.000Z"
    })).toThrow("表头不匹配");
  });
});
