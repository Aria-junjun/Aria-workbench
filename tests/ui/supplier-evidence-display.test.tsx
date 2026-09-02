import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("supplier evidence display", () => {
  it("uses monthly operating data as the primary supplier detail view", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).toContain("<MonthlyPerformanceTab");
    expect(source).toContain("当前操作月份");
    expect(source).toContain("查看月份");
    expect(source).toContain("period === defaultMonth()");
    expect(source).toContain("产品族表现");
    expect(source).toContain("月度表现 ·");
    expect(source).toContain("<CostReductionTab");
    expect(source).not.toContain('label="数据依据"');
    expect(source).not.toContain('label="历史判断"');
    expect(source).not.toContain('label="评估详情"');
  });

  it("keeps unassociated offers actionable from the supplier detail", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).toContain("去规格关联");
  });

  it("uses the applicable-dimension score breakdown on the supplier overview", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/page.tsx"), "utf8");
    expect(source).toContain("getScoreBreakdown");
    expect(source).toContain("N/A");
    expect(source).toContain("暂无评分");
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
});
