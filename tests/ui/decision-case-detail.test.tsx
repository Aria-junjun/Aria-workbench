import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("decision case detail", () => {
  it("prioritizes the current decision and keeps analysis traceable", () => {
    const source = fs.readFileSync(path.join(root, "src/app/knowledge/cases/[caseId]/page.tsx"), "utf8");

    expect(source).toContain("当前结论");
    expect(source).toContain("下一步行动");
    expect(source).toContain("工具分析");
    expect(source).toContain("来源");
    expect(source).toContain("新建决策周期");
    expect(source).toContain("<details");
  });

  it("offers the canvas only inside the decision cycle", () => {
    const source = fs.readFileSync(path.join(root, "src/app/knowledge/cases/[caseId]/page.tsx"), "utf8");

    expect(source).toContain("使用商业模式画布");
    expect(source).toContain('fetch("/api/knowledge/analyze"');
    expect(source).toContain("本次新增或变化的信息");
    expect(source).toContain("decodeURIComponent");
  });
});
