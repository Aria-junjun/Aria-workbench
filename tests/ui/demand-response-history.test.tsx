import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("demand response audit trail", () => {
  it("shows entered response rows and classification counts for review", () => {
    const source = readFileSync("src/components/workbench/demand-exploration/response-entry.tsx", "utf8");
    expect(source).toContain("已录入回答明细");
    expect(source).toContain("正向回答");
    expect(source).toContain("反向回答");
    expect(source).toContain("自动分类");
    expect(source).toContain("A/O/M/I/R/Q");
  });
});
