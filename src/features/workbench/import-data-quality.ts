export type ImportQualityStatus = "ready" | "warning";

export type ImportQualitySummary = {
  status: ImportQualityStatus;
  totalRows: number;
  validRows: number;
  matchedRows: number;
  unmatchedRows: number;
  issueRows: number;
  duplicateRows: number;
  mergedRows: number;
  headline: string;
  details: string[];
};

type ImportQualityInput = {
  sourceLabel: string;
  totalRows: number;
  validRows: number;
  matchedRows: number;
  issueRows: number;
  duplicateRows: number;
  mergedRows: number;
  period: string;
};

export function summarizeImportQuality(input: ImportQualityInput): ImportQualitySummary {
  const unmatchedRows = Math.max(0, input.validRows - input.matchedRows);
  const details = [`覆盖 ${input.period}`];
  if (input.duplicateRows > 0) details.push(`重复 ${input.duplicateRows} 行`);
  if (input.mergedRows > 0) details.push(`同商品规格合并 ${input.mergedRows} 行`);
  if (input.issueRows > 0) details.push(`字段或数值异常 ${input.issueRows} 行`);
  if (unmatchedRows > 0) details.push(`未匹配 ${unmatchedRows} 行`);

  return {
    status: unmatchedRows > 0 || input.issueRows > 0 || input.duplicateRows > 0 ? "warning" : "ready",
    totalRows: input.totalRows,
    validRows: input.validRows,
    matchedRows: input.matchedRows,
    unmatchedRows,
    issueRows: input.issueRows,
    duplicateRows: input.duplicateRows,
    mergedRows: input.mergedRows,
    headline: `${input.sourceLabel}：${input.matchedRows}/${input.validRows} 行可写入${unmatchedRows > 0 ? `，${unmatchedRows} 行待补齐` : ""}`,
    details,
  };
}
