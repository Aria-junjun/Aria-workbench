import { describe, expect, it } from "vitest";
import { findSkuOfferMatches } from "@/features/workbench/sku-master-matching";
import type { LocalOffer, LocalSkuMaster } from "@/features/workbench/local-store";

const sku: LocalSkuMaster = {
  id: "sku-1", internalSkuCode: "Y-01BBT", productName: "无胶白板贴小纸管", specification: "0.3*0.6m*1",
  status: "ready", source: "excel", importedAt: "2026-08-20T00:00:00.000Z"
};

function offer(patch: Partial<LocalOffer>): LocalOffer {
  return { id: "offer-1", name: "货盘", createdAt: "2026-08-20", ...patch };
}

describe("产品主表与货盘关联候选", () => {
  it("商品名和规格都匹配时给出高置信候选", () => {
    const result = findSkuOfferMatches(sku, [offer({ productName: "无胶白板贴小纸管", specs: "0.3*0.6m*1" })]);
    expect(result[0]).toMatchObject({ offerId: "offer-1", confidence: "high" });
  });

  it("只有商品名相近时保留为待确认，不自动绑定", () => {
    const result = findSkuOfferMatches(sku, [offer({ productName: "无胶白板贴小纸管", specs: "0.45*2m*1" })]);
    expect(result[0]).toMatchObject({ confidence: "review" });
  });

  it("没有候选时返回空结果", () => {
    expect(findSkuOfferMatches(sku, [offer({ productName: "手工皂" })])).toEqual([]);
  });

  it("过短的泛化货盘名称不作为候选，避免误关联", () => {
    expect(findSkuOfferMatches(sku, [offer({ productName: "白板贴" })])).toEqual([]);
  });
});
