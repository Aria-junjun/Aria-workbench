import type { LocalOffer, LocalSkuMaster, LocalSkuOfferLink, OfferSku } from "./local-store";

export type SkuComparisonRow = {
  key: string;
  internalCode: string;
  standardSpec: string;
  supplierSpec: string;
  matchedSkus: Array<OfferSku | undefined>;
};

function normalizeSpec(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[×＊]/g, "x")
    .replace(/[\s\-_\/、，,。:：()（）]/g, "");
}

export function buildSkuComparisonRows(
  offers: LocalOffer[],
  skuLinks: LocalSkuOfferLink[],
  skuMasters: LocalSkuMaster[]
): SkuComparisonRow[] {
  const offerIndex = new Map(offers.map((offer, index) => [offer.id, index]));
  const skuMapByOffer = offers.map((offer) => new Map((offer.skus ?? []).map((sku) => [sku.id, sku])));
  const activeLinks = skuLinks.filter(
    (link) => link.status === "confirmed" && link.offerSkuId && offerIndex.has(link.offerId)
  );
  const linkedSkuIds = new Set(activeLinks.map((link) => `${link.offerId}:${link.offerSkuId}`));
  const linkedSpecNames = new Set<string>();
  const rows: SkuComparisonRow[] = [];

  for (const link of activeLinks) {
    const index = offerIndex.get(link.offerId);
    const sku = index == null || !link.offerSkuId ? undefined : skuMapByOffer[index]?.get(link.offerSkuId);
    const normalized = normalizeSpec(sku?.specName);
    if (normalized) linkedSpecNames.add(normalized);
  }

  for (const master of skuMasters) {
    const masterLinks = activeLinks.filter((link) => link.skuMasterId === master.id);
    if (masterLinks.length === 0) continue;

    const linkedNames = new Set(
      masterLinks
        .map((link) => {
          const index = offerIndex.get(link.offerId);
          return index == null || !link.offerSkuId ? "" : normalizeSpec(skuMapByOffer[index]?.get(link.offerSkuId)?.specName);
        })
        .filter(Boolean)
    );
    const fallbackSpec = linkedNames.size === 1 ? [...linkedNames][0] : undefined;

    rows.push({
      key: `internal:${master.id}`,
      internalCode: master.internalSkuCode,
      standardSpec: master.specification || "规格待补充",
      supplierSpec: "已按内部编码关联",
      matchedSkus: offers.map((offer, index) => {
        const link = masterLinks.find((item) => item.offerId === offer.id);
        if (link?.offerSkuId) return skuMapByOffer[index]?.get(link.offerSkuId);
        if (!fallbackSpec) return undefined;
        return (offer.skus ?? []).find((sku) => normalizeSpec(sku.specName) === fallbackSpec);
      })
    });
  }

  const seenSpecNames = new Set<string>();
  for (const offer of offers) {
    for (const sku of offer.skus ?? []) {
      const name = sku.specName.trim();
      const normalized = normalizeSpec(name);
      if (!normalized || linkedSkuIds.has(`${offer.id}:${sku.id}`) || linkedSpecNames.has(normalized) || seenSpecNames.has(normalized)) continue;
      seenSpecNames.add(normalized);
      rows.push({
        key: `supplier:${normalized}`,
        internalCode: "未关联",
        standardSpec: "—",
        supplierSpec: name,
        matchedSkus: offers.map((item) => item.skus?.find((candidate) => normalizeSpec(candidate.specName) === normalized))
      });
    }
  }

  return rows;
}
