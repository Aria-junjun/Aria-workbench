import { describe, expect, it } from "vitest";
import { buildSkuComparisonRows } from "@/features/workbench/sku-comparison";
import type { LocalOffer, LocalSkuMaster, LocalSkuOfferLink } from "@/features/workbench/local-store";

const master: LocalSkuMaster = {
  id: "master-y11",
  internalSkuCode: "Y-11BBT",
  productName: "白板贴",
  specification: "0.9*3m*1",
  status: "ready",
  source: "excel",
  importedAt: "2026-08-21T00:00:00.000Z"
};

function offer(id: string, skuId: string): LocalOffer {
  return {
    id,
    name: "白板贴",
    supplierName: id === "offer-a" ? "供应商A" : "供应商B",
    createdAt: "2026-08-21T00:00:00.000Z",
    skus: [{ id: skuId, specName: "90CM*3米", unitPrice: 2.7 }]
  };
}

describe("SKU comparison rows", () => {
  it("does not show a linked supplier spec again as an unlinked row", () => {
    const offers = [offer("offer-a", "sku-a"), offer("offer-b", "sku-b")];
    const links: LocalSkuOfferLink[] = [{
      id: "link-1",
      skuMasterId: master.id,
      offerId: "offer-a",
      offerSkuId: "sku-a",
      status: "confirmed",
      confirmedAt: "2026-08-21T00:00:00.000Z"
    }];

    const rows = buildSkuComparisonRows(offers, links, [master]);

    expect(rows.filter((row) => row.internalCode === "Y-11BBT")).toHaveLength(1);
    expect(rows.filter((row) => row.internalCode === "未关联" && row.supplierSpec === "90CM*3米")).toHaveLength(0);
  });

  it("keeps a genuinely different supplier spec as unlinked", () => {
    const offers: LocalOffer[] = [
      offer("offer-a", "sku-a"),
      { ...offer("offer-b", "sku-b"), skus: [{ id: "sku-c", specName: "90CM*5米", unitPrice: 4.5 }] }
    ];
    const links: LocalSkuOfferLink[] = [{
      id: "link-1",
      skuMasterId: master.id,
      offerId: "offer-a",
      offerSkuId: "sku-a",
      status: "confirmed",
      confirmedAt: "2026-08-21T00:00:00.000Z"
    }];

    const rows = buildSkuComparisonRows(offers, links, [master]);

    expect(rows.some((row) => row.internalCode === "未关联" && row.supplierSpec === "90CM*5米")).toBe(true);
  });
});
