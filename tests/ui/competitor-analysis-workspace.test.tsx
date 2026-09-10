import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("竞品分析项目工作区", () => {
  it("contains six guided steps and evidence traceability", () => {
    const workspace = readFileSync("src/components/workbench/competitor-analysis/analysis-workspace.tsx", "utf8");
    const navigation = readFileSync("src/components/workbench/competitor-analysis/step-navigation.tsx", "utf8");
    const evidence = readFileSync("src/components/workbench/competitor-analysis/evidence-panel.tsx", "utf8");
    expect(navigation).toContain("goal");
    expect(navigation).toContain("competitors");
    expect(navigation).toContain("layers");
    expect(navigation).toContain("stages");
    expect(navigation).toContain("self_state");
    expect(navigation).toContain("strategy_report");
    expect(workspace).toContain("证据完整度");
    expect(evidence).toContain("采集日期");
    expect(evidence).toContain("事实 / 推断 / 待验证 / 策略建议");
  });
});
