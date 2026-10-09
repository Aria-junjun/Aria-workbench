import { describe, expect, it } from "vitest";
import {
  normalizeNativeSupplierPerformance,
  upsertNativeSupplierPerformanceSnapshots,
  type NativeSupplierPerformanceSnapshot,
} from "@/features/workbench/supplier-native-performance";

const snapshot = (overrides: Partial<NativeSupplierPerformanceSnapshot> = {}): NativeSupplierPerformanceSnapshot => ({
  id: "native-1",
  supplierId: "supplier-1",
  businessMode: "inbound",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  schemeName: "入仓评分方案",
  schemeVersion: "v1",
  totalScore: 82,
  grade: "良好",
  metrics: { onTimeDeliveryRateQuantity: 92 },
  riskLabels: [],
  sourceSystem: "jushuitan",
  sourceRecordKey: "record-1",
  importBatchId: "batch-1",
  importedAt: "2026-09-29T00:00:00.000Z",
  ...overrides,
});

describe("native supplier performance import contract", () => {
  it("preserves missing metrics as missing instead of filling them with zero", () => {
    const result = normalizeNativeSupplierPerformance(snapshot({ metrics: { qualityPassRate: 98 } }));

    expect(result.metrics).toEqual({ qualityPassRate: 98 });
    expect("purchaseReturnRate" in result.metrics).toBe(false);
  });

  it("rejects invalid periods and out-of-range native scores", () => {
    expect(() => normalizeNativeSupplierPerformance(snapshot({ periodStart: "2026-10-01" }))).toThrow();
    expect(() => normalizeNativeSupplierPerformance(snapshot({ totalScore: 101 }))).toThrow();
  });

  it("replaces the same source record idempotently without collapsing another same-period scheme", () => {
    const original = snapshot();
    const otherScheme = snapshot({ id: "native-2", schemeName: "新版入仓方案", schemeVersion: "v2", sourceRecordKey: "record-2" });
    const updated = snapshot({ totalScore: 78, importedAt: "2026-09-30T00:00:00.000Z" });

    const result = upsertNativeSupplierPerformanceSnapshots([original, otherScheme], [updated]);

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.sourceRecordKey === "record-1")?.totalScore).toBe(78);
    expect(result.find((item) => item.sourceRecordKey === "record-2")?.totalScore).toBe(82);
  });
});
