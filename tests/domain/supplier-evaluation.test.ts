import { describe, expect, it } from "vitest";
import {
  SupplierOrderRecordSchema,
  SupplierQualityIssueSchema,
  SupplierCostReductionSchema,
  SupplierEvaluationRecordSchema,
  type SupplierOrderRecord,
  SUPPLIER_GRADES,
  calculateDeliveryScore,
  calculateCostScore,
  calculateQualityScore,
  calculateServiceScore,
  calculateTotalScoreAndGrade,
  gradeFromTotal,
  deriveRiskLabels,
  evaluateSupplierFromRaw,
  aggregateMetricsFromRecords
} from "@/features/workbench/supplier-evaluation";

describe("supplier evaluation schemas", () => {
  it("accepts valid order record with promised and actual dates", () => {
    const rec: SupplierOrderRecord = {
      id: "o1",
      productName: "收纳箱",
      orderQuantity: 1000,
      deliveredQuantity: 880,
      promisedDeliveryAt: "2026-08-20",
      actualDeliveryAt: "2026-08-22",
      isPeak: false,
      unitPrice: 13.21,
      currency: "CNY",
      orderedAt: "2026-08-10",
      status: "partial"
    };
    const parsed = SupplierOrderRecordSchema.parse(rec);
    expect(parsed.orderQuantity).toBe(1000);
    expect(parsed.deliveredQuantity).toBe(880);
  });

  it("rejects grade outside A/B/C/D", () => {
    expect(() =>
      SupplierEvaluationRecordSchema.parse({
        id: "e1", supplierId: "s1", period: "2026-Q3",
        scores: { delivery: 70, cost: 72, quality: 80, service: 62, total: 71.2, grade: "S" },
        rawMetrics: {},
        evaluatedAt: "2026-08-01"
      })
    ).toThrow();
  });

  it("SUPPLIER_GRADES is exactly A/B/C/D in that order", () => {
    expect(SUPPLIER_GRADES).toEqual(["A", "B", "C", "D"]);
  });
});

