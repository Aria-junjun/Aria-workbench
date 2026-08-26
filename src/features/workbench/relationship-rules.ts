import type { LocalProductSupplierAssignment, LocalSkuOfferLink, LocalSkuSupplierAssignment } from "./local-store";
import { findSupplierAssignmentAtPeriod } from "./sku-composition";

export type SkuMatchStatus = "matched" | "unmatched";
export type SkuSupplyStatus = "assigned" | "evidenced" | "supplier_unconfirmed" | "unconfirmed";
export type SupplierRelationshipSource = "sku_assignment" | "family_assignment" | "inbound_evidence" | "offer_match" | "unconfirmed";

export type InboundFactForRelationship = {
  skuMasterId: string;
  period: string;
  receivedQuantity?: number;
  supplierId?: string;
  supplierName?: string;
};

export type SkuRelationshipSummary = {
  matchStatus: SkuMatchStatus;
  supplyStatus: SkuSupplyStatus;
  confirmedOfferCount: number;
  supplierId?: string;
  supplierName?: string;
  role?: "primary" | "backup";
  supplierRelationshipSource: SupplierRelationshipSource;
  effectiveFrom?: string;
  reason: string;
};

export function formatSkuRelationshipStatus(summary: Pick<SkuRelationshipSummary, "matchStatus" | "supplyStatus">): {
  matchLabel: string;
  supplyLabel: string;
} {
  const matchLabel = summary.matchStatus === "matched" ? "货盘已匹配" : "货盘未匹配";
  const supplyLabel = summary.supplyStatus === "assigned"
    ? "实际供应已确认"
    : summary.supplyStatus === "evidenced"
      ? "有入仓证据，待建立关系"
      : summary.supplyStatus === "supplier_unconfirmed"
        ? "供应商待确认"
        : "实际供应待确认";
  return { matchLabel, supplyLabel };
}

export type ClassifySkuRelationshipInput = {
  skuMasterId: string;
  skuCode: string;
  productFamilyKey?: string;
  period: string;
  offerLinks: LocalSkuOfferLink[];
  assignments: LocalSkuSupplierAssignment[];
  productSupplierAssignments?: LocalProductSupplierAssignment[];
  inboundFacts: InboundFactForRelationship[];
};

export function getConfirmedOfferLinks(links: LocalSkuOfferLink[], skuMasterId: string): LocalSkuOfferLink[] {
  return links.filter((link) => link.skuMasterId === skuMasterId && link.status === "confirmed");
}

export function getActiveSupplierAssignment(
  assignments: LocalSkuSupplierAssignment[],
  skuCode: string,
  period: string,
): LocalSkuSupplierAssignment | undefined {
  return findSupplierAssignmentAtPeriod(assignments, skuCode, period);
}

export function getActiveProductSupplierAssignment(
  assignments: LocalProductSupplierAssignment[],
  productFamilyKey: string | undefined,
  period: string,
): LocalProductSupplierAssignment | undefined {
  if (!productFamilyKey) return undefined;
  return assignments
    .filter((assignment) => assignment.productFamilyKey === productFamilyKey)
    .filter((assignment) => assignment.effectiveFrom <= period)
    .filter((assignment) => !assignment.effectiveTo || assignment.effectiveTo >= period)
    .filter((assignment) => assignment.status === "active")
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "primary" ? -1 : 1;
      return b.effectiveFrom.localeCompare(a.effectiveFrom);
    })[0];
}

export function classifySkuRelationship(input: ClassifySkuRelationshipInput): SkuRelationshipSummary {
  const confirmedOfferLinks = getConfirmedOfferLinks(input.offerLinks, input.skuMasterId);
  const skuAssignment = getActiveSupplierAssignment(input.assignments, input.skuCode, input.period);
  const familyAssignment = getActiveProductSupplierAssignment(input.productSupplierAssignments ?? [], input.productFamilyKey, input.period);
  const assignment = skuAssignment ?? familyAssignment;
  const inbound = input.inboundFacts.find((fact) => fact.skuMasterId === input.skuMasterId && fact.period === input.period);
  const inboundSupplierName = inbound?.supplierName?.trim();

  if (assignment) {
    const source: SupplierRelationshipSource = skuAssignment ? "sku_assignment" : "family_assignment";
    return {
      matchStatus: confirmedOfferLinks.length ? "matched" : "unmatched",
      supplyStatus: "assigned",
      confirmedOfferCount: confirmedOfferLinks.length,
      ...(assignment.supplierId ? { supplierId: assignment.supplierId } : {}),
      ...(assignment.supplierName ? { supplierName: assignment.supplierName } : {}),
      role: familyAssignment ? familyAssignment.role : "primary",
      supplierRelationshipSource: source,
      effectiveFrom: assignment.effectiveFrom,
      reason: confirmedOfferLinks.length
        ? `已确认货盘匹配，并存在该月份有效的${source === "sku_assignment" ? "SKU例外" : "产品族默认"}供应关系。`
        : `存在该月份有效的${source === "sku_assignment" ? "SKU例外" : "产品族默认"}供应关系，但尚未确认货盘规格匹配。`,
    };
  }

  if (inbound) {
    return {
      matchStatus: confirmedOfferLinks.length ? "matched" : "unmatched",
      supplyStatus: inboundSupplierName ? "evidenced" : "supplier_unconfirmed",
      confirmedOfferCount: confirmedOfferLinks.length,
      ...(inbound.supplierId ? { supplierId: inbound.supplierId } : {}),
      ...(inboundSupplierName ? { supplierName: inboundSupplierName } : {}),
      supplierRelationshipSource: "inbound_evidence",
      reason: inboundSupplierName
        ? "有该月份实际入仓证据，但尚未建立有效期内的供应关系记录。"
        : "有该月份实际入仓证据，但供应商尚未确认。",
    };
  }

  return {
    matchStatus: confirmedOfferLinks.length ? "matched" : "unmatched",
    supplyStatus: "unconfirmed",
    confirmedOfferCount: confirmedOfferLinks.length,
    supplierRelationshipSource: confirmedOfferLinks.length ? "offer_match" : "unconfirmed",
    reason: confirmedOfferLinks.length
      ? "货盘规格已匹配，但没有实际供应关系或入仓证据。"
      : "尚未确认货盘规格匹配，也没有实际供应关系或入仓证据。",
  };
}
