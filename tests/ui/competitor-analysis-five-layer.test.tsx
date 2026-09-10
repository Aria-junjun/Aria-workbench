import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("竞品确认与五层拆解", () => {
  it("teaches the five layers with fact, evidence, implication, and inspiration", () => {
    const competitor = readFileSync("src/components/workbench/competitor-analysis/competitor-step.tsx", "utf8");
    const layers = readFileSync("src/components/workbench/competitor-analysis/five-layer-step.tsx", "utf8");
    expect(competitor).toContain("直接竞品");
    expect(competitor).toContain("参考产品");
    expect(competitor).toContain("为什么选择它");
    expect(layers).toContain("战略层");
    expect(layers).toContain("范围层");
    expect(layers).toContain("结构层");
    expect(layers).toContain("框架层");
    expect(layers).toContain("表现层");
    expect(layers).toContain("观察事实");
    expect(layers).toContain("对白板贴的启发");
    expect(layers).toContain("白板贴");
  });
});
