export const SKU_MASTER_HEADERS = ["商品编码", "商品名称", "颜色及规格"] as const;

export type SkuMasterImportRow = {
  rowNumber: number;
  internalSkuCode: string;
  productName: string;
  specification: string;
  status: "ready" | "needs_spec";
  sourceFileName: string;
  sourceSheetName: string;
  importedAt: string;
};

export type SkuMasterImportIssue = {
  rowNumber: number;
  code: string;
  message: string;
};

export type SkuMasterImportResult = {
  rows: SkuMasterImportRow[];
  warnings: SkuMasterImportIssue[];
  errors: SkuMasterImportIssue[];
};

function cellText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function parseSkuMasterRows(
  rawRows: unknown[][],
  meta: { fileName: string; sheetName: string; importedAt: string }
): SkuMasterImportResult {
  const headers = (rawRows[0] ?? []).slice(0, SKU_MASTER_HEADERS.length).map(cellText);
  if (headers.length !== SKU_MASTER_HEADERS.length || headers.some((value, index) => value !== SKU_MASTER_HEADERS[index])) {
    throw new Error(`表头不匹配：需要“${SKU_MASTER_HEADERS.join("、")}”`);
  }

  const rows: SkuMasterImportRow[] = [];
  const warnings: SkuMasterImportIssue[] = [];
  const errors: SkuMasterImportIssue[] = [];
  const seenCodes = new Set<string>();

  rawRows.slice(1).forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const internalSkuCode = cellText(rawRow?.[0]);
    const productName = cellText(rawRow?.[1]);
    const specification = cellText(rawRow?.[2]);

    if (!internalSkuCode) {
      errors.push({ rowNumber, code: "", message: "缺少商品编码，已跳过" });
      return;
    }
    if (!productName) {
      errors.push({ rowNumber, code: internalSkuCode, message: "缺少商品名称，已跳过" });
      return;
    }
    if (seenCodes.has(internalSkuCode)) {
      errors.push({ rowNumber, code: internalSkuCode, message: "商品编码重复，已跳过" });
      return;
    }
    seenCodes.add(internalSkuCode);

    const status = specification ? "ready" : "needs_spec";
    if (!specification) {
      warnings.push({ rowNumber, code: internalSkuCode, message: "缺少颜色及规格，已导入但需要补充" });
    }
    rows.push({
      rowNumber,
      internalSkuCode,
      productName,
      specification,
      status,
      sourceFileName: meta.fileName,
      sourceSheetName: meta.sheetName,
      importedAt: meta.importedAt
    });
  });

  return { rows, warnings, errors };
}

