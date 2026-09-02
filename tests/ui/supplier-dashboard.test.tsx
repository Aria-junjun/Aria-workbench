import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pagePath = "src/app/suppliers/page.tsx";

describe("supplier dashboard UI contract", () => {
  const source = readFileSync(pagePath, "utf8");

  it("renders the three decision sections", () => {
    expect(source).toContain("供应商中心");
    expect(source).toContain("待处理供应商");
    expect(source).toContain("全部供应商绩效总览");
    expect(source).toContain("聚水潭绩效");
    expect(source).toContain("工作台判断");
    expect(source).toContain("当前操作月份");
    expect(source).toContain("最新已导入数据");
    expect(source).toContain("成本偏差");
    expect(source).toContain("costRowsBySupplier");
    expect(source).toContain("判断依据");
    expect(source).toContain("质量");
    expect(source).toContain("交付");
    expect(source).toContain("成本");
    expect(source).toContain("供应关系");
    expect(source).toContain("数据完整度");
    expect(source).toContain("table-fixed");
  });

  it("does not present the supplier home as a long archive table", () => {
    expect(source).not.toContain("聊天快速评估");
    expect(source).not.toContain("供应商能力");
  });
});
