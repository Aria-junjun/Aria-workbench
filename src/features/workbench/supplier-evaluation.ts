import { z } from "zod";

export const SUPPLIER_GRADES = ["A", "B", "C", "D"] as const;
export type SupplierGrade = (typeof SUPPLIER_GRADES)[number];

// ===== 合作模式（入仓 / 代发 / 混合）=====
export const SUPPLIER_BUSINESS_MODELS = ["inbound", "dropship", "hybrid"] as const;
export type SupplierBusinessModel = (typeof SUPPLIER_BUSINESS_MODELS)[number];

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
  sourceLineIndex: z.number().optional(),
  // ——— 人工干预：忽略此记录，不计入评分 ———
  ignored: z.boolean().default(false),
  ignoreReason: z.string().optional()
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
  source: z.enum(["manual", "chat_parse"]).default("chat_parse"),
  // —— 代发专属：是否为客户投诉/退货（入仓型是来料质检）——
  isCustomerReturn: z.boolean().default(false),
  wrongShipIssue: z.boolean().default(false), // 错发/漏发
  // ——— 人工干预：忽略此记录，不计入评分 ———
  ignored: z.boolean().default(false),
  ignoreReason: z.string().optional()
});
export type SupplierQualityIssue = z.infer<typeof SupplierQualityIssueSchema>;

