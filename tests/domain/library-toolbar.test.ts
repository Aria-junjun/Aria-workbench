import { describe, expect, it } from "vitest";
import { uniqueTags } from "@/components/workbench/library-toolbar";

describe("library tag shortcuts", () => {
  it("keeps the most frequent tags and limits shortcut count", () => {
    const tags = uniqueTags([
      ["报价", "包装", "交期"],
      ["报价", "包装", "风险"],
      ["报价", "样品"],
      ["价格压力"],
      ["1688"],
      ["义乌"],
      ["工厂"],
      ["贸易商"],
      ["现货"],
      ["定制"]
    ]);

    expect(tags).toHaveLength(8);
    expect(tags.slice(0, 2)).toEqual(["报价", "包装"]);
    expect(tags).not.toContain("现货");
    expect(tags).not.toContain("定制");
  });
});
