import type { LocalSupplierCapability } from "./local-store";

export type SupplierCapabilityMatchInput = {
  productFamilyKey?: string;
  processNames?: string[];
  materialNames?: string[];
  equipmentNames?: string[];
  capabilities: LocalSupplierCapability[];
};

export type SupplierCapabilityMatch = {
  capabilityId: string;
  supplierId: string;
  matchedDimensions: string[];
  status: "verified" | "needs_review";
};

export function findSupplierCapabilityMatches(input: SupplierCapabilityMatchInput): SupplierCapabilityMatch[] {
  return input.capabilities
    .filter((capability) => capability.status !== "expired")
    .map((capability) => {
      const matchedDimensions: string[] = [];
      if (input.productFamilyKey && capability.productFamilyKey === input.productFamilyKey) {
        matchedDimensions.push("产品族");
      }
      if (hasOverlap(input.processNames, capability.processNames)) matchedDimensions.push("工艺");
      if (hasOverlap(input.materialNames, capability.materialNames)) matchedDimensions.push("原材料");
      if (hasOverlap(input.equipmentNames, capability.equipmentNames)) matchedDimensions.push("设备");

      return {
        capabilityId: capability.id,
        supplierId: capability.supplierId,
        matchedDimensions,
        status: capability.status === "verified" && capability.sourceRecordIds.length > 0 && matchedDimensions.includes("产品族") && matchedDimensions.length >= 2
          ? "verified"
          : "needs_review",
      } satisfies SupplierCapabilityMatch;
    })
    .filter((match) => match.matchedDimensions.length > 0);
}

function hasOverlap(requested: string[] | undefined, available: string[]) {
  if (!requested?.length || !available.length) return false;
  const availableSet = new Set(available.map((value) => value.trim()).filter(Boolean));
  return requested.some((value) => availableSet.has(value.trim()));
}
