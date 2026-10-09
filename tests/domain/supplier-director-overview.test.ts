import { describe, expect, it } from "vitest";
import { buildSupplierDirectorOverview } from "@/features/workbench/supplier-director-overview";
import { normalizeWorkbenchData } from "@/features/workbench/local-store";

const native = (overrides: Record<string, unknown> = {}) => ({
  id: "native-inbound",
  supplierId: "supplier-a",
  businessMode: "inbound" as const,
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  schemeName: "入仓评分",
  totalScore: 78,
  grade: "合格",
  metrics: { onTimeDeliveryRateQuantity: 91 },
  riskLabels: [],
  sourceSystem: "jushuitan",
  sourceRecordKey: "row-a",
  importBatchId: "batch-a",
  importedAt: "2026-09-29T00:00:00.000Z",
  ...overrides,
});

describe("supplier director overview projection", () => {
  it("keeps native performance separate by business mode and period without synthesizing missing values", () => {
    const data = normalizeWorkbenchData({
      suppliers: [{ id: "supplier-a", name: "供方A", categories: [], riskTags: [], createdAt: "" }],
      supplierNativePerformanceSnapshots: [
        native(),
        native({ id: "native-dropship", businessMode: "dropship", sourceRecordKey: "row-b", totalScore: 0, metrics: {} }),
        native({ id: "native-old", periodStart: "2026-08-01", periodEnd: "2026-08-31", sourceRecordKey: "row-c" }),
      ],
    });

    const result = buildSupplierDirectorOverview(data, "2026-09", "2026-09-29");

    expect(result.nativePerformance.map((row) => [row.businessMode, row.totalScore])).toEqual(expect.arrayContaining([["inbound", 78], ["dropship", 0]]));
    const inbound = result.nativePerformance.find((row) => row.businessMode === "inbound");
    expect(inbound?.metrics.onTimeDeliveryRateQuantity).toBe(91);
    expect("purchaseReturnRate" in (inbound?.metrics ?? {})).toBe(false);
    expect(result.decisionActions).toEqual([]);
  });

  it("keeps source-linked lifecycle tasks as actions and leaves dropship risks in the dropship performance view", () => {
    const data = normalizeWorkbenchData({
      suppliers: [{ id: "supplier-a", name: "供方A", categories: [], riskTags: [], createdAt: "" }],
      supplierNativePerformanceSnapshots: [native()],
      supplierLifecycleRecords: [{
        id: "lifecycle-1", section: "performance", title: "质量整改复核", productScope: "产品A", businessMode: "inbound",
        supplierIds: ["supplier-a"], offerIds: [], status: "decision", priority: "high", owner: "采购负责人", dueDate: "2026-09-30",
        nextAction: "复核整改样品", result: "", evidence: "检验记录A", fields: {}, revision: 1,
        createdAt: "2026-09-20", updatedAt: "2026-09-20", history: [], sourceRecordIds: ["inbound-record-1"],
      }],
      supplierBusinessRecords: [{
        id: "drop-risk-1", kind: "dropship_period", supplierIds: ["supplier-a"], offerIds: [], productScope: "全店代发",
        status: "completed", title: "代发周期", owner: "", fields: {
          periodStart: "2026-09-14", periodEnd: "2026-09-20", paidOrders: "560", gmv: "1200",
          pickup48Rate: "90", paymentToSignHours: "50", refundRate: "12", rejectReturnRate: "0", response3mRate: "60",
        }, attachmentIds: [], revision: 1, createdAt: "", updatedAt: "",
      }],
    });

    const result = buildSupplierDirectorOverview(data, "2026-09", "2026-09-29");

    const lifecycleAction = result.decisionActions.find((action) => action.sourceRecordId === "lifecycle-1");
    const dropshipAction = result.decisionActions.find((action) => action.sourceRecordId === "drop-risk-1");
    expect(result.decisionActions).toHaveLength(1);
    expect(lifecycleAction?.owner).toBe("采购负责人");
    expect(lifecycleAction?.nextAction).toBe("复核整改样品");
    expect(dropshipAction).toBeUndefined();
  });
});
