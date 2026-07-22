import { describe, expect, it } from "vitest";
import { PRODUCT_RESEARCH_PROMPT } from "@/features/workbench/product-research-prompt";

describe("product research prompt", () => {
  it("focuses research on production intelligence and real procurement quotes", () => {
    expect(PRODUCT_RESEARCH_PROMPT).toContain("不得推算理论成本");
    expect(PRODUCT_RESEARCH_PROMPT).toContain("1688采购参考");
    expect(PRODUCT_RESEARCH_PROMPT).toContain("原料与结构");
    expect(PRODUCT_RESEARCH_PROMPT).toContain("生产流程与设备");
    expect(PRODUCT_RESEARCH_PROMPT).not.toContain("产品硬成本合计");
  });

  it("rejects vague optimization suggestions", () => {
    expect(PRODUCT_RESEARCH_PROMPT).toContain("不得输出空泛建议");
    expect(PRODUCT_RESEARCH_PROMPT).toContain("保持效果的依据");
    expect(PRODUCT_RESEARCH_PROMPT).toContain("实现条件");
    expect(PRODUCT_RESEARCH_PROMPT).toContain("验证方法");
  });

  it("keeps technology trends opt-in instead of generating them for every product", () => {
    expect(PRODUCT_RESEARCH_PROMPT).toContain("不要自动生成技术趋势分析");
  });
});
