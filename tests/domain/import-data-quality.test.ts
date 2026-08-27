import { describe, expect, it } from "vitest";
import { summarizeImportQuality } from "@/features/workbench/import-data-quality";

describe("import data quality summary", () => {
  it("explains matched, unmatched, duplicate and merged rows", () => {
    expect(summarizeImportQuality({
      sourceLabel: "销售表",
      totalRows: 5,
      validRows: 4,
      matchedRows: 3,
      issueRows: 1,
      duplicateRows: 1,
      mergedRows: 0,
      period: "2026-07",
    })).toMatchObject({
      status: "warning",
      unmatchedRows: 1,
      headline: "销售表：3/4 行可写入，1 行待补齐",
      details: ["覆盖 2026-07", "重复 1 行", "字段或数值异常 1 行", "未匹配 1 行"],
    });
  });

  it("marks a complete inbound match as ready", () => {
    expect(summarizeImportQuality({
      sourceLabel: "入仓表",
      totalRows: 3,
      validRows: 3,
      matchedRows: 3,
      issueRows: 0,
      duplicateRows: 0,
      mergedRows: 2,
      period: "2026-07",
    })).toMatchObject({
      status: "ready",
      unmatchedRows: 0,
      headline: "入仓表：3/3 行可写入",
      details: ["覆盖 2026-07", "同商品规格合并 2 行"],
    });
  });
});
