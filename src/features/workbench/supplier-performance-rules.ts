import { calculateSupplierCostScore } from "./supplier-evaluation";

export type SupplierCostEventFact = {
  period: string;
  productFamilyKey: string;
  amount: number;
  status: "pending_review" | "verified";
};

export type MonthlyAnomalyFact = {
  period: string;
  varianceRate?: number;
  status: "measured" | "pending_review";
};

export function setSupplierCostEventStatus<T extends { id: string; status: "pending_review" | "verified" }>(events: T[], eventId: string, status: T["status"]) {
  return events.map((event) => event.id === eventId ? { ...event, status } : event);
}

export function calculateAdjustedMonthlyCost(
  base: { baselineCost: number; settlementCost: number; purchaseQuantity: number },
  events: SupplierCostEventFact[],
) {
  const verifiedExtraCost = events
    .filter((event) => event.status === "verified")
    .reduce((sum, event) => sum + event.amount, 0);
  const result = calculateSupplierCostScore({
    baselineUnitPrice: base.baselineCost / base.purchaseQuantity,
    actualSettlementUnitPrice: base.settlementCost / base.purchaseQuantity,
    purchaseQuantity: base.purchaseQuantity,
    supplierCausedExtraCost: verifiedExtraCost,
  });
  return {
    verifiedExtraCost,
    adjustedActualCost: result.actualSupplierCost,
    varianceRate: result.varianceRate,
    score: result.score,
  };
}

function previousMonth(period: string) {
  const [year, month] = period.split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function hasConsecutiveMonthlyAnomaly(records: MonthlyAnomalyFact[], threshold = 2) {
  const measured = records
    .filter((record) => record.status === "measured" && typeof record.varianceRate === "number")
    .sort((left, right) => left.period.localeCompare(right.period));
  const latest = measured.at(-1);
  const prior = measured.at(-2);
  if (!latest || !prior || previousMonth(latest.period) !== prior.period) return false;
  return Math.abs(latest.varianceRate!) >= threshold && Math.abs(prior.varianceRate!) >= threshold;
}

export function classifyMonthlyCostAnomaly(currentRate?: number, previousRate?: number) {
  if (currentRate === undefined) return "待核验" as const;
  if (Math.abs(currentRate) >= 5) return "重大异常" as const;
  if (previousRate !== undefined && Math.abs(currentRate) >= 2 && Math.abs(previousRate) >= 2) return "连续异常" as const;
  return "无异常" as const;
}
