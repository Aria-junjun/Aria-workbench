import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("竞品分析策略与报告", () => {
  it("supports stage timeline, self-state differences, four strategy types, and report preview", () => {
    const stage = readFileSync("src/components/workbench/competitor-analysis/stage-step.tsx", "utf8");
    const selfState = readFileSync("src/components/workbench/competitor-analysis/self-state-step.tsx", "utf8");
    const strategy = readFileSync("src/components/workbench/competitor-analysis/strategy-step.tsx", "utf8");
    const report = readFileSync("src/components/workbench/competitor-analysis/report-preview.tsx", "utf8");
    expect(stage).toContain("发展阶段");
    expect(stage).toContain("关键版本");
    expect(selfState).toContain("缺失");
    expect(selfState).toContain("差异化机会");
    expect(strategy).toContain("跟随");
    expect(strategy).toContain("借鉴");
    expect(strategy).toContain("差异化");
    expect(strategy).toContain("暂不做");
    expect(report).toContain("执行摘要");
    expect(report).toContain("分析限制");
  });
});
