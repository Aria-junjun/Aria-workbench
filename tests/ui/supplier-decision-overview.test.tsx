import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("supplier decision overview UI contract", () => {
  it("shows evidence-based supplier actions instead of score-only conclusions", () => {
    const source = fs.readFileSync(path.join(root, "src/app/suppliers/page.tsx"), "utf8");

    expect(source).toContain("供应商决策总览");
    expect(source).toContain("实际供货产品");
    expect(source).toContain("SKU覆盖");
    expect(source).toContain("periodMetricLabel(period)");
    expect(source).toContain("证据");
    expect(source).toContain("下一步");
    expect(source).toContain("评分仅作参考");
    expect(source).toContain("buildSupplierDecisionOverviewRows");
  });
});
