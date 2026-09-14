import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("product decomposition workspace", () => {
  it("uses the five non-overlapping workflow labels", () => {
    const navigation = readFileSync("src/components/workbench/product-decomposition/step-navigation.tsx", "utf8");
    const domain = readFileSync("src/features/workbench/product-decomposition.ts", "utf8");
    const workspace = readFileSync("src/components/workbench/product-decomposition/decomposition-workspace.tsx", "utf8");
    const causes = readFileSync("src/components/workbench/product-decomposition/causes-step.tsx", "utf8");
    const solutions = readFileSync("src/components/workbench/product-decomposition/solutions-step.tsx", "utf8");
    const actions = readFileSync("src/components/workbench/product-decomposition/actions-step.tsx", "utf8");

    expect(domain).toContain("定位与中心问题");
    expect(domain).toContain("目标与范围");
    expect(domain).toContain("原因拆解");
    expect(domain).toContain("方案与优先级");
    expect(domain).toContain("行动计划");
    expect(workspace).toContain("saveProductDecompositionProject");
    expect(causes).toContain("鱼骨");
    expect(solutions).toContain("分类由执行人确认，系统不替代判断");
    expect(domain).toContain("未开始");
    expect(navigation).not.toContain("战略层");
  });
});
