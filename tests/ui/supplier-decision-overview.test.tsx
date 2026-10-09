import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("supplier management boundary", () => {
  it("keeps risk monitoring and cross-supplier decisions on the lifecycle overview", () => {
    const overview = read("src/components/workbench/supplier-lifecycle-workspace.tsx");
    expect(overview).toContain("function Overview");
    expect(overview).toContain("代发经营监控");
    expect(overview).toContain("本期需跟进");
    expect(overview).toContain("总监只读查看");
  });

  it("keeps the supplier directory free of cross-supplier scoreboards", () => {
    const archive = read("src/app/suppliers/page.tsx");
    expect(archive).toContain("供应商档案");
    expect(archive).toContain("实际业务归属");
    expect(archive).toContain('href="/supplier-lifecycle"');
    expect(archive).not.toContain("供应商决策总览");
    expect(archive).not.toContain("供应商管理决策台账");
  });
});
