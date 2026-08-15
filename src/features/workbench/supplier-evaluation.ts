import { z } from "zod";

export const SUPPLIER_GRADES = ["A", "B", "C", "D"] as const;
export type SupplierGrade = (typeof SUPPLIER_GRADES)[number];

// ===== 原始数据：订单记录 =====
export const SupplierOrderRecordSchema = z.object({
  id: z.string(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  productName: z.string().optional(),
  skuSpec: z.string().optional(),
  orderedAt: z.string().optional(),
  promisedDeliveryAt: z.string().optional(),
  actualDeliveryAt: z.string().optional(),
  orderQuantity: z.number().optional(),
  deliveredQuantity: z.number().optional(),
  isPeak: z.boolean().default(false),
  unitPrice: z.number().optional(),
  currency: z.string().default("CNY"),
  status: z.enum(["pending", "partial", "fulfilled", "overdue", "cancelled"]).optional(),
  note: z.string().optional(),
  source: z.enum(["manual", "chat_parse", "order_system"]).default("chat_parse"),
  sourceLineIndex: z.number().optional()
});
export type SupplierOrderRecord = z.infer<typeof SupplierOrderRecordSchema>;

// ===== 原始数据：质量问题 =====
export const SupplierQualityIssueSchema = z.object({
  id: z.string(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  orderRef: z.string().optional(),
  productName: z.string().optional(),
  reportedAt: z.string().optional(),
  issueCount: z.number().default(1),
  totalBatchSize: z.number().optional(),
  issueDescription: z.string().optional(),
  closedAt: z.string().optional(),
  isClosed: z.boolean().default(false),
  repeated: z.boolean().default(false),
  repeatedFromIssueId: z.string().optional(),
  source: z.enum(["manual", "chat_parse"]).default("chat_parse")
});
export type SupplierQualityIssue = z.infer<typeof SupplierQualityIssueSchema>;

// ===== 原始数据：承诺/报价变动/响应时长 =====
export const SupplierServiceEventSchema = z.object({
  id: z.string(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  type: z.enum(["promise", "price_change", "response", "cooperation_rating"]),
  content: z.string(),
  promisedAt: z.string().optional(),
  expectedAt: z.string().optional(),
  actualAt: z.string().optional(),
  fulfilled: z.boolean().optional(),
  priceBefore: z.number().optional(),
  priceAfter: z.number().optional(),
  marketPriceChangedAt: z.string().optional(),
  responseHours: z.number().optional(),
  cooperationScore: z.number().optional(),
  recordedAt: z.string().optional()
});
export type SupplierServiceEvent = z.infer<typeof SupplierServiceEventSchema>;

// ===== 原始数据：降本记录 =====
export const SupplierCostReductionSchema = z.object({
  id: z.string(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  productName: z.string().optional(),
  priceBefore: z.number(),
  priceAfter: z.number(),
  achievedAt: z.string().optional(),
  method: z.string().optional(),
  note: z.string().optional()
});
export type SupplierCostReduction = z.infer<typeof SupplierCostReductionSchema>;

// ===== 评估记录：原始指标 =====
export const SupplierEvaluationMetricsSchema = z.object({
  onTimeDeliveryRate: z.number().optional(),
  peakDeliveryRate: z.number().optional(),
  orderFulfillmentRate: z.number().optional(),
  expediteOnTimeRate: z.number().optional(),
  currentQuote: z.number().optional(),
  categoryLowestPrice: z.number().optional(),
  priceCompetitiveness: z.number().optional(),
  priceRiseResponseDays: z.number().optional(),
  priceDropResponseDays: z.number().optional(),
  priceStabilityScore: z.number().optional(),
  incomingPassRate: z.number().optional(),
  qualityIssueClosureRate: z.number().optional(),
  repeatIssueRate: z.number().optional(),
  promiseFulfillmentRate: z.number().optional(),
  avgResponseHours: z.number().optional(),
  cooperationAverageScore: z.number().optional()
});
export type SupplierEvaluationMetrics = z.infer<typeof SupplierEvaluationMetricsSchema>;

// ===== 评估记录：4维度得分 + 总分 + 等级 =====
export const SupplierEvaluationScoresSchema = z.object({
  delivery: z.number().min(0).max(100),
  cost: z.number().min(0).max(100),
  quality: z.number().min(0).max(100),
  service: z.number().min(0).max(100),
  total: z.number().min(0).max(100),
  grade: z.enum(SUPPLIER_GRADES)
});
export type SupplierEvaluationScores = z.infer<typeof SupplierEvaluationScoresSchema>;

// ===== 评估记录：单条评估完整记录 =====
export const SupplierEvaluationRecordSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  period: z.string().min(1),
  periodType: z.enum(["month", "quarter", "year"]).default("quarter"),
  scores: SupplierEvaluationScoresSchema,
  rawMetrics: SupplierEvaluationMetricsSchema.default({}),
  riskLabels: z.array(z.string()).default([]),
  note: z.string().optional(),
  evaluatedAt: z.string()
});
export type SupplierEvaluationRecord = z.infer<typeof SupplierEvaluationRecordSchema>;

// ===== 维度权重（全局可调）=====
export const QCDS_WEIGHTS = {
  delivery: 0.30,
  cost: 0.20,
  quality: 0.30,
  service: 0.20
} as const;

// ==============================================================
// 以下：算分引擎实现（Task 2 内容，写在同文件避免循环import）
// ==============================================================

const m = (n: number | undefined, fallback = 50): number =>
  typeof n === "number" && !Number.isNaN(n) ? n : fallback;

function responseHoursToScore(hours: number | undefined): number {
  const h = m(hours, 24);
  if (h <= 2) return 100;
  if (h <= 8) return 90;
  if (h <= 24) return 70;
  if (h <= 48) return 50;
  if (h <= 72) return 30;
  return 10;
}

function priceRiseDaysToScore(days: number | undefined): number {
  const d = m(days, 7);
  if (d <= 1) return 10;
  if (d <= 3) return 20;
  if (d <= 7) return 40;
  if (d <= 14) return 60;
  return 80;
}
function priceDropDaysToScore(days: number | undefined): number {
  const d = m(days, 10);
  if (d <= 1) return 100;
  if (d <= 3) return 90;
  if (d <= 7) return 80;
  if (d <= 14) return 70;
  return 50;
}

// ===== 交付得分 =====
export function calculateDeliveryScore(metrics: SupplierEvaluationMetrics): number {
  const otd = m(metrics.onTimeDeliveryRate);
  const peak = m(metrics.peakDeliveryRate);
  const fulfill = m(metrics.orderFulfillmentRate);
  const expedite = m(metrics.expediteOnTimeRate);
  return otd * 0.3 + peak * 0.3 + fulfill * 0.2 + expedite * 0.2;
}

// ===== 成本得分 =====
export function calculateCostScore(metrics: SupplierEvaluationMetrics): number {
  let compet = metrics.priceCompetitiveness;
  if (typeof compet !== "number" && metrics.categoryLowestPrice && metrics.currentQuote && metrics.currentQuote > 0) {
    compet = (metrics.categoryLowestPrice / metrics.currentQuote) * 100;
  }
  if (typeof compet !== "number") compet = 80;
  if (compet > 100) compet = 100;

  const riseScore = priceRiseDaysToScore(metrics.priceRiseResponseDays);
  const dropScore = priceDropDaysToScore(metrics.priceDropResponseDays);
  const responseScore = (riseScore + dropScore) / 2;
  const stability = m(metrics.priceStabilityScore, 70);

  return compet * 0.35 + responseScore * 0.4 + stability * 0.25;
}

// ===== 质量得分 =====
export function calculateQualityScore(metrics: SupplierEvaluationMetrics): number {
  const pass = m(metrics.incomingPassRate);
  const closure = m(metrics.qualityIssueClosureRate);
  const repeat = m(metrics.repeatIssueRate, 0);
  const nonRepeat = Math.max(0, Math.min(100, 100 - repeat));
  return pass * 0.5 + closure * 0.3 + nonRepeat * 0.2;
}

// ===== 服务得分 =====
export function calculateServiceScore(metrics: SupplierEvaluationMetrics): number {
  const promise = m(metrics.promiseFulfillmentRate);
  const respScore = responseHoursToScore(metrics.avgResponseHours);
  const coop = metrics.cooperationAverageScore;
  const coopScore = typeof coop === "number" ? (coop / 5) * 100 : 60;
  return promise * 0.45 + respScore * 0.3 + coopScore * 0.25;
}

// ===== 等级判定 =====
export function gradeFromTotal(total: number): SupplierGrade {
  if (total >= 85) return "A";
  if (total >= 70) return "B";
  if (total >= 60) return "C";
  return "D";
}

// ===== 4维度 → 总分+等级 =====
export function calculateTotalScoreAndGrade(dimScores: {
  delivery: number; cost: number; quality: number; service: number;
}) {
  const total =
    dimScores.delivery * QCDS_WEIGHTS.delivery +
    dimScores.cost * QCDS_WEIGHTS.cost +
    dimScores.quality * QCDS_WEIGHTS.quality +
    dimScores.service * QCDS_WEIGHTS.service;
  return { total, grade: gradeFromTotal(total) };
}

// ===== 风险标签 =====
export function deriveRiskLabels(metrics: SupplierEvaluationMetrics): string[] {
  const labels: string[] = [];
  if (typeof metrics.peakDeliveryRate === "number" && metrics.peakDeliveryRate < 50) labels.push("爆单不可靠");
  if (typeof metrics.promiseFulfillmentRate === "number" && metrics.promiseFulfillmentRate < 60) labels.push("言行不一");
  if (typeof metrics.avgResponseHours === "number" && metrics.avgResponseHours > 24) labels.push("响应慢");
  if (typeof metrics.priceRiseResponseDays === "number" && metrics.priceRiseResponseDays <= 2) labels.push("涨价过快");
  if (typeof metrics.repeatIssueRate === "number" && metrics.repeatIssueRate > 20) labels.push("质量问题反复");
  if (typeof metrics.orderFulfillmentRate === "number" && metrics.orderFulfillmentRate < 80) labels.push("常缺量");
  if (labels.length === 0) labels.push("无风险");
  return labels;
}

// ===== 端到端：raw metrics → 完整评估记录 =====
export function evaluateSupplierFromRaw(input: {
  supplierId: string;
  period: string;
  periodType?: "month" | "quarter" | "year";
  metrics: SupplierEvaluationMetrics;
  note?: string;
  evaluatedAt?: string;
}): SupplierEvaluationRecord {
  const delivery = calculateDeliveryScore(input.metrics);
  const cost = calculateCostScore(input.metrics);
  const quality = calculateQualityScore(input.metrics);
  const service = calculateServiceScore(input.metrics);
  const { total, grade } = calculateTotalScoreAndGrade({ delivery, cost, quality, service });
  const riskLabels = deriveRiskLabels(input.metrics);
  return SupplierEvaluationRecordSchema.parse({
    id: "ev_" + Math.random().toString(36).slice(2, 10),
    supplierId: input.supplierId,
    period: input.period,
    periodType: input.periodType ?? "quarter",
    scores: { delivery, cost, quality, service, total, grade },
    rawMetrics: input.metrics,
    riskLabels,
    note: input.note,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString().slice(0, 10)
  });
}

// ===== 从订单/质量/服务事件 → 聚合 metrics =====
export function aggregateMetricsFromRecords(input: {
  orders: SupplierOrderRecord[];
  qualityIssues: SupplierQualityIssue[];
  serviceEvents: SupplierServiceEvent[];
  referencePrices?: { categoryLowestPrice?: number };
}): SupplierEvaluationMetrics {
  const { orders, qualityIssues, serviceEvents, referencePrices } = input;

  const withPromised = orders.filter((o) => o.promisedDeliveryAt && o.actualDeliveryAt);
  const ontimeOrders = withPromised.filter(
    (o) => o.promisedDeliveryAt && o.actualDeliveryAt && o.actualDeliveryAt <= o.promisedDeliveryAt
  );
  const onTimeDeliveryRate = withPromised.length > 0 ? (ontimeOrders.length / withPromised.length) * 100 : undefined;

  const peakOrders = orders.filter((o) => o.isPeak && o.promisedDeliveryAt && o.actualDeliveryAt);
  const peakOnTime = peakOrders.filter((o) => o.actualDeliveryAt! <= o.promisedDeliveryAt!);
  const peakDeliveryRate = peakOrders.length > 0 ? (peakOnTime.length / peakOrders.length) * 100 : undefined;

  const withQtys = orders.filter((o) => typeof o.orderQuantity === "number" && typeof o.deliveredQuantity === "number");
  const orderFulfillmentRate =
    withQtys.length > 0
      ? (withQtys.reduce((s, o) => s + Math.min(1, o.deliveredQuantity! / o.orderQuantity!), 0) / withQtys.length) * 100
      : undefined;

  const withBatch = qualityIssues.filter((q) => typeof q.totalBatchSize === "number");
  const incomingPassRate =
    withBatch.length > 0
      ? (withBatch.reduce(
          (s, q) => s + Math.max(0, 1 - (q.issueCount / Math.max(1, q.totalBatchSize!))),
          0
        ) / withBatch.length) * 100
      : qualityIssues.length === 0 && orders.length > 0
      ? 100
      : undefined;

  const closed = qualityIssues.filter((q) => q.isClosed).length;
  const qualityIssueClosureRate = qualityIssues.length > 0 ? (closed / qualityIssues.length) * 100 : undefined;

  const repeated = qualityIssues.filter((q) => q.repeated || q.repeatedFromIssueId).length;
  const repeatIssueRate = qualityIssues.length > 0 ? (repeated / qualityIssues.length) * 100 : undefined;

  const promiseEvents = serviceEvents.filter((e) => e.type === "promise" && typeof e.fulfilled === "boolean");
  const promiseFulfillmentRate =
    promiseEvents.length > 0
      ? (promiseEvents.filter((e) => e.fulfilled).length / promiseEvents.length) * 100
      : undefined;

  const respEvents = serviceEvents.filter((e) => e.type === "response" && typeof e.responseHours === "number");
  const avgResponseHours =
    respEvents.length > 0
      ? respEvents.reduce((s, e) => s + (e.responseHours ?? 0), 0) / respEvents.length
      : undefined;

  const coopEvents = serviceEvents.filter((e) => e.type === "cooperation_rating" && typeof e.cooperationScore === "number");
  const cooperationAverageScore =
    coopEvents.length > 0
      ? coopEvents.reduce((s, e) => s + (e.cooperationScore ?? 0), 0) / coopEvents.length
      : undefined;

  const priceUpEvents = serviceEvents.filter(
    (e) => e.type === "price_change" && typeof e.priceAfter === "number" && typeof e.priceBefore === "number" && e.priceAfter > e.priceBefore
  );
  const priceDownEvents = serviceEvents.filter(
    (e) => e.type === "price_change" && typeof e.priceAfter === "number" && typeof e.priceBefore === "number" && e.priceAfter < e.priceBefore
  );
  const daysBetween = (a?: string, b?: string) => {
    if (!a || !b) return undefined;
    return Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000);
  };
  const riseDaysArr = priceUpEvents
    .map((e) => daysBetween(e.marketPriceChangedAt, e.recordedAt ?? e.actualAt))
    .filter((n): n is number => typeof n === "number");
  const dropDaysArr = priceDownEvents
    .map((e) => daysBetween(e.marketPriceChangedAt, e.recordedAt ?? e.actualAt))
    .filter((n): n is number => typeof n === "number");
  const riseDays = riseDaysArr.length > 0 ? riseDaysArr.reduce((s, n) => s + n, 0) / riseDaysArr.length : undefined;
  const dropDays = dropDaysArr.length > 0 ? dropDaysArr.reduce((s, n) => s + n, 0) / dropDaysArr.length : undefined;

  const latestQuote = [...orders].reverse().find((o) => typeof o.unitPrice === "number")?.unitPrice;

  return {
    onTimeDeliveryRate,
    peakDeliveryRate,
    orderFulfillmentRate,
    incomingPassRate,
    qualityIssueClosureRate,
    repeatIssueRate,
    promiseFulfillmentRate,
    avgResponseHours,
    cooperationAverageScore,
    priceRiseResponseDays: riseDays,
    priceDropResponseDays: dropDays,
    currentQuote: latestQuote,
    categoryLowestPrice: referencePrices?.categoryLowestPrice
  };
}
