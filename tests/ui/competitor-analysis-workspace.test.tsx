import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("竞品分析项目工作区", () => {
  it("contains six guided steps and evidence traceability", () => {
    const workspace = readFileSync("src/components/workbench/competitor-analysis/analysis-workspace.tsx", "utf8");
    const navigation = readFileSync("src/components/workbench/competitor-analysis/step-navigation.tsx", "utf8");
    const evidence = readFileSync("src/components/workbench/competitor-analysis/evidence-panel.tsx", "utf8");
    const layers = readFileSync("src/components/workbench/competitor-analysis/five-layer-step.tsx", "utf8");
    const stages = readFileSync("src/components/workbench/competitor-analysis/stage-step.tsx", "utf8");
    const selfState = readFileSync("src/components/workbench/competitor-analysis/self-state-step.tsx", "utf8");
    const strategy = readFileSync("src/components/workbench/competitor-analysis/strategy-step.tsx", "utf8");
    expect(navigation).toContain("goal");
    expect(navigation).toContain("competitors");
    expect(navigation).toContain("layers");
    expect(navigation).toContain("stages");
    expect(navigation).toContain("self_state");
    expect(navigation).toContain("strategy_report");
    expect(workspace).toContain("证据完整度");
    expect(workspace).toContain("保存研究前输入");
    expect(workspace).toContain("已有研究前输入");
    expect(workspace).toContain("修改研究前输入");
    expect(workspace).toContain("Object.values(input).some");
    expect(evidence).toContain("采集日期");
    expect(evidence).toContain("事实 / 推断 / 待验证 / 策略建议");
    expect(layers).toContain("不要只记录“竞品长什么样”");
    expect(layers).toContain("对产品的启发");
    expect(stages).toContain("不要把竞品成熟款的最终形态直接搬到产品");
    expect(stages).toContain("对产品可以借鉴什么");
    expect(stages).toContain("产品不能直接复制什么");
    expect(selfState).toContain("产品现状");
    expect(strategy).toContain("产品为什么现在做");
  });
});
