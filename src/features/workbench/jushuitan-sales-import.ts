export type JushuitanSalesImportRow = {
  rowNumber: number;
  internalSkuCode: string;
  productName: string;
  specification: string;
  monthlySales?: number;
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
};

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
    const monthlySales = numberValue(firstValue(rawRow, indexes, ["净销量"])) ?? shippedQuantity;
    const salesAmount = numberValue(firstValue(rawRow, indexes, ["净销售额", "实发金额", "销售金额"]));
    const returnRate = shippedQuantity && returnQuantity !== undefined
      ? Number(((returnQuantity / shippedQuantity) * 100).toFixed(2))
      : undefined;

    rows.push({
      rowNumber,
      internalSkuCode,
      productName: text(firstValue(rawRow, indexes, ["商品简称", "商品名称"])),
      specification: text(firstValue(rawRow, indexes, ["颜色规格", "颜色及规格"])),
      monthlySales,
      salesAmount,
      erpCostPrice: numberValue(firstValue(rawRow, indexes, ["成本价"])),
      shippedQuantity,
      returnQuantity,
      returnRate,
      source: "imported",
      sourceFileName: meta.fileName,
      sourceSheetName: meta.sheetName,
      importedAt: meta.importedAt
    });
  });

  return { rows, errors };
}
