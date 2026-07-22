import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { extractWorkbenchFileText } from "@/features/workbench/file-text";

describe("extractWorkbenchFileText", () => {
  it("reads plain text files", () => {
    const text = extractWorkbenchFileText({
      fileName: "quote.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("供应商名称：武汉晟誉包装\n报价：47元/件", "utf8")
    });

    expect(text).toContain("供应商名称：武汉晟誉包装");
    expect(text).toContain("报价：47元/件");
  });

  it("reads csv files as text", () => {
    const text = extractWorkbenchFileText({
      fileName: "quote.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("结构类型,宽度(cm),长度(M),单价\n单层加厚,100,50,47", "utf8")
    });

    expect(text).toContain("结构类型,宽度(cm),长度(M),单价");
    expect(text).toContain("单层加厚,100,50,47");
  });

  it("converts xlsx sheets into readable tabular text", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["供应商名称", "武汉晟誉包装制品有限公司"],
      ["货盘名称", "加厚气泡膜卷装采购报价单"],
      ["结构类型", "宽度(cm)", "长度(M)", "重量(斤)", "单价"],
      ["单层加厚", 100, 50, 6, 47],
      ["双层加厚", 100, 40, 6, 47]
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "报价单");
    const buffer = Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));

    const text = extractWorkbenchFileText({
      fileName: "气泡膜报价单.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer
    });

    expect(text).toContain("【文件】气泡膜报价单.xlsx");
    expect(text).toContain("【工作表】报价单");
    expect(text).toContain("供应商名称\t武汉晟誉包装制品有限公司");
    expect(text).toContain("单层加厚\t100\t50\t6\t47");
  });

  it("rejects unsupported files", () => {
    expect(() =>
      extractWorkbenchFileText({
        fileName: "quote.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("pdf")
      })
    ).toThrow("暂不支持这个文件类型");
  });
});
