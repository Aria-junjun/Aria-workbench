import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("demand confirmation workspace", () => {
  it("uses document language instead of course progress language", () => {
    const source = readFileSync("src/components/workbench/demand-exploration/exploration-home.tsx", "utf8");
    expect(source).toContain("需求确认文档");
    expect(source).not.toContain("跟着课程一步一步完成需求分析");
    expect(source).not.toContain("Step 1 / 6");
    expect(source).not.toContain("本期开放");
  });

  it("provides a document workspace with structure and demand item sections", () => {
    const source = readFileSync("src/components/workbench/demand-exploration/document-workspace.tsx", "utf8");
    expect(source).toContain("需求结构");
    expect(source).toContain("需求项分析");
    expect(source).toContain("需求确认结论");
  });
});
