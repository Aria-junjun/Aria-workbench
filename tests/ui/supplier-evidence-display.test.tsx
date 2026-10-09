import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("supplier evidence display", () => {
  it("keeps supplier detail as profile and links history instead of duplicating monthly facts", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).toContain("<SupplierProfileWorkspace");
    expect(source).not.toContain("<MonthlyPerformanceTab");
    expect(source).toContain("查看月份");
    expect(source).toContain("period === defaultMonth()");
    expect(source).toContain("monthlyCostRows");
    expect(source).toContain("<CostReductionTab");
    expect(source).not.toContain('label="数据依据"');
    expect(source).not.toContain('label="历史判断"');
    expect(source).not.toContain('label="评估详情"');
  });

  it("keeps unassociated offers actionable from the supplier detail", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).toContain("去规格关联");
  });

  it("keeps cross-supplier performance decisions out of the supplier directory", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/page.tsx"), "utf8");
    expect(source).toContain("供应商档案");
    expect(source).toContain('href="/supplier-lifecycle"');
    expect(source).not.toContain("getScoreBreakdown");
  });

  it("shows auto-linked monthly cost verification and evidence-only event entry", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).toContain("成本核验");
    expect(source).toContain("自动生成");
    expect(source).toContain("增量金额");
    expect(source).toContain("保存增量成本事件");
  });

  it("passes auto-linked monthly cost rows and event records into the verification tab", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).toMatch(/<CostReductionTab[\s\S]*?monthlyCostRows=\{monthlyCostRows\}/);
    expect(source).toMatch(/<CostReductionTab[\s\S]*?costEvents=\{supplier\.costEvents \?\? \[\]\}/);
  });

  it("keeps the supplier identity area free of operational date clutter", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).not.toContain("grid min-w-[150px]");
    expect(source).not.toContain("最新数据</div>");
    expect(source).toContain("min-w-0 flex-1");
  });

  it("treats month as a page filter and hides the non-decision supplier type badge", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).toContain("查看月份");
    expect(source).toContain("defaultMonth()");
    expect(source).not.toContain("当前操作月份</div>");
    expect(source).not.toContain("{typeLabel}</span>");
    expect(source).toContain("flex flex-wrap items-start justify-between gap-6");
  });
});
