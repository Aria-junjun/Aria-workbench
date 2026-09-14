import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("product decomposition report", () => {
  it("distinguishes evidence, judgment, solution and action", () => {
    const report = readFileSync("src/components/workbench/product-decomposition/decomposition-report.tsx", "utf8");
    const route = readFileSync("src/app/product-decomposition/[projectId]/report/page.tsx", "utf8");
    const domain = readFileSync("src/features/workbench/product-decomposition.ts", "utf8");

    expect(report).toContain("产品拆解结果");
    expect(report).toContain("事实与依据");
    expect(report).toContain("当前判断");
    expect(report).toContain("方案与优先级");
    expect(report).toContain("行动计划");
    expect(report).toContain("未关联产品");
    expect(report).toContain("信息缺口");
    expect(route).toContain("DecompositionReport");
    expect(report).toContain("buildProductDecompositionReport");
    expect(domain).toContain("sourceReferences");
  });
});
