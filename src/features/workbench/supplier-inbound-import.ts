export type SupplierInboundImportRow = {
  rowNumber: number;
  deliveryDate?: string;
  supplierName?: string;
  supplierProductName: string;
  supplierSpec: string;
  receivedQuantity: number;
  unit?: string;
  unitPrice?: number;
  amount?: number;
  sourceFileName: string;
  sourceSheetName: string;
  importedAt: string;
};

export type SupplierInboundImportIssue = {
  rowNumber: number;
  code: string;
  message: string;
};

export type SupplierInboundImportResult = {
  rows: SupplierInboundImportRow[];
  errors: SupplierInboundImportIssue[];
  detectedHeaders: string[];
  summary: { rowCount: number; rawRowCount?: number; totalReceivedQuantity: number; totalAmount?: number };
};

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberValue(value: unknown): number | undefined {
  const normalized = text(value).replace(/,/g, "").replace(/[￥¥元]/g, "");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeHeader(value: unknown): string {
  return text(value).replace(/[\s（）()：:]/g, "").toLowerCase();
}

function findHeaderIndex(headers: string[], aliases: string[]): number | undefined {
  const normalized = new Set(aliases.map(normalizeHeader));
  const index = headers.findIndex((header) => normalized.has(normalizeHeader(header)));
  return index >= 0 ? index : undefined;
}

function rowLooksLikeSummary(row: unknown[]): boolean {
  const joined = row.map(text).join(" ");
  return /合计|本月货款|截止上月|截止本月|本月已收款|本月已开|供应商确认|供应商签字|客户确认|日\s*期|备注/.test(joined);
}

function dateValue(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(raw)) return raw.replace(/[/.]/g, "-");
  const serial = Number(raw);
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return raw;
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function firstNonEmpty(row: unknown[], index: number | undefined): string | undefined {
  if (index === undefined) return undefined;
  const value = text(row[index]);
  return value || undefined;
}

function normalizeMergeKey(value: string): string {
  return value.toLowerCase().replace(/[\s*×xX·＋+\-_/（）()]/g, "");
}

export function mergeSupplierInboundRows(rows: SupplierInboundImportRow[]): SupplierInboundImportRow[] {
  const merged = new Map<string, SupplierInboundImportRow>();
  for (const row of rows) {
    const key = `${normalizeMergeKey(row.supplierProductName)}|${normalizeMergeKey(row.supplierSpec)}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row });
      continue;
    }
    const sameUnitPrice = existing.unitPrice === row.unitPrice;
    merged.set(key, {
      ...existing,
      receivedQuantity: existing.receivedQuantity + row.receivedQuantity,
      amount: existing.amount !== undefined && row.amount !== undefined ? existing.amount + row.amount : existing.amount ?? row.amount,
      unitPrice: sameUnitPrice ? existing.unitPrice : undefined,
    });
  }
  return [...merged.values()];
}

export function formatSupplierInboundImportError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  if (/array buffer allocation failed|invalid array length|out of memory/i.test(message)) {
    return "表格压缩格式无法读取。请将供应商对账表另存为普通 .xlsx 后再导入，原有数据不会受影响。";
  }
  return "供应商对账表读取失败，请确认文件包含产品名称、产品规格和数量列。";
}

export function parseSupplierInboundRows(
  rawRows: unknown[][],
  meta: { fileName: string; sheetName: string; importedAt: string }
): SupplierInboundImportResult {
  const headerRowIndex = rawRows.findIndex((row) => {
    const headers = row.map(text);
    return findHeaderIndex(headers, ["产品名称", "商品名称", "货品名称", "货品", "存货名称", "存货"]) !== undefined
      && findHeaderIndex(headers, ["产品规格", "规格", "型号", "颜色及规格", "规格型号"]) !== undefined
      && findHeaderIndex(headers, ["送货数量", "入库数量", "数量", "送货数"]) !== undefined;
  });
  if (headerRowIndex < 0) throw new Error("表头不匹配：缺少产品名称/存货名称、产品规格/规格型号或数量");

  const headers = rawRows[headerRowIndex].map(text);
  const productIndex = findHeaderIndex(headers, ["产品名称", "商品名称", "货品名称", "货品", "存货名称", "存货"]);
  const specIndex = findHeaderIndex(headers, ["产品规格", "规格", "型号", "颜色及规格", "规格型号"]);
  const quantityIndex = findHeaderIndex(headers, ["送货数量", "入库数量", "数量", "送货数"]);
  const dateIndex = findHeaderIndex(headers, ["送货日期", "日期", "入库日期", "交货日期", "单据日期"]);
  const unitIndex = findHeaderIndex(headers, ["单位", "计量单位"]);
  const priceIndex = findHeaderIndex(headers, ["单价", "采购价", "供货价"]);
  const amountIndex = findHeaderIndex(headers, ["金额", "合计金额", "货款", "总金额"]);
  const supplierIndex = findHeaderIndex(headers, ["供货单位", "供应商", "厂家", "供货方"]);
  const rows: SupplierInboundImportRow[] = [];
  const errors: SupplierInboundImportIssue[] = [];
  let lastDate: string | undefined;
  let lastProductName: string | undefined;

  rawRows.slice(headerRowIndex + 1).forEach((rawRow, offset) => {
    const rowNumber = headerRowIndex + offset + 2;
    if (!rawRow.some((value) => text(value)) || rowLooksLikeSummary(rawRow)) return;
    const rawDate = firstNonEmpty(rawRow, dateIndex);
    const deliveryDate = (rawDate ? dateValue(rawDate) : undefined) ?? lastDate;
    const supplierProductName = firstNonEmpty(rawRow, productIndex) ?? lastProductName;
    const supplierSpec = firstNonEmpty(rawRow, specIndex);
    const rawQuantity = firstNonEmpty(rawRow, quantityIndex);
    if (firstNonEmpty(rawRow, dateIndex)) lastDate = deliveryDate;
    if (firstNonEmpty(rawRow, productIndex)) lastProductName = supplierProductName;
    if (!supplierProductName || !supplierSpec) {
      errors.push({ rowNumber, code: "MISSING_PRODUCT", message: "缺少产品名称或产品规格" });
      return;
    }
    const receivedQuantity = numberValue(rawQuantity);
    if (receivedQuantity === undefined || receivedQuantity < 0) {
      errors.push({ rowNumber, code: "INVALID_QUANTITY", message: "送货数量不是有效数字" });
      return;
    }
    rows.push({
      rowNumber,
      deliveryDate,
      supplierName: firstNonEmpty(rawRow, supplierIndex),
      supplierProductName,
      supplierSpec,
      receivedQuantity,
      unit: firstNonEmpty(rawRow, unitIndex),
      unitPrice: numberValue(firstNonEmpty(rawRow, priceIndex)),
      amount: numberValue(firstNonEmpty(rawRow, amountIndex)),
      sourceFileName: meta.fileName,
      sourceSheetName: meta.sheetName,
      importedAt: meta.importedAt
    });
  });

  const rawRowCount = rows.length;
  const mergedRows = mergeSupplierInboundRows(rows);
  const totalAmount = mergedRows.map((row) => row.amount).filter((value): value is number => value !== undefined).reduce((sum, value) => sum + value, 0);
  return {
    rows: mergedRows,
    errors,
    detectedHeaders: headers,
    summary: {
      rowCount: mergedRows.length,
      rawRowCount,
      totalReceivedQuantity: mergedRows.reduce((sum, row) => sum + row.receivedQuantity, 0),
      totalAmount: mergedRows.some((row) => row.amount !== undefined) ? totalAmount : undefined
    }
  };
}