// ===== 原始数据：承诺/报价变动/响应时长 + 新增综合分析 4 类 =====
export const SupplierServiceEventSchema = z.object({
  id: z.string(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  type: z.enum([
    "promise", "price_change", "response", "cooperation_rating",
    "attitude", "solution_proposal", "solution_fulfilled", "evasion"
  ]),
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
  recordedAt: z.string().optional(),
  // ——— 综合分析扩展字段 ———
  attitudeScore: z.number().optional(), // 1=极差 5=极好
  solutionRequested: z.boolean().optional(), // 我方是否提了问题/请求
  solutionProvided: z.boolean().optional(), // 对方是否给了方案
  solutionDelivered: z.boolean().optional(), // 方案后续是否落地
  evasionSeverity: z.number().optional(), // 推诿严重度 0-2
  // ——— 原文溯源 ———
  sourceLineText: z.string().optional(), // 解析时的原始聊天片段
  source: z.enum(["manual", "chat_parse"]).default("chat_parse"),
  // ——— 人工干预：忽略此记录，不计入评分 ———
  ignored: z.boolean().default(false),
  ignoreReason: z.string().optional()
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

// ===== 手动评分项（加分 or 扣分）=====
export const ManualDeductionSchema = z.object({
  id: z.string(),
  dimension: z.enum(["delivery", "cost", "quality", "service"]),
  type: z.enum(["deduction", "bonus"]).default("deduction"), // deduction=扣分, bonus=加分
  description: z.string(),
  points: z.number(), // 扣几分 or 加几分（正数）
  source: z.enum(["manual", "ai_suggest"]).default("manual"),
  createdAt: z.string().optional(),
  ignored: z.boolean().default(false),
});
export type ManualDeduction = z.infer<typeof ManualDeductionSchema>;

// ===== 评估记录：原始指标 =====
export const SupplierEvaluationMetricsSchema = z.object({
  onTimeDeliveryRate: z.number().optional(),
  peakDeliveryRate: z.number().optional(),
  orderFulfillmentRate: z.number().optional(),
  expediteOnTimeRate: z.number().optional(),
  // —— 交期SOP fallback：多少单是按默认7天标准判的（没明确承诺）——
  stdLeadTimeOrders: z.number().optional(),
  // —— 代发专属交付指标 ——
  shipWithin48hRate: z.number().optional(), // 转单后 48h 内发出率
  logisticsPickupOnTimeRate: z.number().optional(), // 揽收及时率

  currentQuote: z.number().optional(),
  categoryLowestPrice: z.number().optional(),
  priceCompetitiveness: z.number().optional(),
  priceRiseResponseDays: z.number().optional(),
  priceDropResponseDays: z.number().optional(),
  priceStabilityScore: z.number().optional(),

  incomingPassRate: z.number().optional(),        // 入仓型主指标
  qualityIssueClosureRate: z.number().optional(),
  repeatIssueRate: z.number().optional(),
  // —— 代发专属质量指标 ——
  customerReturnRate: z.number().optional(),      // 客退率
  wrongShipRate: z.number().optional(),           // 错发漏发率

  promiseFulfillmentRate: z.number().optional(),
  avgResponseHours: z.number().optional(),
  cooperationAverageScore: z.number().optional(),
  // —— 服务综合分析新增指标 ——
  attitudeAverageScore: z.number().optional(),    // 态度平均分（1-5）
  solutionProposalRate: z.number().optional(),    // 我方提问→对方给出方案的比例
  solutionFulfillmentRate: z.number().optional(), // 给出方案→实际落地的比例
  evasionCount: z.number().optional()             // 推诿次数（直接扣分项）
});
export type SupplierEvaluationMetrics = z.infer<typeof SupplierEvaluationMetricsSchema>;

export type SupplierAutoEvidence = {
  inboundSkuCount: number;
  inboundQuantity: number;
  shippedQuantity: number;
  returnQuantity: number;
  returnRate?: number;
  qualityScore?: number;
  dataCoveragePct: number;
  erpCostPrice?: number;
};

/** 聚水潭月度经营表能直接证明的供应商证据；缺失数据不补成满分。 */
export function buildSupplierAutoEvidence(input: {
  supplierId: string;
  period: string;
  periodType: "month" | "quarter" | "year";
  inboundSnapshots: Array<{ skuMasterId: string; period: string; supplierId?: string; receivedQuantity?: number }>;
  operatingSnapshots: Array<{ skuMasterId: string; period: string; shippedQuantity?: number; returnQuantity?: number; erpCostPrice?: number }>;
}): SupplierAutoEvidence {
  const inbound = input.inboundSnapshots.filter((row) =>
    row.supplierId === input.supplierId && sameReportingPeriod(row.period, input.period, input.periodType),
  );
  const inboundSkuIds = new Set(inbound.map((row) => row.skuMasterId));
  const inboundQuantity = inbound.reduce((sum, row) => sum + (row.receivedQuantity ?? 0), 0);
  const operatingBySku = new Map<string, (typeof input.operatingSnapshots)[number]>();
  for (const row of input.operatingSnapshots) {
    if (!inboundSkuIds.has(row.skuMasterId) || !sameReportingPeriod(row.period, input.period, input.periodType)) continue;
    operatingBySku.set(row.skuMasterId, row);
  }
  const operating = [...operatingBySku.values()];
  const shippedQuantity = operating.reduce((sum, row) => sum + (row.shippedQuantity ?? 0), 0);
  const returnQuantity = operating.reduce((sum, row) => sum + (row.returnQuantity ?? 0), 0);
  const hasReturnData = operating.some((row) => row.returnQuantity !== undefined && row.shippedQuantity !== undefined);
  const returnRate = hasReturnData && shippedQuantity > 0 ? Number(((returnQuantity / shippedQuantity) * 100).toFixed(2)) : undefined;
  const qualityScore = returnRate === undefined ? undefined : Number(Math.max(0, 100 - returnRate).toFixed(2));
  const costRows = operating.filter((row) => row.erpCostPrice !== undefined && row.shippedQuantity !== undefined);
  const costWeight = costRows.reduce((sum, row) => sum + (row.shippedQuantity ?? 0), 0);
  const erpCostPrice = costWeight > 0
    ? Number((costRows.reduce((sum, row) => sum + (row.erpCostPrice! * row.shippedQuantity!), 0) / costWeight).toFixed(4))
    : undefined;

  return {
    inboundSkuCount: inboundSkuIds.size,
    inboundQuantity,
    shippedQuantity,
    returnQuantity,
    returnRate,
    qualityScore,
    dataCoveragePct: inboundSkuIds.size > 0 ? Math.round((operatingBySku.size / inboundSkuIds.size) * 100) : 0,
    erpCostPrice,
  };
}

function sameReportingPeriod(value: string, anchor: string, periodType: "month" | "quarter" | "year") {
  const [anchorYear, anchorMonth] = anchor.split("-").map(Number);
  if (periodType === "month") return value === anchor;
  if (periodType === "year") return value === String(anchorYear) || value.startsWith(String(anchorYear) + "-");
  const quarter = anchor.includes("Q") ? Number(anchor.split("Q")[1]) : Math.ceil(anchorMonth / 3);
  if (value.includes("Q")) return value === String(anchorYear) + "-Q" + quarter;
  const [year, month] = value.split("-").map(Number);
  return year === anchorYear && Math.ceil(month / 3) === quarter;
}

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
  businessModel: z.enum(SUPPLIER_BUSINESS_MODELS).default("inbound"),
  scores: SupplierEvaluationScoresSchema,
  rawMetrics: SupplierEvaluationMetricsSchema.default({}),
  riskLabels: z.array(z.string()).default([]),
  note: z.string().optional(),
  evaluatedAt: z.string()
});
export type SupplierEvaluationRecord = z.infer<typeof SupplierEvaluationRecordSchema>;

// ===== 维度权重（按合作模式区分）=====
export const QCDS_WEIGHTS_INBOUND = {
  delivery: 0.30,
  cost: 0.20,
  quality: 0.30,
  service: 0.20
} as const;
export const QCDS_WEIGHTS_DROPSHIP = {
  delivery: 0.40,   // 代发：发货速度直接影响客户体验
  cost: 0.15,       // 代发：单价已含运费，议价空间小
  quality: 0.30,    // 代发：客诉/退残直接影响店铺评分
  service: 0.15
} as const;
export const QCDS_WEIGHTS_HYBRID = {
  delivery: 0.35,
  cost: 0.175,
  quality: 0.30,
  service: 0.175
} as const;
export const QCDS_WEIGHTS = QCDS_WEIGHTS_INBOUND; // 全局默认（兼容历史代码）

export function getQcdsWeights(model: SupplierBusinessModel) {
  if (model === "dropship") return QCDS_WEIGHTS_DROPSHIP;
  if (model === "hybrid") return QCDS_WEIGHTS_HYBRID;
  return QCDS_WEIGHTS_INBOUND;
}

// ===== 标准入仓交期 SOP =====
// 备料 3 天 + 入仓总周期（下单 → 到仓）：
//   ≤ 5 天 → 优秀 / 算准时（onTime=true）
//   6–7 天 → 正常 / 算准时（onTime=true）
//   8–9 天 → 临界（算准时，但 note 里标黄）
//   ≥ 10 天 → 延迟（onTime=false）
export const STD_LEAD_TIME_EXCELLENT_DAYS = 5;
export const STD_LEAD_TIME_NORMAL_DAYS = 7;
export const STD_LEAD_TIME_LATE_DAYS = 10;
export function stdPromisedDateStr(orderedAt?: string): string | undefined {
  if (!orderedAt) return undefined;
  const d = new Date(orderedAt);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + STD_LEAD_TIME_NORMAL_DAYS);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function daysBetween(a?: string, b?: string): number | undefined {
  if (!a || !b) return undefined;
  const av = new Date(a).getTime();
  const bv = new Date(b).getTime();
  if (Number.isNaN(av) || Number.isNaN(bv)) return undefined;
  return Math.round((bv - av) / 86400000);
}

// ==============================================================
// 以下：算分引擎实现（Task 2 内容，写在同文件避免循环import）
// ==============================================================

// 默认满分制：无数据=100分（满分），有异常才扣分
const m = (n: number | undefined, fallback = 100): number =>
  typeof n === "number" && !Number.isNaN(n) ? n : fallback;

function responseHoursToScore(hours: number | undefined): number {
  // 无数据=满分（正常响应不需要特别记录）
  if (typeof hours !== "number" || Number.isNaN(hours)) return 100;
  if (hours <= 2) return 100;
  if (hours <= 8) return 90;
  if (hours <= 24) return 80;
  if (hours <= 48) return 60;
  if (hours <= 72) return 40;
  return 20;
}

function priceRiseDaysToScore(days: number | undefined): number {
  // 无数据=满分（没有涨价就是好的）
  if (typeof days !== "number" || Number.isNaN(days)) return 100;
  if (days <= 1) return 20;
  if (days <= 3) return 40;
  if (days <= 7) return 60;
  if (days <= 14) return 80;
  return 100;
}
function priceDropDaysToScore(days: number | undefined): number {
  // 无数据=满分（没有降价变动就是稳定的）
  if (typeof days !== "number" || Number.isNaN(days)) return 100;
  if (days <= 1) return 100;
  if (days <= 3) return 90;
  if (days <= 7) return 80;
  if (days <= 14) return 70;
  return 50;
}

// ===== 交付得分（按合作模式自动切换）=====
export function calculateDeliveryScore(
  metrics: SupplierEvaluationMetrics,
  model: SupplierBusinessModel = "inbound"
): number {
  // 默认满分：无数据=100，有订单异常才扣分
  const otd = m(metrics.onTimeDeliveryRate);
  const peak = m(metrics.peakDeliveryRate);
  const fulfill = m(metrics.orderFulfillmentRate);
  const expedite = m(metrics.expediteOnTimeRate);
  if (model === "dropship") {
    const ship48 = m(metrics.shipWithin48hRate);
    const pickup = m(metrics.logisticsPickupOnTimeRate);
    return ship48 * 0.30 + pickup * 0.20 + otd * 0.20 + fulfill * 0.20 + expedite * 0.10;
  }
  return otd * 0.35 + peak * 0.30 + fulfill * 0.20 + expedite * 0.15;
}

// ===== 成本得分 =====
export function calculateCostScore(metrics: SupplierEvaluationMetrics): number {
  // 默认满分：样品已核验，无调价=满分
  let compet = metrics.priceCompetitiveness;
  if (typeof compet !== "number" && metrics.categoryLowestPrice && metrics.currentQuote && metrics.currentQuote > 0) {
    compet = (metrics.categoryLowestPrice / metrics.currentQuote) * 100;
  }
  if (typeof compet !== "number") compet = 100;
  if (compet > 100) compet = 100;

  const riseScore = priceRiseDaysToScore(metrics.priceRiseResponseDays);
  const dropScore = priceDropDaysToScore(metrics.priceDropResponseDays);
  const responseScore = (riseScore + dropScore) / 2;
  const stability = m(metrics.priceStabilityScore);

  return compet * 0.35 + responseScore * 0.4 + stability * 0.25;
}

// ===== 质量得分（按合作模式：入仓→来料合格率，代发→客退率/错发率）=====
export function calculateQualityScore(
  metrics: SupplierEvaluationMetrics,
  model: SupplierBusinessModel = "inbound"
): number {
  // 默认满分：样品已核验，无批次问题=满分
  const closure = m(metrics.qualityIssueClosureRate);
  const repeat = m(metrics.repeatIssueRate, 0);
  const nonRepeat = Math.max(0, Math.min(100, 100 - repeat));
  if (model === "dropship") {
    const retRate = m(metrics.customerReturnRate, 0);
    const returnScore = Math.max(0, Math.min(100, 100 - retRate));
    const wrongRate = m(metrics.wrongShipRate, 0);
    const wrongScore = Math.max(0, Math.min(100, 100 - wrongRate));
    return returnScore * 0.40 + wrongScore * 0.25 + closure * 0.20 + nonRepeat * 0.15;
  }
  const pass = m(metrics.incomingPassRate);
  return pass * 0.45 + closure * 0.35 + nonRepeat * 0.20;
}

// ===== 服务得分（综合：承诺+响应+配合+态度+方案+推诿）=====
export function calculateServiceScore(metrics: SupplierEvaluationMetrics): number {
  // 默认满分：正常沟通无异常=满分
  const promise = m(metrics.promiseFulfillmentRate);
  const respScore = responseHoursToScore(metrics.avgResponseHours);
  const coop = metrics.cooperationAverageScore;
  const coopScore = typeof coop === "number" ? (coop / 5) * 100 : 100;

  const att = metrics.attitudeAverageScore;
  const attitudeScore = typeof att === "number" ? Math.max(0, Math.min(100, (att / 5) * 100)) : 100;
  const solProp = m(metrics.solutionProposalRate);
  const solFulf = m(metrics.solutionFulfillmentRate);
  // 推诿次数：>0 每次直接扣 8 分，最多扣 40 分
  const evasions = metrics.evasionCount ?? 0;
  const evasionPenalty = Math.min(40, evasions * 8);

  const baseScore =
    promise * 0.30 +
    respScore * 0.15 +
    coopScore * 0.20 +
    attitudeScore * 0.15 +
    solProp * 0.10 +
    solFulf * 0.10;
  return Math.max(0, baseScore - evasionPenalty);
}

// ===== 等级判定 =====
export function gradeFromTotal(total: number): SupplierGrade {
  if (total >= 85) return "A";
  if (total >= 70) return "B";
  if (total >= 60) return "C";
  return "D";
}

// ===== 4维度 → 总分+等级（按合作模式权重）=====
export function calculateTotalScoreAndGrade(
  dimScores: { delivery: number; cost: number; quality: number; service: number },
  model: SupplierBusinessModel = "inbound"
) {
  const w = getQcdsWeights(model);
  const total =
    dimScores.delivery * w.delivery +
    dimScores.cost * w.cost +
    dimScores.quality * w.quality +
    dimScores.service * w.service;
  return { total, grade: gradeFromTotal(total) };
}

// ===== 风险标签（入仓/代发分别触发）=====
export function deriveRiskLabels(
  metrics: SupplierEvaluationMetrics,
  model: SupplierBusinessModel = "inbound"
): string[] {
  const labels: string[] = [];
  if (typeof metrics.peakDeliveryRate === "number" && metrics.peakDeliveryRate < 50) labels.push("爆单不可靠");
  if (typeof metrics.promiseFulfillmentRate === "number" && metrics.promiseFulfillmentRate < 60) labels.push("言行不一");
  if (typeof metrics.avgResponseHours === "number" && metrics.avgResponseHours > 24) labels.push("响应慢");
  if (typeof metrics.priceRiseResponseDays === "number" && metrics.priceRiseResponseDays <= 2) labels.push("涨价过快");
  if (typeof metrics.repeatIssueRate === "number" && metrics.repeatIssueRate > 20) labels.push("质量问题反复");
  if (typeof metrics.orderFulfillmentRate === "number" && metrics.orderFulfillmentRate < 80) labels.push("常缺量");
  if ((metrics.evasionCount ?? 0) >= 3) labels.push("推诿成性");
  if (model === "dropship") {
    if (typeof metrics.shipWithin48hRate === "number" && metrics.shipWithin48hRate < 60) labels.push("代发慢");
    if (typeof metrics.customerReturnRate === "number" && metrics.customerReturnRate > 10) labels.push("客退率高");
    if (typeof metrics.wrongShipRate === "number" && metrics.wrongShipRate > 5) labels.push("经常错发漏发");
  } else {
    if (typeof metrics.incomingPassRate === "number" && metrics.incomingPassRate < 85) labels.push("来料合格率低");
    if (typeof metrics.onTimeDeliveryRate === "number" && metrics.onTimeDeliveryRate < 70) labels.push("入仓不及时");
  }
  if (labels.length === 0) labels.push("无风险");
  return labels;
}

// ===== 端到端：raw metrics → 完整评估记录 =====
export function evaluateSupplierFromRaw(input: {
  supplierId: string;
  period: string;
  periodType?: "month" | "quarter" | "year";
  businessModel?: SupplierBusinessModel;
  metrics: SupplierEvaluationMetrics;
  manualDeductions?: ManualDeduction[];
  note?: string;
  evaluatedAt?: string;
}): SupplierEvaluationRecord {
  const model = input.businessModel ?? "inbound";
  let delivery = calculateDeliveryScore(input.metrics, model);
  let cost = calculateCostScore(input.metrics);
  let quality = calculateQualityScore(input.metrics, model);
  let service = calculateServiceScore(input.metrics);

  // 应用手动评分项：扣分从对应维度扣除，加分溢出（上限120分）
  const activeItems = (input.manualDeductions ?? []).filter((d) => !d.ignored);
  for (const item of activeItems) {
    const pts = Math.abs(item.points);
    const isBonus = item.type === "bonus";
    const maxScore = 120; // 加分上限120分
    if (item.dimension === "delivery") {
      delivery = isBonus ? Math.min(maxScore, delivery + pts) : Math.max(0, delivery - pts);
    }
    if (item.dimension === "cost") {
      cost = isBonus ? Math.min(maxScore, cost + pts) : Math.max(0, cost - pts);
    }
    if (item.dimension === "quality") {
      quality = isBonus ? Math.min(maxScore, quality + pts) : Math.max(0, quality - pts);
    }
    if (item.dimension === "service") {
      service = isBonus ? Math.min(maxScore, service + pts) : Math.max(0, service - pts);
    }
  }

  const { total, grade } = calculateTotalScoreAndGrade({ delivery, cost, quality, service }, model);
  const riskLabels = deriveRiskLabels(input.metrics, model);
  return SupplierEvaluationRecordSchema.parse({
    id: "ev_" + Math.random().toString(36).slice(2, 10),
    supplierId: input.supplierId,
    period: input.period,
    periodType: input.periodType ?? "quarter",
    businessModel: model,
    scores: { delivery, cost, quality, service, total, grade },
    rawMetrics: input.metrics,
    riskLabels,
    note: input.note,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString().slice(0, 10)
  });
}

// ===== 中间计算过程暴露（供 UI 展示公式展开）=====

export type SubMetricDetail = {
  key: string;
  label: string;
  value: number | undefined;
  displayValue: string;
  formula: string;
  source: string;
  weight: number;
  weightedScore: number;
};

export type DimensionBreakdown = {
  dimension: "delivery" | "cost" | "quality" | "service";
  label: string;
  weight: number;
  score: number;
  subMetrics: SubMetricDetail[];
  formulaText: string;
};

export type RiskTriggerDetail = {
  label: string;
  metricKey: string;
  metricLabel: string;
  metricValue: number;
  threshold: number;
  comparison: "<" | ">";
  reason: string;
};

export type ScoreBreakdown = {
  dimensions: DimensionBreakdown[];
  totalFormulaText: string;
  total: number;
  grade: SupplierGrade;
  riskTriggers: RiskTriggerDetail[];
};

function fmtPct(n: number | undefined): string {
  return typeof n === "number" ? `${Math.round(n)}%` : "—";
}
function fmtNum(n: number | undefined, suffix = ""): string {
  return typeof n === "number" ? `${n}${suffix}` : "—";
}

export function getDeliveryBreakdown(
  metrics: SupplierEvaluationMetrics,
  model: SupplierBusinessModel = "inbound"
): DimensionBreakdown {
  const w = model === "dropship"
    ? { otd: 0.20, peak: 0.0, fulfill: 0.20, expedite: 0.10, ship48: 0.30, pickup: 0.20 }
    : { otd: 0.35, peak: 0.30, fulfill: 0.20, expedite: 0.15, ship48: 0, pickup: 0 };
  const otd = m(metrics.onTimeDeliveryRate);
  const peak = m(metrics.peakDeliveryRate);
  const fulfill = m(metrics.orderFulfillmentRate);
  const expedite = m(metrics.expediteOnTimeRate);
  const ship48 = m(metrics.shipWithin48hRate);
  const pickup = m(metrics.logisticsPickupOnTimeRate);
  const formulaTag =
    model === "dropship" ? "（代发型公式）" :
    model === "hybrid" ? "（混合型公式）" : "（入仓型公式）";

  const subsAll: SubMetricDetail[] = [
    model === "dropship" || model === "hybrid"
      ? { key: "shipWithin48hRate", label: "48h发货率", value: metrics.shipWithin48hRate, displayValue: fmtPct(metrics.shipWithin48hRate), formula: "= 转单后 2 天内发出批数 ÷ 总批数", source: "代发场景时效考核", weight: w.ship48, weightedScore: ship48 * w.ship48 }
      : null,
    model === "dropship"
      ? { key: "logisticsPickupOnTimeRate", label: "揽收及时率", value: metrics.logisticsPickupOnTimeRate, displayValue: fmtPct(metrics.logisticsPickupOnTimeRate), formula: "= 当日有揽收信息批数 ÷ 总批数", source: "快递配合度", weight: w.pickup, weightedScore: pickup * w.pickup }
      : null,
    { key: "onTimeDeliveryRate", label: "准时交付率", value: metrics.onTimeDeliveryRate, displayValue: fmtPct(metrics.onTimeDeliveryRate), formula: "= 按时批数 ÷ 总批数\n（无明确承诺时默认：下单+7天=约定交期）", source: `自动从订单记录抓取${metrics.stdLeadTimeOrders ? ` · 其中按标准7天判 ${metrics.stdLeadTimeOrders} 单` : ""}`, weight: w.otd, weightedScore: otd * w.otd },
    { key: "peakDeliveryRate", label: "峰值交付率", value: metrics.peakDeliveryRate, displayValue: fmtPct(metrics.peakDeliveryRate), formula: "= 旺季按时批数 ÷ 旺季总批数", source: "爆单时表现", weight: w.peak, weightedScore: peak * w.peak },
    { key: "orderFulfillmentRate", label: "订单满足率", value: metrics.orderFulfillmentRate, displayValue: fmtPct(metrics.orderFulfillmentRate), formula: "= 实际到货量 ÷ 下单量", source: "自动从到货数量算", weight: w.fulfill, weightedScore: fulfill * w.fulfill },
    { key: "expediteOnTimeRate", label: "加急兑现率", value: metrics.expediteOnTimeRate, displayValue: fmtPct(metrics.expediteOnTimeRate), formula: "= 加急按时批数 ÷ 加急总批数", source: "加急订单表现", weight: w.expedite, weightedScore: expedite * w.expedite },
  ].filter((s): s is SubMetricDetail => !!s && s.weight > 0);

  const score = calculateDeliveryScore(metrics, model);
  const formulaTextRaw = subsAll
    .map((s) => `${Math.round(s.weightedScore / s.weight)}×${s.weight}`)
    .join(" + ");
  return {
    dimension: "delivery", label: `交付 ${formulaTag}`, weight: getQcdsWeights(model).delivery, score,
    subMetrics: subsAll,
    formulaText: `${formulaTextRaw} = ${Math.round(score)}`
  };
}

export function getCostBreakdown(metrics: SupplierEvaluationMetrics): DimensionBreakdown {
  let compet = metrics.priceCompetitiveness;
  if (typeof compet !== "number" && metrics.categoryLowestPrice && metrics.currentQuote && metrics.currentQuote > 0) {
    compet = (metrics.categoryLowestPrice / metrics.currentQuote) * 100;
  }
  if (typeof compet !== "number") compet = 100;
  if (compet > 100) compet = 100;

  const riseScore = priceRiseDaysToScore(metrics.priceRiseResponseDays);
  const dropScore = priceDropDaysToScore(metrics.priceDropResponseDays);
  const responseScore = (riseScore + dropScore) / 2;
  const stability = m(metrics.priceStabilityScore);

  const subs: SubMetricDetail[] = [
    { key: "priceCompetitiveness", label: "价格竞争力", value: compet, displayValue: fmtPct(compet), formula: metrics.currentQuote && metrics.categoryLowestPrice ? `= ${metrics.categoryLowestPrice}/${metrics.currentQuote}×100` : "= 同品类最低价 ÷ 当前报价", source: "同品类比价", weight: 0.35, weightedScore: compet * 0.35 },
    { key: "priceResponse", label: "涨降价响应", value: responseScore, displayValue: fmtPct(responseScore), formula: `= (涨价响应${fmtNum(metrics.priceRiseResponseDays, "天")} + 降价响应${fmtNum(metrics.priceDropResponseDays, "天")}) 综合得分`, source: "市场变动后跟进速度", weight: 0.4, weightedScore: responseScore * 0.4 },
    { key: "priceStabilityScore", label: "价格稳定性", value: metrics.priceStabilityScore, displayValue: fmtPct(metrics.priceStabilityScore), formula: "= 一定周期内价格波动幅度", source: "历史报价波动", weight: 0.25, weightedScore: stability * 0.25 },
  ];
  const score = calculateCostScore(metrics);
  return {
    dimension: "cost", label: "成本", weight: QCDS_WEIGHTS.cost, score,
    subMetrics: subs,
    formulaText: `${Math.round(compet)}×0.35 + ${Math.round(responseScore)}×0.4 + ${Math.round(stability)}×0.25 = ${Math.round(score)}`
  };
}

export function getQualityBreakdown(
  metrics: SupplierEvaluationMetrics,
  model: SupplierBusinessModel = "inbound"
): DimensionBreakdown {
  const closure = m(metrics.qualityIssueClosureRate);
  const repeat = m(metrics.repeatIssueRate, 0);
  const nonRepeat = Math.max(0, Math.min(100, 100 - repeat));

  if (model === "dropship") {
    const retRate = m(metrics.customerReturnRate, 0);
    const returnScore = Math.max(0, Math.min(100, 100 - retRate));
    const wrongRate = m(metrics.wrongShipRate, 0);
    const wrongScore = Math.max(0, Math.min(100, 100 - wrongRate));
    const w = { ret: 0.40, wrong: 0.25, closure: 0.20, nonRepeat: 0.15 };
    const subs: SubMetricDetail[] = [
      { key: "customerReturnRate", label: "客退率（逆向）", value: metrics.customerReturnRate, displayValue: fmtPct(metrics.customerReturnRate), formula: "= 客户退残批数 ÷ 代发总批数（得分=100-比率）", source: "代发售后数据", weight: w.ret, weightedScore: returnScore * w.ret },
      { key: "wrongShipRate", label: "错发漏发率（逆向）", value: metrics.wrongShipRate, displayValue: fmtPct(metrics.wrongShipRate), formula: "= 错/漏发批数 ÷ 代发总批数（得分=100-比率）", source: "客户反馈", weight: w.wrong, weightedScore: wrongScore * w.wrong },
      { key: "qualityIssueClosureRate", label: "质量问题闭环率", value: metrics.qualityIssueClosureRate, displayValue: fmtPct(metrics.qualityIssueClosureRate), formula: "= 已关闭问题数 ÷ 总问题数", source: "售后处理跟踪", weight: w.closure, weightedScore: closure * w.closure },
      { key: "repeatIssueRate", label: "重复发生率（逆向）", value: metrics.repeatIssueRate, displayValue: fmtPct(metrics.repeatIssueRate), formula: "= 重复问题 ÷ 总问题（逆向，扣分制）", source: "同类问题再发", weight: w.nonRepeat, weightedScore: nonRepeat * w.nonRepeat },
    ];
    const score = calculateQualityScore(metrics, model);
    return {
      dimension: "quality", label: "质量（代发型公式）", weight: QCDS_WEIGHTS_DROPSHIP.quality, score,
      subMetrics: subs,
      formulaText: `${Math.round(returnScore)}×0.4 + ${Math.round(wrongScore)}×0.25 + ${Math.round(closure)}×0.2 + ${Math.round(nonRepeat)}×0.15 = ${Math.round(score)}`
    };
  }

  const pass = m(metrics.incomingPassRate);
  const w = { pass: 0.45, closure: 0.35, nonRepeat: 0.20 };
  const subs: SubMetricDetail[] = [
    { key: "incomingPassRate", label: "来料合格率", value: metrics.incomingPassRate, displayValue: fmtPct(metrics.incomingPassRate), formula: "= 合格批数 ÷ 来料总批数", source: "入仓前IQC验收", weight: w.pass, weightedScore: pass * w.pass },
    { key: "qualityIssueClosureRate", label: "质量问题闭环率", value: metrics.qualityIssueClosureRate, displayValue: fmtPct(metrics.qualityIssueClosureRate), formula: "= 已关闭问题数 ÷ 总问题数", source: "质量问题跟踪", weight: w.closure, weightedScore: closure * w.closure },
    { key: "repeatIssueRate", label: "重复发生率（逆向）", value: metrics.repeatIssueRate, displayValue: fmtPct(metrics.repeatIssueRate), formula: "= 重复问题 ÷ 总问题（逆向，扣分制）", source: "同类问题再发", weight: w.nonRepeat, weightedScore: nonRepeat * w.nonRepeat },
  ];
  const score = calculateQualityScore(metrics, model);
  const formulaTag = model === "hybrid" ? "（混合型公式）" : "（入仓型公式）";
  return {
    dimension: "quality", label: `质量 ${formulaTag}`, weight: getQcdsWeights(model).quality, score,
    subMetrics: subs,
    formulaText: `${Math.round(pass)}×0.45 + ${Math.round(closure)}×0.35 + ${Math.round(nonRepeat)}×0.2 = ${Math.round(score)}`
  };
}

export function getServiceBreakdown(metrics: SupplierEvaluationMetrics): DimensionBreakdown {
  const promise = m(metrics.promiseFulfillmentRate);
  const respScore = responseHoursToScore(metrics.avgResponseHours);
  const coop = metrics.cooperationAverageScore;
  const coopScore = typeof coop === "number" ? (coop / 5) * 100 : 100;
  const att = metrics.attitudeAverageScore;
  const attitudeScore = typeof att === "number" ? Math.max(0, Math.min(100, (att / 5) * 100)) : 100;
  const solProp = m(metrics.solutionProposalRate);
  const solFulf = m(metrics.solutionFulfillmentRate);
  const evasions = metrics.evasionCount ?? 0;
  const evasionPenalty = Math.min(40, evasions * 8);

  const subs: SubMetricDetail[] = [
    { key: "promiseFulfillmentRate", label: "承诺兑现率", value: metrics.promiseFulfillmentRate, displayValue: fmtPct(metrics.promiseFulfillmentRate), formula: "= 兑现承诺数 ÷ 总承诺数", source: "沟通记录中的承诺跟踪", weight: 0.30, weightedScore: promise * 0.30 },
    { key: "avgResponseHours", label: "平均响应时长", value: metrics.avgResponseHours, displayValue: fmtNum(metrics.avgResponseHours, "小时"), formula: `→ 得分${Math.round(respScore)}（≤2h=100，≤8h=90，≤24h=70）`, source: "消息回复时间差", weight: 0.15, weightedScore: respScore * 0.15 },
    { key: "cooperationAverageScore", label: "配合度评分", value: coop, displayValue: typeof coop === "number" ? `${coop}/5` : "—", formula: "= 每次沟通后主观打分（或语义分析）取平均", source: "综合评估", weight: 0.20, weightedScore: coopScore * 0.20 },
    { key: "attitudeAverageScore", label: "态度平均分", value: att, displayValue: typeof att === "number" ? `${att}/5` : "—", formula: "= 语义识别到的态度取平均（1差-5好）", source: "聊天内容综合分析", weight: 0.15, weightedScore: attitudeScore * 0.15 },
    { key: "solutionProposalRate", label: "方案提出率", value: metrics.solutionProposalRate, displayValue: fmtPct(metrics.solutionProposalRate), formula: "= 我方提问后对方给出方案次数 ÷ 提问总数", source: "沟通内容自动识别", weight: 0.10, weightedScore: solProp * 0.10 },
    { key: "solutionFulfillmentRate", label: "方案兑现率", value: metrics.solutionFulfillmentRate, displayValue: fmtPct(metrics.solutionFulfillmentRate), formula: "= 给出方案后实际落地次数 ÷ 方案总数", source: "前后文对照", weight: 0.10, weightedScore: solFulf * 0.10 },
  ];
  const baseScore =
    promise * 0.30 + respScore * 0.15 + coopScore * 0.20 +
    attitudeScore * 0.15 + solProp * 0.10 + solFulf * 0.10;
  const finalScore = Math.max(0, baseScore - evasionPenalty);
  return {
    dimension: "service", label: "服务", weight: QCDS_WEIGHTS.service, score: finalScore,
    subMetrics: subs,
    formulaText:
      `${Math.round(promise)}×0.3 + ${Math.round(respScore)}×0.15 + ${Math.round(coopScore)}×0.2 + ` +
      `${Math.round(attitudeScore)}×0.15 + ${Math.round(solProp)}×0.1 + ${Math.round(solFulf)}×0.1` +
      (evasionPenalty > 0 ? `\n  基础 ${Math.round(baseScore)} − 推诿${evasions}次扣${evasionPenalty}分 = ${Math.round(finalScore)}` : ` = ${Math.round(finalScore)}`)
  };
}

export function getScoreBreakdown(
  metrics: SupplierEvaluationMetrics,
  model: SupplierBusinessModel = "inbound",
  manualDeductions: ManualDeduction[] = []
): ScoreBreakdown {
  let delivery = getDeliveryBreakdown(metrics, model);
  let cost = getCostBreakdown(metrics);
  let quality = getQualityBreakdown(metrics, model);
  let service = getServiceBreakdown(metrics);

  // 应用手动扣分项/加分项到维度分数（加分溢出上限120，扣分下限0）
  const activeItems = manualDeductions.filter((d) => !d.ignored);
  for (const item of activeItems) {
    const pts = Math.abs(item.points);
    const isBonus = item.type === "bonus";
    const maxScore = 120;
    if (item.dimension === "delivery") {
      delivery = { ...delivery, score: isBonus ? Math.min(maxScore, delivery.score + pts) : Math.max(0, delivery.score - pts) };
    }
    if (item.dimension === "cost") {
      cost = { ...cost, score: isBonus ? Math.min(maxScore, cost.score + pts) : Math.max(0, cost.score - pts) };
    }
    if (item.dimension === "quality") {
      quality = { ...quality, score: isBonus ? Math.min(maxScore, quality.score + pts) : Math.max(0, quality.score - pts) };
    }
    if (item.dimension === "service") {
      service = { ...service, score: isBonus ? Math.min(maxScore, service.score + pts) : Math.max(0, service.score - pts) };
    }
  }

  const { total, grade } = calculateTotalScoreAndGrade(
    { delivery: delivery.score, cost: cost.score, quality: quality.score, service: service.score },
    model
  );
  const w = getQcdsWeights(model);
  const riskTriggers = getRiskTriggerDetails(metrics, model);
  const modelLabel = model === "dropship" ? "代发型权重" : model === "hybrid" ? "混合型权重" : "入仓型权重";
  return {
    dimensions: [delivery, cost, quality, service],
    totalFormulaText:
      `${Math.round(delivery.score)}×${w.delivery}（交付） + ` +
      `${Math.round(cost.score)}×${w.cost}（成本） + ` +
      `${Math.round(quality.score)}×${w.quality}（质量） + ` +
      `${Math.round(service.score)}×${w.service}（服务） = ${Math.round(total)}分 → ${grade}级\n（${modelLabel}）`,
    total, grade, riskTriggers
  };
}

export function getRiskTriggerDetails(
  metrics: SupplierEvaluationMetrics,
  model: SupplierBusinessModel = "inbound"
): RiskTriggerDetail[] {
  const triggers: RiskTriggerDetail[] = [];
  if (typeof metrics.peakDeliveryRate === "number" && metrics.peakDeliveryRate < 50) {
    triggers.push({ label: "爆单不可靠", metricKey: "peakDeliveryRate", metricLabel: "峰值交付率", metricValue: metrics.peakDeliveryRate, threshold: 50, comparison: "<", reason: `峰值交付率${Math.round(metrics.peakDeliveryRate)}%<50% → 爆单不可靠` });
  }
  if (typeof metrics.promiseFulfillmentRate === "number" && metrics.promiseFulfillmentRate < 60) {
    triggers.push({ label: "言行不一", metricKey: "promiseFulfillmentRate", metricLabel: "承诺兑现率", metricValue: metrics.promiseFulfillmentRate, threshold: 60, comparison: "<", reason: `承诺兑现率${Math.round(metrics.promiseFulfillmentRate)}%<60% → 言行不一` });
  }
  if (typeof metrics.avgResponseHours === "number" && metrics.avgResponseHours > 24) {
    triggers.push({ label: "响应慢", metricKey: "avgResponseHours", metricLabel: "平均响应时长", metricValue: metrics.avgResponseHours, threshold: 24, comparison: ">", reason: `平均响应${metrics.avgResponseHours}小时>24h → 响应慢` });
  }
  if (typeof metrics.priceRiseResponseDays === "number" && metrics.priceRiseResponseDays <= 2) {
    triggers.push({ label: "涨价过快", metricKey: "priceRiseResponseDays", metricLabel: "涨价响应天数", metricValue: metrics.priceRiseResponseDays, threshold: 2, comparison: "<", reason: `涨价响应仅${metrics.priceRiseResponseDays}天≤2天 → 涨价过快` });
  }
  if (typeof metrics.repeatIssueRate === "number" && metrics.repeatIssueRate > 20) {
    triggers.push({ label: "质量问题反复", metricKey: "repeatIssueRate", metricLabel: "重复发生率", metricValue: metrics.repeatIssueRate, threshold: 20, comparison: ">", reason: `重复发生率${Math.round(metrics.repeatIssueRate)}%>20% → 质量问题反复` });
  }
  if (typeof metrics.orderFulfillmentRate === "number" && metrics.orderFulfillmentRate < 80) {
    triggers.push({ label: "常缺量", metricKey: "orderFulfillmentRate", metricLabel: "订单满足率", metricValue: metrics.orderFulfillmentRate, threshold: 80, comparison: "<", reason: `订单满足率${Math.round(metrics.orderFulfillmentRate)}%<80% → 常缺量` });
  }
  if ((metrics.evasionCount ?? 0) >= 3) {
    triggers.push({ label: "推诿成性", metricKey: "evasionCount", metricLabel: "推诿次数", metricValue: metrics.evasionCount ?? 0, threshold: 3, comparison: ">", reason: `推诿共${metrics.evasionCount}次≥3次 → 供应商经常甩锅` });
  }
  if (model === "dropship") {
    if (typeof metrics.shipWithin48hRate === "number" && metrics.shipWithin48hRate < 60) {
      triggers.push({ label: "代发慢", metricKey: "shipWithin48hRate", metricLabel: "48h发货率", metricValue: metrics.shipWithin48hRate, threshold: 60, comparison: "<", reason: `48h内发货仅${Math.round(metrics.shipWithin48hRate)}%<60% → 代发慢直接影响客户体验` });
    }
    if (typeof metrics.customerReturnRate === "number" && metrics.customerReturnRate > 10) {
      triggers.push({ label: "客退率高", metricKey: "customerReturnRate", metricLabel: "客户退残率", metricValue: metrics.customerReturnRate, threshold: 10, comparison: ">", reason: `代发客退率${Math.round(metrics.customerReturnRate)}%>10% → 客户投诉风险高` });
    }
    if (typeof metrics.wrongShipRate === "number" && metrics.wrongShipRate > 5) {
      triggers.push({ label: "经常错发漏发", metricKey: "wrongShipRate", metricLabel: "错发漏发率", metricValue: metrics.wrongShipRate, threshold: 5, comparison: ">", reason: `错发漏发率${Math.round(metrics.wrongShipRate)}%>5% → 店铺DSR扣分` });
    }
  } else {
    if (typeof metrics.incomingPassRate === "number" && metrics.incomingPassRate < 85) {
      triggers.push({ label: "来料合格率低", metricKey: "incomingPassRate", metricLabel: "IQC来料合格率", metricValue: metrics.incomingPassRate, threshold: 85, comparison: "<", reason: `IQC来料合格率${Math.round(metrics.incomingPassRate)}%<85% → 仓库拒收率高` });
    }
    if (typeof metrics.onTimeDeliveryRate === "number" && metrics.onTimeDeliveryRate < 70) {
      triggers.push({ label: "入仓不及时", metricKey: "onTimeDeliveryRate", metricLabel: "准时入仓率", metricValue: metrics.onTimeDeliveryRate, threshold: 70, comparison: "<", reason: `准时入仓率${Math.round(metrics.onTimeDeliveryRate)}%<70% → 备货计划被打乱` });
    }
  }
  return triggers;
}

// ===== KPI 聚合（供列表页仪表盘使用）=====
export type SupplierKpiSummary = {
  total: number;
  active: number;
  backup: number;
  gradeA: number;
  gradeB: number;
  gradeC: number;
  gradeD: number;
  gradeAPct: number;
  avgScore: number;
  needsAction: number;
};

export function getSupplierKpiSummary(suppliers: Array<{
  cooperationLevel?: string;
  latestEvaluationGrade?: SupplierGrade;
  latestEvaluationScore?: number;
}>): SupplierKpiSummary {
  const total = suppliers.length;
  let active = 0, backup = 0;
  let gradeA = 0, gradeB = 0, gradeC = 0, gradeD = 0;
  let scoreSum = 0, scoreCount = 0;
  let needsAction = 0;
  for (const s of suppliers) {
    if (s.cooperationLevel === "backup" || s.cooperationLevel === "备选") backup++;
    else active++;
    const g = s.latestEvaluationGrade;
    const sc = s.latestEvaluationScore;
    if (g === "A") gradeA++;
    else if (g === "B") gradeB++;
    else if (g === "C") { gradeC++; needsAction++; }
    else if (g === "D") { gradeD++; needsAction++; }
    if (typeof sc === "number") { scoreSum += sc; scoreCount++; }
  }
  return {
    total, active, backup,
    gradeA, gradeB, gradeC, gradeD,
    gradeAPct: total > 0 ? Math.round((gradeA / total) * 1000) / 10 : 0,
    avgScore: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0,
    needsAction
  };
}

// ===== 从订单/质量/服务事件 → 聚合 metrics =====
export function aggregateMetricsFromRecords(input: {
  orders: SupplierOrderRecord[];
  qualityIssues: SupplierQualityIssue[];
  serviceEvents: SupplierServiceEvent[];
  referencePrices?: { categoryLowestPrice?: number };
}): SupplierEvaluationMetrics {
  // 过滤掉被人工忽略的记录
  const orders = input.orders.filter((o) => !o.ignored);
  const qualityIssues = input.qualityIssues.filter((q) => !q.ignored);
  const serviceEvents = input.serviceEvents.filter((s) => !s.ignored);
  const referencePrices = input.referencePrices;

  // ===== 交付：交期 SOP 固化（orderedAt+7天 默认标准，≤5天优秀/≤7天正常/≥10天延迟）=====
  let stdLeadTimeOrders = 0; // 计数：按默认标准判的订单数（无明确承诺）
  const deliveryAssessable: { ordered?: string; promised: string; actual: string; isPeak?: boolean; days: number }[] = [];
  for (const o of orders) {
    if (!o.orderedAt || !o.actualDeliveryAt) continue;
    // 优先用明确承诺交期，没有就用 orderedAt + STD_LEAD_TIME_NORMAL_DAYS(7天) 作为默认标准
    let promised = o.promisedDeliveryAt;
    let usedStd = false;
    if (!promised) {
      const fallback = stdPromisedDateStr(o.orderedAt);
      if (!fallback) continue;
      promised = fallback;
      usedStd = true;
    }
    const d = daysBetween(o.orderedAt, o.actualDeliveryAt);
    if (d === undefined) continue;
    if (usedStd) stdLeadTimeOrders++;
    deliveryAssessable.push({
      ordered: o.orderedAt,
      promised,
      actual: o.actualDeliveryAt,
      isPeak: o.isPeak,
      days: d
    });
  }

  // 准时交付率：≤ STD_LEAD_TIME_NORMAL_DAYS(7天) 算准时（≤5天优秀也算准时，≥10天算延迟）
  let onTimeDeliveryRate: number | undefined;
  if (deliveryAssessable.length > 0) {
    const ontime = deliveryAssessable.filter(
      (x) => x.actual <= x.promised && x.days <= STD_LEAD_TIME_NORMAL_DAYS
    ).length;
    onTimeDeliveryRate = (ontime / deliveryAssessable.length) * 100;
  }

  // 峰值交付率：仅峰值单
  const peakAssessable = deliveryAssessable.filter((x) => x.isPeak);
  let peakDeliveryRate: number | undefined;
  if (peakAssessable.length > 0) {
    const ontime = peakAssessable.filter(
      (x) => x.actual <= x.promised && x.days <= STD_LEAD_TIME_NORMAL_DAYS
    ).length;
    peakDeliveryRate = (ontime / peakAssessable.length) * 100;
  }
  // 峰值交付率 fallback：原逻辑兼容（有 promisedDeliveryAt 字段的峰值单）
  if (peakDeliveryRate === undefined) {
    const peakOrders = orders.filter((o) => o.isPeak && o.promisedDeliveryAt && o.actualDeliveryAt);
    const peakOnTime = peakOrders.filter((o) => o.actualDeliveryAt! <= o.promisedDeliveryAt!);
    if (peakOrders.length > 0) peakDeliveryRate = (peakOnTime.length / peakOrders.length) * 100;
  }

  const withQtys = orders.filter((o) => typeof o.orderQuantity === "number" && typeof o.deliveredQuantity === "number");
  const orderFulfillmentRate =
    withQtys.length > 0
      ? (withQtys.reduce((s, o) => s + Math.min(1, o.deliveredQuantity! / o.orderQuantity!), 0) / withQtys.length) * 100
      : undefined;

  // —— 代发专属交付指标：48h发货率 / 揽收及时率（通过 orderedAt → actualDeliveryAt ≤2天 估算 48h发货率）——
  let shipWithin48hRate: number | undefined;
  let logisticsPickupOnTimeRate: number | undefined;
  const dropshipAssessable = orders.filter(
    (o) => o.orderedAt && o.actualDeliveryAt
  );
  if (dropshipAssessable.length > 0) {
    const within48 = dropshipAssessable.filter((o) => {
      const d = daysBetween(o.orderedAt!, o.actualDeliveryAt!);
      return d !== undefined && d <= 2;
    }).length;
    shipWithin48hRate = (within48 / dropshipAssessable.length) * 100;
    // 揽收及时率：当前无快递信息，fallback 用 48h 发货率 × 0.9 做保守估计
    logisticsPickupOnTimeRate = Math.max(0, Math.min(100, shipWithin48hRate * 0.9));
  }

  // ===== 质量：入仓用 IQC 来料合格率 / 代发用客退率 + 错发漏发率 =====
  const withBatch = qualityIssues.filter((q) => typeof q.totalBatchSize === "number");
  let incomingPassRate: number | undefined;
  if (withBatch.length > 0) {
    incomingPassRate =
      (withBatch.reduce(
        (s, q) => s + Math.max(0, 1 - (q.issueCount / Math.max(1, q.totalBatchSize!))),
        0
      ) / withBatch.length) * 100;
  } else if (qualityIssues.length === 0 && orders.length > 0) {
    incomingPassRate = 100;
  }

  // —— 代发专属质量指标：客退率 / 错发漏发率 ——
  let customerReturnRate: number | undefined;
  let wrongShipRate: number | undefined;
  if (qualityIssues.length > 0) {
    const totalIssues = qualityIssues.length;
    const returns = qualityIssues.filter((q) => q.isCustomerReturn).length;
    const wrong = qualityIssues.filter((q) => q.wrongShipIssue).length;
    // 逆向比率（%）：以订单为分母
    if (orders.length > 0) {
      customerReturnRate = (returns / orders.length) * 100;
      wrongShipRate = (wrong / orders.length) * 100;
    }
  }

  const closed = qualityIssues.filter((q) => q.isClosed).length;
  const qualityIssueClosureRate = qualityIssues.length > 0 ? (closed / qualityIssues.length) * 100 : undefined;

  const repeated = qualityIssues.filter((q) => q.repeated || q.repeatedFromIssueId).length;
  const repeatIssueRate = qualityIssues.length > 0 ? (repeated / qualityIssues.length) * 100 : undefined;

  // ===== 服务：承诺兑现 + 响应 + 配合 + 态度 + 方案提出/兑现 + 推诿扣分 =====
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

  // —— 服务综合分析新增：态度平均分 / 方案提出率 / 方案兑现率 / 推诿次数 ——
  let attitudeAverageScore: number | undefined;
  const attEvents = serviceEvents.filter(
    (e) => e.type === "attitude" && typeof e.attitudeScore === "number"
  );
  if (attEvents.length > 0) {
    attitudeAverageScore = attEvents.reduce((s, e) => s + (e.attitudeScore ?? 3), 0) / attEvents.length;
  }

  // 方案提出率：solutionRequested=true 的事件中，solutionProvided=true 的比例
  let solutionProposalRate: number | undefined;
  const solRequestEvents = serviceEvents.filter(
    (e) => e.type === "solution_proposal" && typeof e.solutionRequested === "boolean"
  );
  if (solRequestEvents.length > 0) {
    const requests = solRequestEvents.filter((e) => e.solutionRequested === true);
    if (requests.length > 0) {
      const provided = requests.filter((e) => e.solutionProvided === true).length;
      solutionProposalRate = (provided / requests.length) * 100;
    }
  }
  // fallback：兼容旧数据（仅 solution_provided 字段 set）
  if (solutionProposalRate === undefined) {
    const solAll = serviceEvents.filter((e) => e.type === "solution_proposal");
    if (solAll.length > 0) {
      const provided = solAll.filter((e) => e.solutionProvided === true).length;
      solutionProposalRate = (provided / solAll.length) * 100;
    }
  }

  // 方案兑现率：solution_provided=true 中 solutionDelivered=true 的比例
  let solutionFulfillmentRate: number | undefined;
  const fulfilledEvents = serviceEvents.filter(
    (e) => (e.type === "solution_proposal" || e.type === "solution_fulfilled") && e.solutionProvided === true
  );
  if (fulfilledEvents.length > 0) {
    const delivered = fulfilledEvents.filter((e) => e.solutionDelivered === true).length;
    solutionFulfillmentRate = (delivered / fulfilledEvents.length) * 100;
  }

  // 推诿次数：每有一次 evasionSeverity > 0 就算 1 次
  let evasionCount: number | undefined;
  const evasionEvents = serviceEvents.filter(
    (e) => e.type === "evasion" && typeof e.evasionSeverity === "number" && e.evasionSeverity > 0
  );
  if (evasionEvents.length > 0) {
    evasionCount = evasionEvents.reduce((s, e) => s + Math.max(1, e.evasionSeverity ?? 1), 0);
  }

  // ===== 成本维度 =====
  const priceUpEvents = serviceEvents.filter(
    (e) => e.type === "price_change" && typeof e.priceAfter === "number" && typeof e.priceBefore === "number" && e.priceAfter > e.priceBefore
  );
  const priceDownEvents = serviceEvents.filter(
    (e) => e.type === "price_change" && typeof e.priceAfter === "number" && typeof e.priceBefore === "number" && e.priceAfter < e.priceBefore
  );
  const daysBetweenLocal = (a?: string, b?: string) => {
    if (!a || !b) return undefined;
    return Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000);
  };
  const riseDaysArr = priceUpEvents
    .map((e) => daysBetweenLocal(e.marketPriceChangedAt, e.recordedAt ?? e.actualAt))
    .filter((n): n is number => typeof n === "number");
  const dropDaysArr = priceDownEvents
    .map((e) => daysBetweenLocal(e.marketPriceChangedAt, e.recordedAt ?? e.actualAt))
    .filter((n): n is number => typeof n === "number");
  const riseDays = riseDaysArr.length > 0 ? riseDaysArr.reduce((s, n) => s + n, 0) / riseDaysArr.length : undefined;
  const dropDays = dropDaysArr.length > 0 ? dropDaysArr.reduce((s, n) => s + n, 0) / dropDaysArr.length : undefined;

  const latestQuote = [...orders].reverse().find((o) => typeof o.unitPrice === "number")?.unitPrice;

  return {
    onTimeDeliveryRate,
    peakDeliveryRate,
    orderFulfillmentRate,
    expediteOnTimeRate: undefined,
    stdLeadTimeOrders: stdLeadTimeOrders > 0 ? stdLeadTimeOrders : undefined,
    shipWithin48hRate,
    logisticsPickupOnTimeRate,

    currentQuote: latestQuote,
    categoryLowestPrice: referencePrices?.categoryLowestPrice,
    priceCompetitiveness: undefined,
    priceRiseResponseDays: riseDays,
    priceDropResponseDays: dropDays,
    priceStabilityScore: undefined,

    incomingPassRate,
    qualityIssueClosureRate,
    repeatIssueRate,
    customerReturnRate,
    wrongShipRate,

    promiseFulfillmentRate,
    avgResponseHours,
    cooperationAverageScore,
    attitudeAverageScore,
    solutionProposalRate,
    solutionFulfillmentRate,
    evasionCount
  };
}
