import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期须为 YYYY-MM-DD");

export const NativeSupplierPerformanceSnapshotSchema = z.object({
  id: z.string().min(1),
  supplierId: z.string().min(1),
  businessMode: z.enum(["inbound", "dropship"]),
  periodStart: date,
  periodEnd: date,
  schemeName: z.string().trim().min(1),
  schemeVersion: z.string().trim().optional(),
  totalScore: z.number().finite().min(0).max(100).optional(),
  grade: z.string().trim().optional(),
  /** 聚水潭原始指标值；未提供的指标保持缺失，不补 0。 */
  metrics: z.record(z.string(), z.number().finite().optional()).default({}),
  riskLabels: z.array(z.string()).default([]),
  sourceSystem: z.string().trim().min(1),
  sourceRecordKey: z.string().trim().min(1),
  importBatchId: z.string().trim().min(1),
  sourceFileName: z.string().optional(),
  importedAt: z.string().min(1),
}).superRefine((value, context) => {
  if (value.periodStart > value.periodEnd) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["periodEnd"], message: "评分周期结束日期不能早于开始日期" });
  }
});

export type NativeSupplierPerformanceSnapshot = z.infer<typeof NativeSupplierPerformanceSnapshotSchema>;

export function normalizeNativeSupplierPerformance(input: unknown): NativeSupplierPerformanceSnapshot {
  return NativeSupplierPerformanceSnapshotSchema.parse(input);
}

function sourceIdentity(snapshot: NativeSupplierPerformanceSnapshot) {
  return `${snapshot.sourceSystem}\u0000${snapshot.sourceRecordKey}`;
}

/** Upsert by source identity. Same supplier-period can retain multiple scheme versions. */
export function upsertNativeSupplierPerformanceSnapshots(
  existing: NativeSupplierPerformanceSnapshot[],
  incoming: unknown[],
): NativeSupplierPerformanceSnapshot[] {
  const result = new Map(existing.map((snapshot) => [sourceIdentity(snapshot), snapshot]));
  for (const rawSnapshot of incoming) {
    const snapshot = normalizeNativeSupplierPerformance(rawSnapshot);
    result.set(sourceIdentity(snapshot), snapshot);
  }
  return [...result.values()];
}
