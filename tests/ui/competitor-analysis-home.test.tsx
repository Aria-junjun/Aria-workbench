import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("竞品分析入口", () => {
  it("exposes the guided project entry and beginner-safe examples", () => {
    const shell = readFileSync("src/components/app-shell.tsx", "utf8");
    const home = readFileSync("src/components/workbench/competitor-analysis/analysis-home.tsx", "utf8");
    const intake = readFileSync("src/components/workbench/competitor-analysis/analysis-intake-form.tsx", "utf8");
    expect(shell).toContain("竞品分析");
    expect(home).toContain("新建竞品分析");
    expect(home).toContain("已归档项目");
    expect(intake).toContain("白板贴");
    expect(intake).toContain("placeholder");
    expect(intake).toContain("示例不会自动写入");
  });
});
