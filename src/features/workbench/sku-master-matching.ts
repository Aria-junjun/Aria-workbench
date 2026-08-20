import type { LocalOffer, LocalSkuMaster } from "./local-store";

export type SkuOfferMatch = {
  offerId: string;
  offerName: string;
  supplierName?: string;
  confidence: "high" | "review";
  reason: string;
};

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[×＊]/g, "x").replace(/[\s\-_/、，,。:：()（）]/g, "");
}

function offerText(offer: LocalOffer): string {
  return [offer.productName, offer.name, offer.specs, offer.keySpecs, offer.dimensions, offer.quotedPrice, ...(offer.skus ?? []).flatMap((sku) => [sku.specName, sku.specCode])].filter(Boolean).join(" ");
}

export function findSkuOfferMatches(sku: LocalSkuMaster, offers: LocalOffer[]): SkuOfferMatch[] {
  const product = normalize(sku.productName);
  const specification = normalize(sku.specification);
  if (!product) return [];

  return offers.flatMap((offer) => {
    const name = normalize(offer.productName || offer.name);
    const text = normalize(offerText(offer));
    const nameMatch = name === product || name.includes(product) || (name.length >= 6 && product.includes(name));
    if (!nameMatch) return [];
    const specMatch = specification.length > 0 && text.includes(specification);
    return [{
      offerId: offer.id,
      offerName: offer.name,
      supplierName: offer.supplierName,
      confidence: specMatch ? "high" as const : "review" as const,
      reason: specMatch ? "商品名称和规格均匹配" : "商品名称匹配，规格需要人工确认"
    }];
  });
}
