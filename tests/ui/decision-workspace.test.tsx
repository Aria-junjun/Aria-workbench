import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("decision workspace UI", () => {
  it("keeps the home page local-only and lists decision cases", () => {
    const source = fs.readFileSync(path.join(root, "src/app/knowledge/page.tsx"), "utf8");

    expect(source).toContain("问题档案");
    expect(source).toContain("直接保存为问题草稿");
    expect(source).toContain("查找本地知识");
    expect(source).not.toContain('fetch("/api/knowledge/analyze"');
    expect(source).not.toContain(">需要分析<");
  });

  it("links case records to case details", () => {
    const source = fs.readFileSync(path.join(root, "src/app/knowledge/page.tsx"), "utf8");

    expect(source).toContain("/knowledge/cases/");
    expect(source).toContain("个决策周期");
  });
});