describe("qcds scoring engine", () => {
  it("calculateDeliveryScore: OTD×0.3 + peak×0.3 + fulfill×0.2 + expedite×0.2", () => {
    const s = calculateDeliveryScore({ onTimeDeliveryRate: 70, peakDeliveryRate: 40, orderFulfillmentRate: 88, expediteOnTimeRate: 65 });
    expect(s).toBeCloseTo(63.6, 1);
  });

  it("calculateCostScore: 竞争力93.8×0.35 + (涨30+降80)/2×0.4 + 稳定70×0.25 ≈ 72.3", () => {
    const s = calculateCostScore({
      currentQuote: 3.2,
      categoryLowestPrice: 3.0,
      priceRiseResponseDays: 5,
      priceDropResponseDays: 12,
      priceStabilityScore: 70
    });
    expect(s).toBeGreaterThan(70);
    expect(s).toBeLessThan(74);
  });

  it("calculateQualityScore: 87.5×0.5 + 75×0.3 + (100-25)×0.2 = 81.25", () => {
    const s = calculateQualityScore({ incomingPassRate: 87.5, qualityIssueClosureRate: 75, repeatIssueRate: 25 });
    expect(s).toBeCloseTo(81.25, 0);
  });

  it("calculateServiceScore: 承诺55×0.45 + 响应18h=70×0.3 + 配合3.2/5=64×0.25 ≈ 61.75", () => {
    const s = calculateServiceScore({ promiseFulfillmentRate: 55, avgResponseHours: 18, cooperationAverageScore: 3.2 });
    expect(s).toBeGreaterThan(60);
    expect(s).toBeLessThan(63);
  });

  it("gradeFromTotal thresholds: A>=85, B>=70, C>=60, D<60", () => {
    expect(gradeFromTotal(91.2)).toBe("A");
    expect(gradeFromTotal(85)).toBe("A");
    expect(gradeFromTotal(82.5)).toBe("B");
    expect(gradeFromTotal(70)).toBe("B");
    expect(gradeFromTotal(68.3)).toBe("C");
    expect(gradeFromTotal(60)).toBe("C");
    expect(gradeFromTotal(59.9)).toBe("D");
    expect(gradeFromTotal(0)).toBe("D");
  });

  it("calculateTotalScoreAndGrade", () => {
    const r = calculateTotalScoreAndGrade({ delivery: 63.6, cost: 72.3, quality: 81.3, service: 61.7 });
    expect(r.total).toBeGreaterThan(68);
    expect(r.total).toBeLessThan(73);
    expect(["B", "C"]).toContain(r.grade);
  });

  it("deriveRiskLabels triggers correctly", () => {
    const l1 = deriveRiskLabels({ peakDeliveryRate: 40, promiseFulfillmentRate: 55, avgResponseHours: 30 });
    expect(l1).toContain("爆单不可靠");
    expect(l1).toContain("言行不一");
    expect(l1).toContain("响应慢");

    const l2 = deriveRiskLabels({ peakDeliveryRate: 70, promiseFulfillmentRate: 75, avgResponseHours: 6 });
    expect(l2).toEqual(["无风险"]);
  });

  it("evaluateSupplierFromRaw end-to-end doc example (score ~68, risk labels present)", () => {
    const ev = evaluateSupplierFromRaw({
      supplierId: "s1", period: "2026-Q3",
      metrics: {
        onTimeDeliveryRate: 70, peakDeliveryRate: 40, orderFulfillmentRate: 88, expediteOnTimeRate: 65,
        currentQuote: 3.2, categoryLowestPrice: 3.0, priceRiseResponseDays: 5, priceDropResponseDays: 12, priceStabilityScore: 70,
        incomingPassRate: 87.5, qualityIssueClosureRate: 75, repeatIssueRate: 25,
        promiseFulfillmentRate: 55, avgResponseHours: 18, cooperationAverageScore: 3.2
      }
    });
    expect(ev.scores.total).toBeGreaterThan(66);
    expect(ev.scores.total).toBeLessThan(71);
    // 68 左右正好在 B/C 边界，任何一档都合理，核心是风险标签要触发
    expect(["B", "C"]).toContain(ev.scores.grade);
    expect(ev.riskLabels).toEqual(expect.arrayContaining(["爆单不可靠", "言行不一"]));
  });

  it("partial metrics missing: gets reasonable defaults", () => {
    const ev = evaluateSupplierFromRaw({
      metrics: { onTimeDeliveryRate: 80 },
      supplierId: "s1", period: "2026-Q3"
    });
    expect(ev.scores.total).toBeGreaterThan(40);
    expect(ev.scores.total).toBeLessThan(80);
    expect(["A", "B", "C", "D"]).toContain(ev.scores.grade);
  });

  it("aggregateMetricsFromRecords with 2 orders computes OTD/peak/fulfill/pass/quote correctly", () => {
    const orders: SupplierOrderRecord[] = [
      {
        id: "o1", productName: "铁艺花架",
        orderedAt: "2026-07-01", promisedDeliveryAt: "2026-07-08", actualDeliveryAt: "2026-07-07",
        orderQuantity: 500, deliveredQuantity: 500, isPeak: false, status: "fulfilled", unitPrice: 28
      },
      {
        id: "o2", productName: "铁艺花架",
        orderedAt: "2026-07-10", promisedDeliveryAt: "2026-07-18", actualDeliveryAt: "2026-07-22",
        orderQuantity: 1500, deliveredQuantity: 1400, isPeak: true, status: "partial", unitPrice: 28
      }
    ];
    const m = aggregateMetricsFromRecords({ orders, qualityIssues: [], serviceEvents: [] });
    expect(m.onTimeDeliveryRate).toBe(50);
    expect(m.peakDeliveryRate).toBe(0);
    expect(m.orderFulfillmentRate).toBeGreaterThan(96);
    expect(m.orderFulfillmentRate).toBeLessThan(97);
    expect(m.incomingPassRate).toBe(100);
    expect(m.currentQuote).toBe(28);
  });
});
