import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("industry insight home", () => {
  it("contains the independent entry point and six-step explanation", () => {
    const shell = readFileSync("src/components/app-shell.tsx", "utf8");
    const home = readFileSync("src/components/workbench/industry-insight/insight-home.tsx", "utf8");
    expect(shell).toContain('{ href: "/industry-insight", label: "行业洞察"');
    expect(home).toContain("六步工作区");
    expect(home).toContain("新建行业洞察");
  });
});
