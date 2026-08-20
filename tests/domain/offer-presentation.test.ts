import { describe, expect, it } from "vitest";
import { getOfferCompleteness, getOfferDisplayPrice, getOfferDisplaySummary, getOfferRelationStatus } from "@/features/workbench/offer-presentation";

describe("offer presentation", () => {
  it("shows a normalized range when numeric min and max exist", () => {
    expect(getOfferDisplayPrice({ minPrice: 2, maxPrice: 5 } as never)).toBe("¥2.00 - ¥5.00");
  });

  it("keeps missing prices visible as unrecorded", () => {
    expect(getOfferDisplayPrice({ quotedPrice: "" } as never)).toBe("未记录");
  });

  it("condenses a long raw quote for list display while keeping the source text elsewhere", () => {
    expect(getOfferDisplaySummary({ quotedPrice: "2米：3.5元，邮费2.5元；5米：8.75元；供应商支持代发和定制" } as never)).toBe("2米：3.5元，邮费2.5元；5米：8.75元…");
  });

  it("distinguishes incomplete data from a linked offer", () => {
    expect(getOfferCompleteness({ quotedPrice: "供应商说后天可发" } as never)).toBe("partial");
    expect(getOfferRelationStatus({ supplierName: "供应商A", productId: "product-1" } as never)).toBe("已关联");
  });
});
