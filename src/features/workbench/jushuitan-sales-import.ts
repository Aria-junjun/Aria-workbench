export type JushuitanSalesImportRow = {
  rowNumber: number;
  internalSkuCode: string;
  productName: string;
  specification: string;
  monthlySales?: number;
  netSalesQuantity?: number;
  salesAmount?: number;
  erpCostPrice?: number;
  shippedQuantity?: number;
  returnQuantity?: number;
  returnRate?: number;
  source: "imported";
  sourceFileName: string;
  sourceSheetName: string;
  importedAt: string;
};

export type JushuitanSalesImportIssue = {
  rowNumber: number;
  code: string;
  message: string;
};

export type JushuitanSalesImportResult = {
  rows: JushuitanSalesImportRow[];
  errors: JushuitanSalesImportIssue[];
  costField?: "成本价" | "实发成本" | "销售成本" | "净销售成本";
};

export function formatJushuitanImportError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  if (/array buffer allocation failed|invalid array length|out of memory/i.test(message)) {
    return "表格压缩格式无法读取。请将聚水潭表格另存为普通 .xlsx 后再导入，原有数据不会受影响。";
  }
  if (/zip|workbook|worksheet|excel/i.test(message)) {
    return "聚水潭表格读取失败。请确认文件为 .xlsx、.xls 或 .csv 格式，并且第一张工作表包含“商品编码”列。";
  }
  return "聚水潭表格读取失败，请确认文件格式和表头后重试。";
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberValue(value: unknown): number | undefined {
  const normalized = text(value).replace(/,/g, "").replace(/%$/, "");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstValue(row: unknown[], indexes: Map<string, number>, names: string[]): unknown {
  for (const name of names) {
    const index = indexes.get(name);
    if (index !== undefined) return row[index];
  }
  return undefined;
}

export function parseJushuitanSalesRows(
  rawRows: unknown[][],
  meta: { fileName: string; sheetName: string; importedAt: string }
): JushuitanSalesImportResult {
  const headers = (rawRows[0] ?? []).map(text);
  const indexes = new Map(headers.map((header, index) => [header, index]));
  if (!indexes.has("商品编码")) throw new Error("表头不匹配：缺少“商品编码”");

  const rows: JushuitanSalesImportRow[] = [];
  const errors: JushuitanSalesImportIssue[] = [];
  const seenCodes = new Set<string>();
  const costField = (["成本价", "实发成本", "销售成本", "净销售成本"] as const).find((name) => indexes.has(name));

  rawRows.slice(1).forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const internalSkuCode = text(firstValue(rawRow, indexes, ["商品编码"]));
    if (!internalSkuCode) return;
    if (seenCodes.has(internalSkuCode)) {
      errors.push({ rowNumber, code: internalSkuCode, message: "商品编码重复，已跳过" });
      return;
    }
    seenCodes.add(internalSkuCode);

    const shippedQuantity = numberValue(firstValue(rawRow, indexes, ["实发数量", "销售数量"]));
    const returnQuantity = numberValue(firstValue(rawRow, indexes, ["实退数量", "退货数量"]));
    const netSalesQuantity = numberValue(firstValue(rawRow, indexes, ["净销量"]));
    const monthlySales = shippedQuantity ?? netSalesQuantity;
    const salesAmount = numberValue(firstValue(rawRow, indexes, ["净销售额", "实发金额", "销售金额"]));
    const returnRate = shippedQuantity && returnQuantity !== undefined
      ? Number(((returnQuantity / shippedQuantity) * 100).toFixed(2))
      : undefined;
    const directCost = numberValue(firstValue(rawRow, indexes, ["成本价"]));
    const totalCost = numberValue(firstValue(rawRow, indexes, ["实发成本", "销售成本", "净销售成本"]));
    const erpCostPrice = directCost ?? (totalCost !== undefined && monthlySales && monthlySales > 0
      ? Number((totalCost / monthlySales).toFixed(3))
      : undefined);

    rows.push({
      rowNumber,
      internalSkuCode,
      productName: text(firstValue(rawRow, indexes, ["商品简称", "商品名称"])),
      specification: text(firstValue(rawRow, indexes, ["颜色规格", "颜色及规格"])),
      monthlySales,
      netSalesQuantity,
      salesAmount,
      erpCostPrice,
      shippedQuantity,
      returnQuantity,
      returnRate,
      source: "imported",
      sourceFileName: meta.fileName,
      sourceSheetName: meta.sheetName,
      importedAt: meta.importedAt
    });
  });

  return { rows, errors, ...(costField ? { costField } : {}) };
}
