import { describe, expect, it } from "vitest";
import { calculateQuoteCosts, parseFeeAmount, parseQuantity } from "@/features/workbench/quote-calculator";

describe("quote calculator", () => {
  it("parses Chinese quantities and multiplied plate fees", () => {
    expect(parseQuantity("3万个")).toBe(30000);
    expect(parseQuantity("约12000个")).toBe(12000);
    expect(parseFeeAmount("310元/色*2色")).toBe(620);
  });

  it("calculates untaxed and taxed totals", () => {
    expect(calculateQuoteCosts({
      quantity: 30000,
      untaxedUnitPrice: "0.185元/个",
      untaxedPlateFee: "310元/色*2色",
      taxedUnitPrice: "0.2035元/个",
      taxedPlateFee: "341元/色*2色"
    })).toEqual({ untaxedGoods: 5550, untaxedTotal: 6170, taxedGoods: 6105, taxedTotal: 6787 });
  });
});
