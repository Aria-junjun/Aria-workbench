import type { LocalMonthlyInboundSnapshot, LocalOffer, LocalSkuMaster } from "./local-store";
import { deriveProductFamilyKey } from "./product-master";

export type SupplierMonthlyCostSkuRow = {
  skuMasterId: string;
  skuCode: string;
  specification: string;
  purchaseQuantity: number;
  baselineUnitPrice?: number;
  settlementUnitPrice?: number;
  baselineCost?: number;
  settlementCost?: number;
  status: "measured" | "pending_review";
};

export type SupplierMonthlyCostRow = {
  supplierId: string;
  period: string;
  productFamilyKey: string;
  skuRows: SupplierMonthlyCostSkuRow[];
  purchaseQuantity: number;
  baselineCost?: number;
  settlementCost?: number;
  status: "measured" | "pending_review";
};

type Input = {
  supplierId: string;
  period: string;
  skuMasters: LocalSkuMaster[];
  inboundRows: LocalMonthlyInboundSnapshot[];
  offers: LocalOffer[];
};

export type InboundCostFact = {
  key: string;
  receivedQuantity: number;
  settlementUnitPrice?: number;
  settlementAmount?: number;
};

/** 同一 SKU/经营产品的多行入仓记录按数量和金额合并，不能只保留首行单价。 */
export function mergeInboundCostFacts<T extends InboundCostFact>(rows: T[]): T[] {
  const merged = new Map<string, T>();
  for (const row of rows) {
    const existing = merged.get(row.key);
    if (!existing) {
      merged.set(row.key, { ...row });
      continue;
    }
    const quantity = existing.receivedQuantity + row.receivedQuantity;
    const amount = existing.settlementAmount !== undefined && row.settlementAmount !== undefined
      ? existing.settlementAmount + row.settlementAmount
      : undefined;
    const unitPrice = amount !== undefined
      ? amount / quantity
      : existing.settlementUnitPrice !== undefined && existing.settlementUnitPrice === row.settlementUnitPrice
        ? existing.settlementUnitPrice
        : undefined;
    merged.set(row.key, { ...existing, receivedQuantity: quantity, settlementAmount: amount, settlementUnitPrice: unitPrice });
  }
  return [...merged.values()];
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s*×xX·＋+\-_/（）()]/g, "");
}

function dimensionSignature(value: string) {
  const numbers = value.match(/\d+(?:\.\d+)?/g) ?? [];
  return numbers.length >= 2 ? numbers.join("x") : undefined;
}

function sameSpecification(left: string, right: string) {
  const leftNormalized = normalize(left);
  const rightNormalized = normalize(right);
  if (leftNormalized === rightNormalized) return true;
  const leftSignature = dimensionSignature(left);
  return leftSignature !== undefined && leftSignature === dimensionSignature(right);
}

function offerMatchesFamily(offer: LocalOffer, familyKey: string) {
  const offerFamily = deriveProductFamilyKey(offer.productName || offer.name);
  return offerFamily === familyKey || offer.productName === familyKey || offer.name.includes(familyKey);
}

function findBaselineUnitPrice(sku: LocalSkuMaster, familyKey: string, offers: LocalOffer[], supplierId: string) {
  const supplierOffers = offers.filter((offer) => offer.supplierId === supplierId && offerMatchesFamily(offer, familyKey));
  for (const offer of supplierOffers) {
    const matchedSku = offer.skus?.find((offerSku) => sameSpecification(offerSku.specName, sku.specification) && typeof offerSku.unitPrice === "number");
    if (matchedSku?.unitPrice !== undefined) return matchedSku.unitPrice;
  }
  if (supplierOffers.length === 1) {
    const offer = supplierOffers[0];
    if (offer.skus?.length === 1 && typeof offer.skus[0].unitPrice === "number") return offer.skus[0].unitPrice;
    if (typeof offer.untaxedUnitPriceNum === "number") return offer.untaxedUnitPriceNum;
    if (typeof offer.quotedPriceNum === "number") return offer.quotedPriceNum;
  }
  return undefined;
}

export function buildSupplierMonthlyCostRows({ supplierId, period, skuMasters, inboundRows, offers }: Input): SupplierMonthlyCostRow[] {
  const skuById = new Map(skuMasters.map((sku) => [sku.id, sku]));
  const familyGroups = new Map<string, SupplierMonthlyCostSkuRow[]>();
  inboundRows
    .filter((row) => row.supplierId === supplierId && row.period === period)
    .forEach((row) => {
      const sku = skuById.get(row.skuMasterId);
      if (!sku || !row.receivedQuantity || row.receivedQuantity <= 0) return;
      const familyKey = row.productFamilyKey || deriveProductFamilyKey(sku.productName, sku.productFamilyKey);
      const settlementUnitPrice = row.settlementUnitPrice ?? (row.settlementAmount !== undefined ? row.settlementAmount / row.receivedQuantity : undefined);
      const baselineUnitPrice = findBaselineUnitPrice(sku, familyKey, offers, supplierId);
      const skuRow: SupplierMonthlyCostSkuRow = {
        skuMasterId: sku.id,
        skuCode: sku.internalSkuCode,
        specification: sku.specification,
        purchaseQuantity: row.receivedQuantity,
        baselineUnitPrice,
        settlementUnitPrice,
        baselineCost: baselineUnitPrice !== undefined ? baselineUnitPrice * row.receivedQuantity : undefined,
        settlementCost: settlementUnitPrice !== undefined ? settlementUnitPrice * row.receivedQuantity : undefined,
        status: baselineUnitPrice !== undefined && settlementUnitPrice !== undefined ? "measured" : "pending_review",
      };
      const current = familyGroups.get(familyKey) ?? [];
      const existing = current.find((item) => item.skuMasterId === sku.id);
      if (existing) {
        existing.purchaseQuantity += skuRow.purchaseQuantity;
        if (existing.baselineCost !== undefined && skuRow.baselineCost !== undefined) existing.baselineCost += skuRow.baselineCost;
        else existing.baselineCost = undefined;
        if (existing.settlementCost !== undefined && skuRow.settlementCost !== undefined) existing.settlementCost += skuRow.settlementCost;
        else existing.settlementCost = undefined;
        existing.baselineUnitPrice = existing.baselineCost !== undefined ? existing.baselineCost / existing.purchaseQuantity : undefined;
        existing.settlementUnitPrice = existing.settlementCost !== undefined ? existing.settlementCost / existing.purchaseQuantity : undefined;
        existing.status = existing.baselineCost !== undefined && existing.settlementCost !== undefined ? "measured" : "pending_review";
      } else current.push(skuRow);
      familyGroups.set(familyKey, current);
    });

  return [...familyGroups.entries()].map(([productFamilyKey, skuRows]) => {
    const purchaseQuantity = skuRows.reduce((sum, row) => sum + row.purchaseQuantity, 0);
    const complete = skuRows.every((row) => row.status === "measured");
    return {
      supplierId,
      period,
      productFamilyKey,
      skuRows,
      purchaseQuantity,
      baselineCost: complete ? skuRows.reduce((sum, row) => sum + (row.baselineCost ?? 0), 0) : undefined,
      settlementCost: complete ? skuRows.reduce((sum, row) => sum + (row.settlementCost ?? 0), 0) : undefined,
      status: complete ? "measured" : "pending_review",
    };
  });
}
