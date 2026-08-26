import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("supplier decision overview UI contract", () => {
  it("shows evidence-based supplier actions instead of score-only conclusions", () => {
    const source = fs.readFileSync(path.join(root, "src/app/suppliers/page.tsx"), "utf8");

    expect(source).toContain("供应商决策总览");
    expect(source).toContain("实际供货产品");
    expect(source).toContain("实际供货 SKU");
    expect(source).toContain("periodMetricLabel(period)");
    expect(source).toContain("证据");
    expect(source).toContain("下一步");
    expect(source).not.toContain("补齐未覆盖 SKU");
    expect(source).toContain("decisionFilter");
    expect(source).toContain("focusedDecisionRows");
    expect(source).toContain("buildSupplierAutoEvidence");
    expect(source).toContain("聚水潭自动证据");
    expect(source).toContain("退货率 = 实退数量 ÷ 实发数量");
    expect(source).toContain("评分仅作参考");
    expect(source).toContain("buildSupplierDecisionOverviewRows");
    expect(source).toContain("decisionOperatingSnapshots");
    expect(source).toContain("isInPeriod(snapshot.period, period, decisionAnchor)");
    expect(source).toContain("维护供应关系");
  });

  it("explains why the decision overview is empty instead of hiding the section", () => {
    const source = fs.readFileSync(path.join(root, "src/app/suppliers/page.tsx"), "utf8");

    expect(source).toContain("当前周期暂未生成供应商决策");
    expect(source).toContain("已读取供应商");
    expect(source).toContain("去入仓产品查看数据来源");
  });
});
