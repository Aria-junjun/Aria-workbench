import type { LocalOffer } from "./local-store";

export type OfferCompleteness = "structured" | "partial" | "pending_review";
export type OfferRelationStatus = "已关联" | "待确认" | "未关联";

export function getOfferDisplayPrice(offer: LocalOffer): string {
  if (offer.minPrice != null && offer.maxPrice != null) {
    return `¥${offer.minPrice.toFixed(2)} - ¥${offer.maxPrice.toFixed(2)}`;
  }
  return offer.quotedPrice?.trim() || "未记录";
}

export function getOfferDisplaySummary(offer: LocalOffer): string {
  const price = getOfferDisplayPrice(offer);
  const raw = (offer.quotedPrice || "").trim();
  if (!raw || price !== "未记录" && (offer.minPrice != null || offer.maxPrice != null)) return price;

  const parts = raw.split(/[;；]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 2) return `${parts.slice(0, 2).join("；")}…`;
  if (raw.length > 36) return `${raw.slice(0, 36).trimEnd()}…`;
  return raw;
}

export function getOfferDisplaySkuCount(offer: LocalOffer): number {
  return offer.skuCount ?? offer.skus?.length ?? 0;
}

export function getOfferCompleteness(offer: LocalOffer): OfferCompleteness {
  const knownFields = [offer.quotedPrice, offer.moq, offer.leadTime, offer.keySpecs].filter(
    (value) => Boolean(value?.trim())
  ).length;
  if (knownFields >= 3 || offer.minPrice != null || offer.maxPrice != null) return "structured";
  if (knownFields > 0) return "partial";
  return "pending_review";
}

export function getOfferRelationStatus(offer: LocalOffer): OfferRelationStatus {
  if (offer.productId || offer.productName) return "已关联";
  if (offer.supplierId || offer.supplierName || offer.name) return "待确认";
  return "未关联";
}
