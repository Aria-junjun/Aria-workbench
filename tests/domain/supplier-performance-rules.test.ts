import { describe, expect, it } from "vitest";
import { calculateAdjustedMonthlyCost, hasConsecutiveMonthlyAnomaly, setSupplierCostEventStatus, classifyMonthlyCostAnomaly } from "@/features/workbench/supplier-performance-rules";

describe("supplier performance rules", () => {
  it("adds only verified supplier-caused costs to adjusted monthly cost", () => {
    const result = calculateAdjustedMonthlyCost({
      baselineCost: 1000,
      settlementCost: 980,
      purchaseQuantity: 100,
    }, [
      { period: "2026-07", productFamilyKey: "白板贴", amount: 40, status: "verified" },
      { period: "2026-07", productFamilyKey: "白板贴", amount: 60, status: "pending_review" },
    ]);

    expect(result.verifiedExtraCost).toBe(40);
    expect(result.adjustedActualCost).toBeCloseTo(1020, 8);
    expect(result.varianceRate).toBeCloseTo(2, 8);
  });

  it("flags an anomaly only when the latest two completed months are consecutive and both breach threshold", () => {
    expect(hasConsecutiveMonthlyAnomaly([
      { period: "2026-06", varianceRate: 3, status: "measured" },
      { period: "2026-07", varianceRate: 2.5, status: "measured" },
    ], 2)).toBe(true);
    expect(hasConsecutiveMonthlyAnomaly([
      { period: "2026-06", varianceRate: 3, status: "measured" },
      { period: "2026-08", varianceRate: 3, status: "measured" },
    ], 2)).toBe(false);
    expect(hasConsecutiveMonthlyAnomaly([
      { period: "2026-06", varianceRate: 3, status: "measured" },
      { period: "2026-07", varianceRate: 3, status: "pending_review" },
    ], 2)).toBe(false);
  });

  it("changes only the selected cost event status", () => {
    const result = setSupplierCostEventStatus([
      { id: "a", status: "pending_review" },
      { id: "b", status: "verified" },
    ], "a", "verified");
    expect(result).toEqual([
      { id: "a", status: "verified" },
      { id: "b", status: "verified" },
    ]);
  });

  it("labels major and consecutive cost anomalies separately", () => {
    expect(classifyMonthlyCostAnomaly(5, 1)).toBe("重大异常");
    expect(classifyMonthlyCostAnomaly(2.5, 2.2)).toBe("连续异常");
    expect(classifyMonthlyCostAnomaly(0.5, 2.5)).toBe("无异常");
    expect(classifyMonthlyCostAnomaly(undefined, undefined)).toBe("待核验");
  });
});
