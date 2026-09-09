import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("linked demand items", () => {
  it("supports multiple demand items and exploration questions", () => {
    const source = readFileSync("src/components/workbench/demand-exploration/demand-item-editor.tsx", "utf8");
    expect(source).toContain("新增需求项");
    expect(source).toContain("探索问题");
    expect(source).toContain("添加问题");
    expect(source).toContain("demandItemId");
  });

  it("binds response entry to one demand item instead of one global analysis", () => {
    const source = readFileSync("src/components/workbench/demand-exploration/response-entry.tsx", "utf8");
    expect(source).toContain("demandItemId");
    expect(source).toContain("添加一条回答");
    expect(source).toContain("当前需求项");
  });
});
