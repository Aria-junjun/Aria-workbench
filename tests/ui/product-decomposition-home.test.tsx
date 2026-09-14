import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("product decomposition home", () => {
  it("shows the independent module and empty-state action", () => {
    const shell = readFileSync("src/components/app-shell.tsx", "utf8");
    const home = readFileSync("src/components/workbench/product-decomposition/decomposition-home.tsx", "utf8");
    const intake = readFileSync("src/components/workbench/product-decomposition/decomposition-intake-form.tsx", "utf8");

    expect(shell).toContain('{ href: "/product-decomposition", label: "产品拆解"');
    expect(home).toContain("产品拆解");
    expect(home).toContain("还没有产品拆解项目。先明确一个产品问题。");
    expect(home).toContain("新建产品拆解");
    expect(intake).toContain("placeholder");
  });
});
