import { describe, expect, it } from "vitest";
import { parseSupplierInboundRows } from "@/features/workbench/supplier-inbound-import";

describe("supplier inbound workbook import", () => {
  it("detects headers after title rows, carries down merged cells, and ignores summaries", () => {
    const result = parseSupplierInboundRows([
      ["供应商对账单"],
      ["供货单位："],
      [],
      ["送货日期", "产品名称", "产品规格", "送货数量", "单位", "单价", "金额"],
      ["2026-07-02", "白板贴", "0.45*2m", 500, "卷", 1.5, 750],
      ["", "", "0.45*3m", 300, "卷", 2, 600],
      ["2026-07-03", "哑光墙贴", "60*2m", 260, "卷", 3, 780],
      ["合计", "", "", 1060, "", "", 2130],
      ["本月货款", "", "", "", "", "", 2130],
      ["供应商确认：", "", "", "", "", "", ""]
    ], { fileName: "销售7月份对账单.xlsx", sheetName: "Sheet1", importedAt: "2026-08-22T00:00:00.000Z" });

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((row) => row.receivedQuantity)).toEqual([500, 300, 260]);
    expect(result.rows[1]).toMatchObject({ deliveryDate: "2026-07-02", supplierProductName: "白板贴", supplierSpec: "0.45*3m" });
    expect(result.summary).toEqual({ rowCount: 3, totalReceivedQuantity: 1060, totalAmount: 2130 });
    expect(result.detectedHeaders).toEqual(expect.arrayContaining(["送货日期", "产品名称", "产品规格", "送货数量"]));
  });

  it("reports malformed quantity without dropping the rest of the sheet", () => {
    const result = parseSupplierInboundRows([
      ["产品名称", "产品规格", "数量"],
      ["白板贴", "0.45*2m", "待确认"],
      ["哑光墙贴", "60*2m", 10]
    ], { fileName: "supplier.xlsx", sheetName: "Sheet1", importedAt: "2026-08-22T00:00:00.000Z" });

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([{ rowNumber: 2, code: "INVALID_QUANTITY", message: "送货数量不是有效数字" }]);
  });
});
