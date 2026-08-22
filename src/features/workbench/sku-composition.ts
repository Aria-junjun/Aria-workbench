export type SkuCompositionParseResult = {
  baseSkuCode?: string;
  accessoryCount?: number;
  confidence: "exact" | "suggested" | "manual";
};

export type SupplierAssignmentForLookup = {
  id: string;
  skuCode: string;
  supplierId?: string;
  supplierName?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "active" | "ended";
  source: "manual" | "imported" | "offer";
  note?: string;
};

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function parseSkuCompositionCode(salesSkuCode: string, productName: string): SkuCompositionParseResult {
  const code = clean(salesSkuCode);
  const name = clean(productName);
  if (!code) return { confidence: "manual" };
  if (!/-\d+$/.test(code)) return { baseSkuCode: code, confidence: "exact" };

  const match = code.match(/^(.*)-(\d+)$/);
  const accessoryCount = match ? Number(match[2]) : undefined;
  const nameSupportsBundle = /白板笔|笔\s*$|\+\s*\d+\s*支?笔/.test(name);
  if (match && accessoryCount !== undefined && accessoryCount > 0 && nameSupportsBundle) {
    return { baseSkuCode: match[1], accessoryCount, confidence: "suggested" };
  }
  return { confidence: "manual" };
}

export function findSupplierAssignmentAtPeriod(
  assignments: SupplierAssignmentForLookup[],
  skuCode: string,
  period: string
): SupplierAssignmentForLookup | undefined {
  return assignments
    .filter((assignment) => assignment.skuCode === skuCode)
    .filter((assignment) => assignment.effectiveFrom <= period)
    .filter((assignment) => !assignment.effectiveTo || assignment.effectiveTo >= period)
    .filter((assignment) => assignment.status === "active")
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}
