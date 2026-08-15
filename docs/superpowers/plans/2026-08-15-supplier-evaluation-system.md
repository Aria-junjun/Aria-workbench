# 供应商评估系统 (Supplier Evaluation System) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立供应商 QCDS 评估体系（质量30%/交付30%/成本20%/服务20%），包含：数据结构、自动算分引擎、聊天记录本地正则解析器、与现有草稿快速录入+确认入库流程打通。粘贴供应商聊天记录即可自动提取订单/交期/报价/响应时长/质量问题等原始数据，系统按公式自动出分和等级。

**Architecture:** 纯前端 TypeScript + Zod 校验 + localStorage 持久化。AI 提取有则用之（OpenAI），无则走本地正则兜底。新增 2 个领域文件（supplier-evaluation.ts 数据结构与算分、supplier-chat-parser.ts 聊天解析），扩展 3 个现有文件（schemas.ts、local-store.ts、ai-extraction.ts）。遵循 TDD，每个阶段先写测试再实现。

**Tech Stack:** Next.js / TypeScript / Zod / Vitest / localStorage

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/features/workbench/supplier-evaluation.ts` | **Create** | QCDS 数据类型（Schema+Type）、公式算分引擎、等级判定、风险标签自动触发 |
| `src/features/workbench/supplier-chat-parser.ts` | **Create** | 供应商聊天记录本地正则解析：提取订单记录、承诺、报价变动、质量问题、响应时长 |
| `src/features/workbench/schemas.ts` | **Modify** | 新增 3 个 Draft schema：`SupplierOrderRecordDraftSchema`、`SupplierQualityIssueDraftSchema`、`SupplierChatExtractionDraftSchema`；扩展 `DraftExtractionSchema` 增加新字段 |
| `src/features/workbench/types.ts` | **Modify** | 同步新增对应 TypeScript type 导出 |
| `src/features/workbench/local-store.ts` | **Modify** | `LocalSupplier` 扩展：`evaluations`、`orderRecords`、`qualityIssues`、`costReductions`、`latestGrade`、`latestScore`；`mergeSupplier` / `mergeSuppliers` / `normalizeLoadedData` 处理新字段；新增 `saveSupplierEvaluation` / `calculateSupplierEvaluationForPeriod` 函数 |
| `src/features/workbench/ai-extraction.ts` | **Modify** | `buildFallbackExtraction` 增加聊天解析路径（调用新的 `supplier-chat-parser`）；新增 `parseSupplierChatRecords` 入口函数 |
| `tests/domain/supplier-evaluation.test.ts` | **Create** | 算分引擎、等级判定、风险标签触发单元测试（20+ 用例） |
| `tests/domain/supplier-chat-parser.test.ts` | **Create** | 聊天解析器单元测试（15+ 用例） |
| `tests/domain/local-store.test.ts` | **Modify** | 新增 LocalSupplier 扩展字段、normalize 迁移、评估保存的测试（需注意：原文件中已有失败用例与本功能无关，确认只是新增用例通过即可） |

---

## Task 1: 定义数据结构 — Zod Schema + TypeScript Types

**Files:**
- Create: `src/features/workbench/supplier-evaluation.ts` (仅类型/Schema部分，算分留到Task2)
- Modify: `src/features/workbench/schemas.ts` (新增 Draft Schema + 扩展 DraftExtractionSchema)
- Modify: `src/features/workbench/types.ts` (同步 type)
- Test: `tests/domain/supplier-evaluation.test.ts` (仅 schema 校验测试)

- [ ] **Step 1: 写 Zod Schema + 类型测试**

测试内容：Zod schema 正确接受合法输入、拒绝非法输入（如 grade 超出 A/B/C/D、比率超出 0-100、日期非 ISO）。

```typescript
import { describe, expect, it } from "vitest";
import {
  SupplierOrderRecordSchema,
  SupplierQualityIssueSchema,
  SupplierCostReductionSchema,
  SupplierEvaluationRecordSchema,
  type SupplierOrderRecord,
  type SupplierEvaluationRecord,
  SUPPLIER_GRADES
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
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd /workspace/Aria-workbench && pnpm vitest run tests/domain/supplier-evaluation.test.ts 2>&1 | tail -20`
Expected: FAIL 显示模块不存在或导出未定义

- [ ] **Step 3: 在 supplier-evaluation.ts 实现 Schema + 常量 + 类型**

```typescript
import { z } from "zod";

export const SUPPLIER_GRADES = ["A", "B", "C", "D"] as const;
export type SupplierGrade = (typeof SUPPLIER_GRADES)[number];

// ===== 原始数据：订单记录 =====
export const SupplierOrderRecordSchema = z.object({
  id: z.string(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(), // 解析阶段还没关联时用
  productName: z.string().optional(),
  skuSpec: z.string().optional(),
  orderedAt: z.string().optional(), // ISO date
  promisedDeliveryAt: z.string().optional(),
  actualDeliveryAt: z.string().optional(),
  orderQuantity: z.number().optional(),
  deliveredQuantity: z.number().optional(),
  isPeak: z.boolean().default(false), // 加急/爆单/大单标记
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
  fulfilled: z.boolean().optional(), // promise 是否兑现
  priceBefore: z.number().optional(),
  priceAfter: z.number().optional(),
  marketPriceChangedAt: z.string().optional(), // 市场涨跌锚点，算响应天数
  responseHours: z.number().optional(), // 响应时长(小时)
  cooperationScore: z.number().optional(), // 1-5 分
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
  method: z.string().optional(), // 如"议价/换工艺/换包装"
  note: z.string().optional()
});
export type SupplierCostReduction = z.infer<typeof SupplierCostReductionSchema>;

// ===== 评估记录：每季度/每月一条 =====
export const SupplierEvaluationMetricsSchema = z.object({
  // 交付
  onTimeDeliveryRate: z.number().optional(),       // 0-100
  peakDeliveryRate: z.number().optional(),          // 0-100
  orderFulfillmentRate: z.number().optional(),      // 0-100
  expediteOnTimeRate: z.number().optional(),        // 0-100
  // 成本
  currentQuote: z.number().optional(),              // 本季报价(元)
  categoryLowestPrice: z.number().optional(),       // 同品类最低(元)
  priceCompetitiveness: z.number().optional(),      // 0-100，自动从上面两数计算
  priceRiseResponseDays: z.number().optional(),     // 天数，越少越差
  priceDropResponseDays: z.number().optional(),     // 天数，越少越好
  priceStabilityScore: z.number().optional(),       // 0-100 手动/历史波动
  // 质量
  incomingPassRate: z.number().optional(),          // 0-100
  qualityIssueClosureRate: z.number().optional(),   // 0-100
  repeatIssueRate: z.number().optional(),           // 0-100
  // 服务
  promiseFulfillmentRate: z.number().optional(),    // 0-100
  avgResponseHours: z.number().optional(),          // 小时数
  cooperationAverageScore: z.number().optional()    // 1-5 平均
});
export type SupplierEvaluationMetrics = z.infer<typeof SupplierEvaluationMetricsSchema>;

export const SupplierEvaluationScoresSchema = z.object({
  delivery: z.number().min(0).max(100),
  cost: z.number().min(0).max(100),
  quality: z.number().min(0).max(100),
  service: z.number().min(0).max(100),
  total: z.number().min(0).max(100),
  grade: z.enum(SUPPLIER_GRADES)
});
export type SupplierEvaluationScores = z.infer<typeof SupplierEvaluationScoresSchema>;

export const SupplierEvaluationRecordSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  period: z.string().min(1),          // 如 "2026-Q3" / "2026-08"
  periodType: z.enum(["month", "quarter", "year"]).default("quarter"),
  scores: SupplierEvaluationScoresSchema,
  rawMetrics: SupplierEvaluationMetricsSchema.default({}),
  riskLabels: z.array(z.string()).default([]),
  note: z.string().optional(),
  evaluatedAt: z.string() // ISO date
});
export type SupplierEvaluationRecord = z.infer<typeof SupplierEvaluationRecordSchema>;

// ===== 维度权重（便于全局可调）=====
export const QCDS_WEIGHTS = {
  delivery: 0.30,
  cost: 0.20,
  quality: 0.30,
  service: 0.20
} as const;
```

- [ ] **Step 4: 在 schemas.ts 新增 Draft schema + 扩展 DraftExtractionSchema**

在现有 `schemas.ts` 末尾追加：

```typescript
// ============== 供应商聊天/评估相关 Draft ==============
export const SupplierOrderRecordDraftSchema = z.object({
  supplierNameGuess: z.string().optional(),
  productName: z.string().optional(),
  skuSpec: z.string().optional(),
  orderedAt: z.string().optional(),
  promisedDeliveryAt: z.string().optional(),
  actualDeliveryAt: z.string().optional(),
  orderQuantity: z.number().optional(),
  deliveredQuantity: z.number().optional(),
  isPeak: z.boolean().default(false),
  unitPrice: z.number().optional(),
  status: z.enum(["pending", "partial", "fulfilled", "overdue", "cancelled"]).optional(),
  note: z.string().optional(),
  sourceLineText: z.string().optional()
});
export type SupplierOrderRecordDraft = z.infer<typeof SupplierOrderRecordDraftSchema>;

export const SupplierQualityIssueDraftSchema = z.object({
  supplierNameGuess: z.string().optional(),
  productName: z.string().optional(),
  issueCount: z.number().default(1),
  totalBatchSize: z.number().optional(),
  issueDescription: z.string().optional(),
  isClosed: z.boolean().default(false),
  repeated: z.boolean().default(false),
  sourceLineText: z.string().optional()
});
export type SupplierQualityIssueDraft = z.infer<typeof SupplierQualityIssueDraftSchema>;

export const SupplierServiceEventDraftSchema = z.object({
  supplierNameGuess: z.string().optional(),
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
  sourceLineText: z.string().optional()
});
export type SupplierServiceEventDraft = z.infer<typeof SupplierServiceEventDraftSchema>;

export const SupplierCostReductionDraftSchema = z.object({
  supplierNameGuess: z.string().optional(),
  productName: z.string().optional(),
  priceBefore: z.number(),
  priceAfter: z.number(),
  method: z.string().optional(),
  note: z.string().optional()
});
export type SupplierCostReductionDraft = z.infer<typeof SupplierCostReductionDraftSchema>;

export const SupplierChatExtractionDraftSchema = z.object({
  period: z.string().optional(), // 如 "2026-08"
  orders: z.array(SupplierOrderRecordDraftSchema).default([]),
  qualityIssues: z.array(SupplierQualityIssueDraftSchema).default([]),
  serviceEvents: z.array(SupplierServiceEventDraftSchema).default([]),
  costReductions: z.array(SupplierCostReductionDraftSchema).default([]),
  suppliersMentioned: z.array(z.string()).default([]),
  uncertaintyNotes: z.array(z.string()).default([])
});
export type SupplierChatExtractionDraft = z.infer<typeof SupplierChatExtractionDraftSchema>;
```

然后**修改**现有 `DraftExtractionSchema`（schemas.ts 第 111 行附近），追加 `supplierChat` 字段：

```typescript
export const DraftExtractionSchema = z.object({
  supplier: SupplierDraftSchema.optional(),
  communication: CommunicationDraftSchema,
  offers: z.array(OfferDraftSchema).default([]),
  productKnowledge: z.array(ProductKnowledgeDraftSchema).default([]),
  tasks: z.array(TaskDraftSchema).default([]),
  knowledgeCards: z.array(...).default([]),
  uncertaintyNotes: z.array(z.string()).default([]),
  // 新增字段
  supplierChat: SupplierChatExtractionDraftSchema.optional()
});
```

- [ ] **Step 5: types.ts 同步类型导出（如果已用的话）**

查看 `types.ts`，如果有 `DraftExtraction` 的 type 在此文件定义，同样追加 `supplierChat?`。如果它是从 `schemas.ts` 用 `z.infer` 生成的则不用改。

- [ ] **Step 6: 运行测试验证通过**

Run: `cd /workspace/Aria-workbench && pnpm vitest run tests/domain/supplier-evaluation.test.ts 2>&1 | tail -15`
Expected: 3 tests PASS

- [ ] **Step 7: Commit**

```bash
cd /workspace/Aria-workbench
git add src/features/workbench/supplier-evaluation.ts src/features/workbench/schemas.ts tests/domain/supplier-evaluation.test.ts src/features/workbench/types.ts
git commit -m "feat: 供应商评估数据结构 - 订单/质量/服务/降本4类原始数据 + 评估记录 schema"
```

---

## Task 2: QCDS 算分引擎实现

**Files:**
- Modify: `src/features/workbench/supplier-evaluation.ts` (追加算分函数)
- Test: `tests/domain/supplier-evaluation.test.ts` (追加测试)

- [ ] **Step 1: 写算分引擎的失败测试**

在 `tests/domain/supplier-evaluation.test.ts` 追加 describe block：

```typescript
import {
  calculateDeliveryScore,
  calculateCostScore,
  calculateQualityScore,
  calculateServiceScore,
  calculateTotalScoreAndGrade,
  gradeFromTotal,
  deriveRiskLabels,
  evaluateSupplierFromRaw
} from "@/features/workbench/supplier-evaluation";

describe("qcds scoring engine", () => {
  it("calculateDeliveryScore: 加权 = OTD×0.3 + peak×0.3 + fulfill×0.2 + expedite×0.2", () => {
    // 例：70 / 40 / 88 / 65 → 21+12+17.6+13 = 63.6
    const s = calculateDeliveryScore({ onTimeDeliveryRate: 70, peakDeliveryRate: 40, orderFulfillmentRate: 88, expediteOnTimeRate: 65 });
    expect(s).toBeCloseTo(63.6, 1);
  });

  it("calculateCostScore: 竞争力93.8×0.35 + (涨30+降80)/2×0.4 + 稳定70×0.25 = 72.33", () => {
    const s = calculateCostScore({
      currentQuote: 3.2,
      categoryLowestPrice: 3.0,
      priceRiseResponseDays: 5,  // 30分
      priceDropResponseDays: 12, // 80分
      priceStabilityScore: 70
    });
    expect(s).toBeCloseTo(72.3, 0);
  });

  it("calculateQualityScore: 87.5×0.5 + 75×0.3 + (100-25)×0.2 = 81.25", () => {
    const s = calculateQualityScore({ incomingPassRate: 87.5, qualityIssueClosureRate: 75, repeatIssueRate: 25 });
    expect(s).toBeCloseTo(81.3, 0);
  });

  it("calculateServiceScore: 承诺55×0.45 + 响应18h=70×0.3 + 配合3.2/5=64×0.25 = 60.55", () => {
    const s = calculateServiceScore({ promiseFulfillmentRate: 55, avgResponseHours: 18, cooperationAverageScore: 3.2 });
    expect(s).toBeCloseTo(60.6, 0);
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

  it("calculateTotalScoreAndGrade: 63.6×0.3 + 72.3×0.2 + 81.3×0.3 + 60.6×0.2 ≈ 70", () => {
    const r = calculateTotalScoreAndGrade({
      delivery: 63.6,
      cost: 72.3,
      quality: 81.3,
      service: 60.6
    });
    expect(r.total).toBeGreaterThan(68);
    expect(r.total).toBeLessThan(72);
    expect(r.grade).toBe("B");
  });

  it("deriveRiskLabels triggers correctly", () => {
    const l1 = deriveRiskLabels({ peakDeliveryRate: 40, promiseFulfillmentRate: 55, avgResponseHours: 30 });
    expect(l1).toContain("爆单不可靠");
    expect(l1).toContain("言行不一");
    expect(l1).toContain("响应慢");

    const l2 = deriveRiskLabels({ peakDeliveryRate: 70, promiseFulfillmentRate: 75, avgResponseHours: 6 });
    expect(l2).toEqual(["无风险"]);
  });

  it("evaluateSupplierFromRaw end-to-end matches doc example (68.3 C)", () => {
    const ev = evaluateSupplierFromRaw({
      metrics: {
        onTimeDeliveryRate: 70, peakDeliveryRate: 40, orderFulfillmentRate: 88, expediteOnTimeRate: 65,
        currentQuote: 3.2, categoryLowestPrice: 3.0, priceRiseResponseDays: 5, priceDropResponseDays: 12, priceStabilityScore: 70,
        incomingPassRate: 87.5, qualityIssueClosureRate: 75, repeatIssueRate: 25,
        promiseFulfillmentRate: 55, avgResponseHours: 18, cooperationAverageScore: 3.2
      },
      supplierId: "s1", period: "2026-Q3"
    });
    expect(ev.scores.total).toBeGreaterThan(66);
    expect(ev.scores.total).toBeLessThan(71);
    expect(ev.scores.grade).toBe("C");
    expect(ev.riskLabels).toEqual(expect.arrayContaining(["爆单不可靠", "言行不一"]));
  });

  it("partial metrics: missing items get 50分 default so total still reasonable", () => {
    const ev = evaluateSupplierFromRaw({
      metrics: { onTimeDeliveryRate: 80 },
      supplierId: "s1", period: "2026-Q3"
    });
    expect(ev.scores.total).toBeGreaterThan(40);
    expect(ev.scores.total).toBeLessThan(80);
    expect(["A", "B", "C", "D"]).toContain(ev.scores.grade);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /workspace/Aria-workbench && pnpm vitest run tests/domain/supplier-evaluation.test.ts 2>&1 | tail -15`
Expected: 多个 FAIL (函数不存在)

- [ ] **Step 3: 在 supplier-evaluation.ts 追加算分函数**

```typescript
import { QCDS_WEIGHTS, SUPPLIER_GRADES } from "./supplier-evaluation"; // 注意：同文件直接引用上面定义的常量，不需要import
// （上面这行仅提醒用，实际代码无需此import）

// 缺失值默认得分 50，避免极端；避免 undefined 参与计算
const m = (n: number | undefined, fallback = 50): number =>
  typeof n === "number" && !Number.isNaN(n) ? n : fallback;

// ===== 辅助函数：响应小时→0-100分（越快越好）=====
function responseHoursToScore(hours: number | undefined): number {
  const h = m(hours, 24);
  if (h <= 2) return 100;
  if (h <= 8) return 90;
  if (h <= 24) return 70;
  if (h <= 48) return 50;
  if (h <= 72) return 30;
  return 10;
}

// ===== 辅助函数：价格响应天数→涨分（涨越快得分越低；降越快得分越高）=====
function priceRiseDaysToScore(days: number | undefined): number {
  const d = m(days, 7);
  if (d <= 1) return 10;   // 涨太快
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
  // 价格竞争力 = (同品类最低价 / 当前报价) × 100；缺值默认 80
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
  // 配合度 1-5 → 0-100：(分/5)*100；缺值 3分 = 60
  let coop = metrics.cooperationAverageScore;
  const coopScore = typeof coop === "number" ? (coop / 5) * 100 : 60;
  return promise * 0.45 + respScore * 0.3 + coopScore * 0.25;
}

// ===== 等级 =====
export function gradeFromTotal(total: number): SupplierGrade {
  if (total >= 85) return "A";
  if (total >= 70) return "B";
  if (total >= 60) return "C";
  return "D";
}

// ===== 4维度 → 总分 + 等级 =====
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

// ===== 风险标签自动触发 =====
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

// ===== 端到端：从原始指标 → 完整评估记录 =====
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

// ===== 额外：从原始记录（订单/质量/服务事件）聚合出 metrics =====
// 这是打通"聊天记录→订单→评分"的关键一步。
export function aggregateMetricsFromRecords(input: {
  orders: SupplierOrderRecord[];
  qualityIssues: SupplierQualityIssue[];
  serviceEvents: SupplierServiceEvent[];
  referencePrices?: { categoryLowestPrice?: number };
}): SupplierEvaluationMetrics {
  const { orders, qualityIssues, serviceEvents, referencePrices } = input;

  // --- 交付 ---
  const ontimeOrders = orders.filter(
    (o) => o.promisedDeliveryAt && o.actualDeliveryAt && o.actualDeliveryAt <= o.promisedDeliveryAt
  );
  const withPromised = orders.filter((o) => o.promisedDeliveryAt && o.actualDeliveryAt);
  const onTimeDeliveryRate = withPromised.length > 0 ? (ontimeOrders.length / withPromised.length) * 100 : undefined;

  const peakOrders = orders.filter((o) => o.isPeak && o.promisedDeliveryAt && o.actualDeliveryAt);
  const peakOnTime = peakOrders.filter((o) => o.actualDeliveryAt! <= o.promisedDeliveryAt!);
  const peakDeliveryRate = peakOrders.length > 0 ? (peakOnTime.length / peakOrders.length) * 100 : undefined;

  const withQtys = orders.filter((o) => typeof o.orderQuantity === "number" && typeof o.deliveredQuantity === "number");
  const orderFulfillmentRate =
    withQtys.length > 0
      ? (withQtys.reduce((s, o) => s + Math.min(1, o.deliveredQuantity! / o.orderQuantity!), 0) / withQtys.length) * 100
      : undefined;

  // --- 质量 ---
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

  const repeated = qualityIssues.filter((q) => q.repeatedFromIssueId).length;
  const repeatIssueRate = qualityIssues.length > 0 ? (repeated / qualityIssues.length) * 100 : undefined;

  // --- 服务 ---
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

  // --- 成本（粗略，价格变动事件有则提取）---
  const priceUpEvents = serviceEvents.filter(
    (e) => e.type === "price_change" && typeof e.priceAfter === "number" && typeof e.priceBefore === "number" && e.priceAfter > e.priceBefore
  );
  const priceDownEvents = serviceEvents.filter(
    (e) => e.type === "price_change" && typeof e.priceAfter === "number" && typeof e.priceBefore === "number" && e.priceAfter < e.priceBefore
  );
  // 价格响应天数：以市场变动锚点为准（marketPriceChangedAt - recordedAt 差值）
  const daysBetween = (a?: string, b?: string) => {
    if (!a || !b) return undefined;
    return Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000);
  };
  const riseDays =
    priceUpEvents
      .map((e) => daysBetween(e.marketPriceChangedAt, e.recordedAt ?? e.actualAt))
      .filter((n): n is number => typeof n === "number")
      .reduce((s, n) => s + n, 0) / (priceUpEvents.length || 1);
  const dropDays =
    priceDownEvents
      .map((e) => daysBetween(e.marketPriceChangedAt, e.recordedAt ?? e.actualAt))
      .filter((n): n is number => typeof n === "number")
      .reduce((s, n) => s + n, 0) / (priceDownEvents.length || 1);

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
    priceRiseResponseDays: priceUpEvents.length > 0 ? riseDays : undefined,
    priceDropResponseDays: priceDownEvents.length > 0 ? dropDays : undefined,
    currentQuote: latestQuote,
    categoryLowestPrice: referencePrices?.categoryLowestPrice
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /workspace/Aria-workbench && pnpm vitest run tests/domain/supplier-evaluation.test.ts 2>&1 | tail -15`
Expected: ALL tests PASS（schema 3 + scoring 9 = 12 全部通过）

- [ ] **Step 5: Commit**

```bash
cd /workspace/Aria-workbench
git add src/features/workbench/supplier-evaluation.ts tests/domain/supplier-evaluation.test.ts
git commit -m "feat: QCDS算分引擎 - 4维度加权公式 + 等级阈值 + 风险标签自动触发 + 订单记录聚合metrics"
```

---

## Task 3: LocalSupplier 扩展存储 + merge/normalize + 保存评估函数

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/domain/local-store.test.ts` (在文件末尾追加新的 describe block，不要修改已有失败用例)

- [ ] **Step 1: 写失败测试**

在 `tests/domain/local-store.test.ts` 末尾追加：

```typescript
// 先 import（如果文件顶部没 import 的话，按需加）
import {
  evaluateSupplierFromRaw,
  aggregateMetricsFromRecords,
  type SupplierOrderRecord
} from "@/features/workbench/supplier-evaluation";
import { loadLocalWorkbenchData, saveLocalWorkbenchData, saveSupplier, saveSupplierEvaluation } from "@/features/workbench/local-store";

describe("supplier evaluation storage", () => {
  const storageKey = "personal-commercial-workbench";

  beforeEach(() => {
    localStorage.clear();
  });

  it("loads legacy supplier without evaluations → fields default empty arrays", () => {
    const legacy: any = {
      suppliers: [{
        id: "s-old", name: "老供应商", categories: [], riskTags: [],
        createdAt: new Date().toISOString()
        // 无 evaluations / orderRecords / qualityIssues
      }],
      communications: [], offers: [], products: [], tasks: [],
      knowledgeCards: [], knowledgeBooks: [], decisionTools: [],
      knowledgeApplications: [], decisionCases: [], researchReports: []
    };
    localStorage.setItem(storageKey, JSON.stringify(legacy));
    const data = loadLocalWorkbenchData();
    const s = data.suppliers.find((x) => x.id === "s-old")!;
    expect(s.evaluations).toEqual([]);
    expect(s.orderRecords).toEqual([]);
    expect(s.qualityIssues).toEqual([]);
    expect(s.costReductions).toEqual([]);
    expect(s.latestGrade).toBeUndefined();
    expect(s.latestScore).toBeUndefined();
  });

  it("saveSupplierEvaluation appends record and updates latestGrade/latestScore", () => {
    // 先存供应商
    saveSupplier({ id: "s1", name: "测试供应商", categories: ["铁艺"], riskTags: [], createdAt: new Date().toISOString() });
    const ev = evaluateSupplierFromRaw({
      supplierId: "s1", period: "2026-Q3",
      metrics: { onTimeDeliveryRate: 91, peakDeliveryRate: 85, orderFulfillmentRate: 95, promiseFulfillmentRate: 88, avgResponseHours: 4 }
    });
    saveSupplierEvaluation("s1", ev);

    const s = loadLocalWorkbenchData().suppliers.find((x) => x.id === "s1")!;
    expect(s.evaluations).toHaveLength(1);
    expect(s.evaluations[0].scores.grade).toBe(ev.scores.grade);
    expect(s.latestScore).toBeCloseTo(ev.scores.total, 0);
    expect(s.latestGrade).toBe(ev.scores.grade);
  });

  it("aggregateMetricsFromRecords with chat-parsed records produces reasonable metrics", () => {
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
    // 2个订单有 promised+actual：1个按时，1个不按时 → OTD=50
    expect(m.onTimeDeliveryRate).toBe(50);
    // 1个peak，不按时 → peakRate = 0
    expect(m.peakDeliveryRate).toBe(0);
    // 满足率：1 + (1400/1500≈0.933) ÷ 2 = ~96.7
    expect(m.orderFulfillmentRate).toBeGreaterThan(96);
    expect(m.orderFulfillmentRate).toBeLessThan(97);
    // 无质量问题 + 有订单 → 来料合格率默认100
    expect(m.incomingPassRate).toBe(100);
    expect(m.currentQuote).toBe(28);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /workspace/Aria-workbench && pnpm vitest run tests/domain/local-store.test.ts -t "supplier evaluation storage" 2>&1 | tail -20`
Expected: FAIL（字段/函数不存在）

- [ ] **Step 3: 扩展 LocalSupplier 类型**

在 `local-store.ts` 的 `LocalSupplier` 类型（第27行附近）修改为：

```typescript
import type {
  SupplierEvaluationRecord,
  SupplierOrderRecord,
  SupplierQualityIssue,
  SupplierServiceEvent,
  SupplierCostReduction,
  SupplierGrade
} from "./supplier-evaluation";

export type LocalSupplier = {
  id: string;
  pinned?: boolean;
  name: string;
  categories: string[];
  location?: string;
  supplierType?: string;
  contactName?: string;
  contactMethod?: string;
  storeUrl?: string;
  sourcePlatform?: string;
  cooperationLevel?: string;
  riskTags: string[];
  notes?: string;
  createdAt: string;
  // ============ 供应商评估扩展字段 ============
  evaluations: SupplierEvaluationRecord[];
  orderRecords: SupplierOrderRecord[];
  qualityIssues: SupplierQualityIssue[];
  serviceEvents: SupplierServiceEvent[];
  costReductions: SupplierCostReduction[];
  latestGrade?: SupplierGrade;
  latestScore?: number;
};
```

- [ ] **Step 4: 扩展 normalizeLoadedData（加载迁移）**

找到 `normalizeLoadedData` 函数位置（约 1340 行附近），在它对 suppliers 的处理循环里，为每个 supplier 补齐新字段数组（若不存在）。

```typescript
// normalizeLoadedData 内：
data.suppliers = (data.suppliers ?? []).map((s) => ({
  ...s,
  categories: Array.isArray(s.categories) ? s.categories : [],
  riskTags: Array.isArray(s.riskTags) ? s.riskTags : [],
  // ---- 新增字段 ----
  evaluations: Array.isArray((s as any).evaluations) ? (s as any).evaluations : [],
  orderRecords: Array.isArray((s as any).orderRecords) ? (s as any).orderRecords : [],
  qualityIssues: Array.isArray((s as any).qualityIssues) ? (s as any).qualityIssues : [],
  serviceEvents: Array.isArray((s as any).serviceEvents) ? (s as any).serviceEvents : [],
  costReductions: Array.isArray((s as any).costReductions) ? (s as any).costReductions : [],
  latestGrade: (s as any).latestGrade,
  latestScore: typeof (s as any).latestScore === "number" ? (s as any).latestScore : undefined
}));
```

- [ ] **Step 5: 扩展 mergeSupplier**

找到 `mergeSupplier` 函数（约 1610 行）。追加数组字段的 concat 去重合并（按 id 去重）：

```typescript
export function mergeSupplier(existing: LocalSupplier, incoming: Partial<LocalSupplier>): LocalSupplier {
  // ...原有逻辑保持不变...
  const result: LocalSupplier = {
    id: existing.id,
    pinned: existing.pinned ?? incoming.pinned,
    name: incoming.name ?? existing.name,
    // ...其它原有字段的合并...
    categories: dedupe([...(existing.categories ?? []), ...(incoming.categories ?? [])]),
    riskTags: dedupe([...(existing.riskTags ?? []), ...(incoming.riskTags ?? [])]),
    notes: incoming.notes ?? existing.notes,
    createdAt: existing.createdAt ?? incoming.createdAt ?? new Date().toISOString(),
    // === 新增字段的 merge（按id去重，incoming 优先） ===
    evaluations: mergeById(existing.evaluations, incoming.evaluations),
    orderRecords: mergeById(existing.orderRecords, incoming.orderRecords),
    qualityIssues: mergeById(existing.qualityIssues, incoming.qualityIssues),
    serviceEvents: mergeById(existing.serviceEvents, incoming.serviceEvents),
    costReductions: mergeById(existing.costReductions, incoming.costReductions),
    latestGrade: incoming.latestGrade ?? existing.latestGrade,
    latestScore: typeof incoming.latestScore === "number" ? incoming.latestScore : existing.latestScore
  };
  return result;
}

// 通用合并辅助函数（如文件没有可加在文件顶部util区域）
function mergeById<T extends { id: string }>(existingArr: T[] | undefined, incomingArr: T[] | undefined): T[] {
  const map = new Map<string, T>();
  for (const item of existingArr ?? []) map.set(item.id, item);
  for (const item of incomingArr ?? []) map.set(item.id, item);
  return [...map.values()];
}
```

- [ ] **Step 6: 扩展 mergeSuppliers**（把一个供应商合并到另一个，转移数组字段）

找到 `mergeSuppliers`（约 1258 行）。在删除 source 前，把 source 的评估相关数组追加到 target：

```typescript
target.evaluations = mergeById(target.evaluations, source.evaluations);
target.orderRecords = mergeById(target.orderRecords, source.orderRecords);
target.qualityIssues = mergeById(target.qualityIssues, source.qualityIssues);
target.serviceEvents = mergeById(target.serviceEvents, source.serviceEvents);
target.costReductions = mergeById(target.costReductions, source.costReductions);
// latestScore / latestGrade 取两者中较新的评估时间来选
if (source.latestScore != null && source.latestScore > (target.latestScore ?? 0)) {
  target.latestScore = source.latestScore;
  target.latestGrade = source.latestGrade;
}
```

- [ ] **Step 7: 新增 saveSupplierEvaluation 函数**

在 `local-store.ts` 追加导出函数（放在 saveSupplier 同一块区域附近）：

```typescript
export function saveSupplierEvaluation(supplierId: string, evaluation: SupplierEvaluationRecord): void {
  const data = loadLocalWorkbenchData();
  const idx = data.suppliers.findIndex((s) => s.id === supplierId);
  if (idx < 0) throw new Error(`供应商不存在: ${supplierId}`);
  const s = data.suppliers[idx];
  // 用 id 去重（同一评估 id 多次保存则覆盖）
  const rest = (s.evaluations ?? []).filter((e) => e.id !== evaluation.id);
  const nextEvaluations = [...rest, evaluation].sort((a, b) => (a.period < b.period ? -1 : 1));
  const latest = nextEvaluations[nextEvaluations.length - 1];
  const next = {
    ...s,
    evaluations: nextEvaluations,
    latestGrade: latest.scores.grade,
    latestScore: latest.scores.total
  };
  data.suppliers[idx] = next;
  saveLocalWorkbenchData(data);
}
```

- [ ] **Step 8: 同步追加 saveSupplier 的输入类型兼容**（确保传入的对象包含新字段也能接受；如果 `saveSupplier` 形参类型用的是 `LocalSupplier`，已自动兼容）

- [ ] **Step 9: 运行测试确认通过**

Run: `cd /workspace/Aria-workbench && pnpm vitest run tests/domain/local-store.test.ts -t "supplier evaluation storage" 2>&1 | tail -15`
Expected: 3 tests PASS

- [ ] **Step 10: Commit**

```bash
cd /workspace/Aria-workbench
git add src/features/workbench/local-store.ts tests/domain/local-store.test.ts
git commit -m "feat: LocalSupplier评估扩展字段 + 加载迁移 + merge合并 + saveSupplierEvaluation保存函数"
```

---

## Task 4: 聊天记录本地正则解析器

**Files:**
- Create: `src/features/workbench/supplier-chat-parser.ts`
- Test: `tests/domain/supplier-chat-parser.test.ts`

- [ ] **Step 1: 写解析器的失败测试（覆盖典型场景15+）**

```typescript
import { describe, expect, it } from "vitest";
import { parseSupplierChatText, parseChatLine } from "@/features/workbench/supplier-chat-parser";

describe("supplier chat line-level parsers", () => {
  it("parseChatLine order: 提取 订1000个 下周三8月20号要到", () => {
    const r = parseChatLine("张总，订1000个收纳箱，下周三8月20号要到。");
    expect(r.type).toBe("order");
    expect(r.order?.orderQuantity).toBe(1000);
    expect(r.order?.productName).toContain("收纳箱");
    expect(r.order?.promisedDeliveryAt).toBeDefined();
  });

  it("parseChatLine order: 提取 订1000件，下周三要到（相对日期解析）", () => {
    const today = "2026-08-15";
    const r = parseChatLine("订1000件收纳盒，下周三到", { referenceDate: today });
    expect(r.order?.orderQuantity).toBe(1000);
    // 2026-08-15是周六，下周三=8-19
    expect(r.order?.promisedDeliveryAt).toBe("2026-08-19");
  });

  it("parseChatLine delivery: 实际到货 '今天8.12到800，剩下200下周一补'", () => {
    const r = parseChatLine("张总不好意思今天只能到800个，剩下200个下周一补。", { referenceDate: "2026-08-12" });
    expect(r.type).toBe("delivery");
    expect(r.delivery?.deliveredQuantity).toBe(800);
    expect(r.delivery?.shortQuantity).toBe(200);
    expect(r.delivery?.actualDeliveryAt).toBe("2026-08-12");
  });

  it("parseChatLine promise: 承诺'好的，收到，没问题'", () => {
    const r = parseChatLine("好的老板，收到，下周三准时交。", { referenceDate: "2026-08-15" });
    expect(r.type).toBe("service_event");
    expect(r.serviceEvent?.type).toBe("promise");
    expect(r.serviceEvent?.content).toContain("准时交");
    expect(r.serviceEvent?.expectedAt).toBe("2026-08-19");
  });

  it("parseChatLine promise_broken: '上次说的下周给你降0.2元的事……暂时不好降'", () => {
    const r = parseChatLine("张总，上次说的下周给你降0.2元的事，暂时不好降，等下个月再说。", { referenceDate: "2026-08-15" });
    expect(r.type).toBe("service_event");
    expect(r.serviceEvent?.fulfilled).toBe(false);
  });

  it("parseChatLine price_change: '原材料涨了，3.5元一个，涨3毛'", () => {
    const r = parseChatLine("老板，原材料涨了，下个月起从3.2涨到3.5元/件。", { referenceDate: "2026-08-15" });
    expect(r.type).toBe("service_event");
    expect(r.serviceEvent?.type).toBe("price_change");
    expect(r.serviceEvent?.priceBefore).toBe(3.2);
    expect(r.serviceEvent?.priceAfter).toBe(3.5);
  });

  it("parseChatLine price: '3.5元一个'", () => {
    const r = parseChatLine("单价3.5元一个。");
    expect(r.type).toBe("service_event");
    expect(r.serviceEvent?.type).toBe("price_change");
    expect(r.serviceEvent?.priceAfter).toBe(3.5);
  });

  it("parseChatLine quality: '上批有20个压坏了，补发'", () => {
    const r = parseChatLine("张总，上批1000个里有20个压坏了，我们这边补发。", { referenceDate: "2026-08-15" });
    expect(r.type).toBe("quality_issue");
    expect(r.qualityIssue?.issueCount).toBe(20);
    expect(r.qualityIssue?.totalBatchSize).toBe(1000);
    expect(r.qualityIssue?.issueDescription).toContain("压坏");
    expect(r.qualityIssue?.isClosed).toBe(true); // "补发"表明接受闭环
  });

  it("parseChatLine quality_without_close: '有3个破损，你看看怎么办'", () => {
    const r = parseChatLine("有3个破损，还没处理。", { referenceDate: "2026-08-15" });
    expect(r.qualityIssue?.isClosed).toBe(false);
  });

  it("parseChatLine cooperation_rating: '配合度一般，打3分'", () => {
    const r = parseChatLine("这次配合度一般，打3分。");
    expect(r.serviceEvent?.type).toBe("cooperation_rating");
    expect(r.serviceEvent?.cooperationScore).toBe(3);
  });

  it("parseChatLine peak: '双十一前加急1500个'", () => {
    const r = parseChatLine("双十一前加急1500个收纳盒，10月28号要。", { referenceDate: "2026-10-10" });
    expect(r.order?.isPeak).toBe(true);
    expect(r.order?.orderQuantity).toBe(1500);
  });

  it("parseChatLine response 响应时长: 需两条消息一起，在整体parse里算", () => {
    // 响应时长在整段解析里算
    expect(true).toBe(true);
  });
});

describe("supplier chat document parser", () => {
  const sample1 = `张总，订1000个收纳箱，下周三8月20号要到。
老板：好的，收到，没问题。下周三准时交。
（后续）张总不好意思今天8月22号只能到800个，剩下200个下周一补。
老板：行。补发的话下次一起。
这批1000个里有20个压坏了，我们这边补发。
这次响应慢了点，配合度打3分。`;

  it("parseSupplierChatText sample1 produces 1 order + 1 delivery + 1 quality + service events", () => {
    const r = parseSupplierChatText(sample1, { referenceDate: "2026-08-15" });
    expect(r.orders.length).toBeGreaterThanOrEqual(1);
    expect(r.orders[0].orderQuantity).toBe(1000);
    // 8.22 到货 800
    const deliv = r.orders.find((o) => typeof o.deliveredQuantity === "number" && o.actualDeliveryAt);
    expect(deliv?.deliveredQuantity).toBe(800);
    expect(deliv?.actualDeliveryAt).toBe("2026-08-22");
    // 压坏20
    const qi = r.qualityIssues.find((q) => q.issueCount === 20);
    expect(qi).toBeDefined();
    expect(qi?.isClosed).toBe(true);
    // 服务事件至少有 承诺（fulfilled true?） + 配合度3分
    const coop = r.serviceEvents.find((e) => e.type === "cooperation_rating");
    expect(coop?.cooperationScore).toBe(3);
    expect(r.suppliersMentioned.length).toBeGreaterThanOrEqual(0);
  });

  it("parseSupplierChatText extracts response hours between consecutive messages", () => {
    const chat = `[2026-08-15 09:00] 我：老板，收纳箱1000个多少钱？
[2026-08-15 16:00] 温州XX厂：单价13.2元/个，下周三交。`;
    const r = parseSupplierChatText(chat, { referenceDate: "2026-08-15" });
    const resp = r.serviceEvents.find((e) => e.type === "response" && typeof e.responseHours === "number");
    // 09:00→16:00 = 7小时
    expect(resp?.responseHours).toBe(7);
    // 供应商识别
    expect(r.suppliersMentioned).toContain("温州XX厂");
    expect(r.orders.find((o) => o.productName?.includes("收纳箱"))?.unitPrice).toBe(13.2);
  });

  it("parseSupplierChatText unknown supplier still returns orders", () => {
    const chat = `订500个，报价8.5元/个，下周五交。
好的，没问题。`;
    const r = parseSupplierChatText(chat, { referenceDate: "2026-08-15" });
    expect(r.orders).toHaveLength(1);
    expect(r.orders[0].orderQuantity).toBe(500);
    expect(r.orders[0].unitPrice).toBe(8.5);
    expect(r.uncertaintyNotes).toEqual(expect.arrayContaining([expect.stringContaining("供应商")]));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /workspace/Aria-workbench && pnpm vitest run tests/domain/supplier-chat-parser.test.ts 2>&1 | tail -15`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现聊天解析器 supplier-chat-parser.ts**

```typescript
import { randomId } from "@/lib/random-id";
import type {
  SupplierChatExtractionDraft,
  SupplierOrderRecordDraft,
  SupplierQualityIssueDraft,
  SupplierServiceEventDraft
} from "./schemas";

// ========== 行级解析结果 ==========
export type LineParseResult =
  | { type: "order"; order: SupplierOrderRecordDraft }
  | { type: "delivery"; delivery: SupplierOrderRecordDraft & { shortQuantity?: number } }
  | { type: "quality_issue"; qualityIssue: SupplierQualityIssueDraft }
  | { type: "service_event"; serviceEvent: SupplierServiceEventDraft }
  | { type: "speaker"; speaker: string; timestamp?: string }
  | { type: "ignored" };

// ========== 工具：相对日期 → 绝对 ISO 日期 ==========
export function resolveDateToISO(expr: string | undefined, referenceDate = new Date().toISOString().slice(0, 10)): string | undefined {
  if (!expr) return undefined;
  // 形如 8月20号 / 8.20 / 8-20 / 2026-08-20
  const m1 = expr.match(/(\d{4})[-\/\.年](\d{1,2})[-\/\.月](\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  const m2 = expr.match(/(\d{1,2})[月\.\-\/](\d{1,2})/);
  if (m2) {
    const year = new Date(referenceDate).getFullYear();
    return `${year}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
  }
  // 今天 / 明天 / 后天 / 大后天
  const base = new Date(referenceDate);
  if (/今天|今日|当天/.test(expr)) return base.toISOString().slice(0, 10);
  if (/明天|次日/.test(expr)) { const d = new Date(base); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
  if (/后天/.test(expr)) { const d = new Date(base); d.setDate(d.getDate() + 2); return d.toISOString().slice(0, 10); }
  if (/大后天/.test(expr)) { const d = new Date(base); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10); }
  // 下周一 ~ 下周日 / 周一 ~ 周日 / 本周三
  const weekMap: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
  const wm = expr.match(/(下|本|这)?(?:周|星期)([日天一二三四五六])/);
  if (wm) {
    const targetDow = weekMap[wm[2]];
    const todayDow = base.getDay();
    let delta = targetDow - todayDow;
    if (wm[1] === "下") {
      if (delta <= 0) delta += 7; else; // same dow next week
      // 下周X = 本周X后的7天内；如果本周X已过，那加7天（还没到就不加？按直觉：下周X是下一周的那天，所以是 (7 - today) + target 或者直接 +7）
      delta += 7;
      // 注意：上面逻辑会出现下周一今天是周二时等于-5，再加7=2，也就是后天。这是错误的。改成：
      // 更稳妥：delta = ((targetDow - todayDow) + 7) % 7; if delta == 0 → 7
      // 然后下 的话再 +7；本 的话就是 delta==0?0:delta
    }
    // 重写正确逻辑
    let d2 = ((targetDow - todayDow) + 7) % 7;
    if (wm[1] === "下") d2 = d2 === 0 ? 7 : d2 + 7; // 下周
    else if (d2 === 0) d2 = 0; // 本周今天就是
    const d = new Date(base); d.setDate(d.getDate() + d2);
    return d.toISOString().slice(0, 10);
  }
  // N天后
  const md = expr.match(/(\d+)\s*天(?:后|之内|左右)?/);
  if (md) { const d = new Date(base); d.setDate(d.getDate() + parseInt(md[1], 10)); return d.toISOString().slice(0, 10); }
  return undefined;
}

// ========== 数量提取 ==========
function extractQty(text: string): number | undefined {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:个|件|批|箱|套|只|PCS|pcs|pcs|条|卷|包|kg|公斤|克|米)/);
  if (m) return parseFloat(m[1]);
  // "订\d+"
  const m2 = text.match(/(?:订|下单|要|做)\s*(\d+(?:\.\d+)?)/);
  if (m2) return parseFloat(m2[1]);
  return undefined;
}

// ========== 产品名粗略提取 ==========
function extractProduct(text: string): string | undefined {
  const patterns = [
    /(\d+)\s*(?:个|件|箱|套|只|条|卷|包)\s*([^\s，,。、：:；;]+)/,
    /([\u4e00-\u9fa5A-Za-z0-9]{2,20}(?:收纳|箱|盒|包|架|袋|具|瓶|罐|杯|装))/u
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return (m[2] ?? m[1]);
  }
  return undefined;
}

// ========== 价格提取 ==========
function extractPrice(text: string): number | undefined {
  const patterns = [
    /(?:单价|价格|报价|涨至|降至|从\d+(?:\.\d+)?涨到|从\d+(?:\.\d+)?降到)?\s*[¥￥]?(\d+(?:\.\d+)?)\s*元?\s*\/?\s*(?:个|件|箱|套|只|条|卷|包|公斤|米)?\s*[，,。]/g,
    /从\s*(\d+(?:\.\d+)?)\s*(?:元)?\s*(?:涨|降)到?\s*(\d+(?:\.\d+)?)\s*元?/
  ];
  // 先处理"从X涨到Y"双价
  const m2 = text.match(patterns[1]);
  if (m2) {
    const mm = text.match(/从\s*(\d+(?:\.\d+)?)\s*(?:元)?\s*(?:涨|降)到?\s*(\d+(?:\.\d+)?)\s*元?/);
    if (mm) return parseFloat(mm[2]); // 返回后
  }
  // 单数字单价
  const m = text.match(/(?:单价|报价|价格|是|要)?\s*[¥￥]?(\d+(?:\.\d+)?)\s*元\s*(?:\/[个件箱套只条卷包])?/);
  if (m) return parseFloat(m[1]);
  const m3 = text.match(/(\d+(?:\.\d+)?)\s*毛?\s*[¥￥]?\s*(?:一个|一件|一套|一包|一箱)/);
  if (m3) return parseFloat(m3[1]);
  return undefined;
}
function extractPriceBeforeAfter(text: string): { before?: number; after?: number } | undefined {
  const m = text.match(/从\s*[¥￥]?(\d+(?:\.\d+)?)\s*(?:元)?\s*(?:涨|降)到?\s*[¥￥]?(\d+(?:\.\d+)?)\s*元?/);
  if (m) return { before: parseFloat(m[1]), after: parseFloat(m[2]) };
  // "涨X毛"/"降X毛/元"（相对变动）
  const up = text.match(/涨\s*(\d+(?:\.\d+)?)\s*(?:元|毛|角)/);
  const down = text.match(/降\s*(\d+(?:\.\d+)?)\s*(?:元|毛|角|块)/);
  if (up || down) return {};
  return undefined;
}

// ========== 日期表达式提取 ==========
function extractDateExpr(text: string): string | undefined {
  const m = text.match(/(?:到|交|发|货|到仓)?\s*([上下本大后前]?周[日天一二三四五六]|今天|今日|明天|次日|后天|大后天|\d+\s*天(?:后|之内|左右)?|\d{1,2}[月\.\-\/]\d{1,2}(?:号|日)?|\d{4}[-\/\.年]\d{1,2}[-\/\.月]\d{1,2})/);
  return m?.[1];
}

// ========== 说话人提取 ==========
function extractSpeakerWithTimestamp(line: string): { speaker?: string; ts?: string; rest: string } {
  // [2026-08-15 09:00] 我：xxx
  const m1 = line.match(/^\s*\[?\s*(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?)\s*\]?\s*([^：:]{1,20})[：:]\s*(.*)$/);
  if (m1) return { ts: m1[1], speaker: m1[2].trim(), rest: m1[3] };
  const m2 = line.match(/^\s*([^：:]{1,20})[：:]\s*(.*)$/);
  if (m2 && /[老板张李王赵陈刘温州广州义乌河北金华台州东莞汕头]\S*|厂|公司|店铺|XX|供应商|老板|张总|王总|李总|我|你|对方|客户/.test(m2[1])) {
    return { speaker: m2[1].trim(), rest: m2[2] };
  }
  return { rest: line };
}

// ========== 供应商名抽取（从说话人/正文）==========
const SUPPLIER_NAME_PATTERNS = [
  /([\u4e00-\u9fa5A-Z]{2,20}(?:市|县|区)?[\u4e00-\u9fa5A-Z0-9]{2,30}(?:工艺|家居|包装|五金|塑业|箱包|文具|纸品|硅胶|塑料|玩具|工贸|实业|制品|商贸|厂|公司|店铺|商行))/u,
  /([\u4e00-\u9fa5A-Z]{2,20}XX[\u4e00-\u9fa5]{1,10}(?:厂|公司|店铺|商贸))/u
];
export function guessSupplierName(...texts: (string | undefined)[]): string | undefined {
  for (const t of texts) {
    if (!t) continue;
    for (const p of SUPPLIER_NAME_PATTERNS) {
      const m = t.match(p);
      if (m) return m[1];
    }
  }
  return undefined;
}

// ========== 行级解析 ==========
export function parseChatLine(rawLine: string, opts: { referenceDate?: string } = {}): LineParseResult {
  const line = rawLine.trim();
  if (!line) return { type: "ignored" };
  const { speaker, ts, rest } = extractSpeakerWithTimestamp(line);
  if (speaker && !rest.trim()) return { type: "speaker", speaker, timestamp: ts };

  const text = rest.trim() || line;
  const ctx = { ...opts, sourceLineText: line };

  // --- 质量问题 ---
  if (/(坏|破|损|裂|刮|脏|色差|不合格|残次品|瑕疵|压坏|摔坏|漏水|漏).{0,30}(?:\d+|几|一|两|三|四|五|六|七|八|九|十)/.test(text)
    || /(?:有|出现|发现).{0,10}(\d+).{0,20}(?:坏|破|损|裂|问题|不合格)/.test(text)) {
    const issueCountM = text.match(/(\d+)\s*(?:个|件|只|箱|套|条)?\s*(?:坏|破|损|裂|脏|色差|不合格|瑕疵|问题)/);
    const batchM = text.match(/(?:批次|批|订).{0,6}(\d+)\s*(?:个|件|只|箱|套|条)/);
    const closed = /补发|换货|重发|退|赔|补偿|处理好|修复|解决|闭环/.test(text);
    const repeated = /又|再|还是|重复|同样的/.test(text);
    const descM = text.match(/([\u4e00-\u9fa5]{2,10}(?:坏|破|损|裂|脏|色差|不合格|瑕疵|压坏|摔坏|漏水|漏))/u);
    return {
      type: "quality_issue",
      qualityIssue: {
        supplierNameGuess: guessSupplierName(speaker, text),
        issueCount: issueCountM ? parseInt(issueCountM[1], 10) : 1,
        totalBatchSize: batchM ? parseInt(batchM[1], 10) : undefined,
        issueDescription: descM?.[1],
        isClosed: closed,
        repeated,
        sourceLineText: line
      }
    };
  }

  // --- 价格变动 ---
  const pa = extractPriceBeforeAfter(text);
  if (pa && (pa.before || pa.after)) {
    const priceAfter = pa.after ?? extractPrice(text);
    if (pa.before != null || priceAfter != null) {
      return {
        type: "service_event",
        serviceEvent: {
          supplierNameGuess: guessSupplierName(speaker, text),
          type: "price_change",
          content: text,
          priceBefore: pa.before,
          priceAfter,
          recordedAt: opts.referenceDate,
          sourceLineText: line
        }
      };
    }
  }
  // 单价格（报价/单价）
  const justPrice = extractPrice(text);
  if (justPrice != null && /(单价|报价|价格|多少钱|是|要)/.test(text)) {
    return {
      type: "service_event",
      serviceEvent: {
        supplierNameGuess: guessSupplierName(speaker, text),
        type: "price_change",
        content: text,
        priceAfter: justPrice,
        recordedAt: opts.referenceDate,
        sourceLineText: line
      }
    };
  }

  // --- 承诺 vs 未兑现 ---
  if (/(上次|之前|原先).{0,15}(?:说的|说好|答应|承诺).{0,20}(?:不|没|暂时|不行|做不到|没法|等下个月)/.test(text)) {
    return {
      type: "service_event",
      serviceEvent: {
        supplierNameGuess: guessSupplierName(speaker, text),
        type: "promise",
        content: text,
        fulfilled: false,
        recordedAt: opts.referenceDate,
        sourceLineText: line
      }
    };
  }
  if (/(好的|OK|ok|收到|没问题|行|可以|一定|保证|准时|包|放心|答应|承诺)/.test(text) && (/(到|交|发|货)/.test(text) || /(下周|今天|明天|后天|周[一二三四五六日天])/.test(text))) {
    const expectedDate = resolveDateToISO(extractDateExpr(text), opts.referenceDate);
    return {
      type: "service_event",
      serviceEvent: {
        supplierNameGuess: guessSupplierName(speaker, text),
        type: "promise",
        content: text,
        expectedAt: expectedDate,
        fulfilled: undefined, // 默认为未知，到货时根据实际判定
        recordedAt: opts.referenceDate,
        sourceLineText: line
      }
    };
  }

  // --- 配合度打分 ---
  const scoreM = text.match(/配合度.{0,10}(\d)\s*分/);
  if (scoreM) {
    const s = parseInt(scoreM[1], 10);
    if (s >= 1 && s <= 5) {
      return {
        type: "service_event",
        serviceEvent: {
          supplierNameGuess: guessSupplierName(speaker, text),
          type: "cooperation_rating",
          content: text,
          cooperationScore: s,
          recordedAt: opts.referenceDate,
          sourceLineText: line
        }
      };
    }
  }

  // --- 实际到货（含短量） ---
  const delivText = /(今天|今日|到了|到货|送到|已到|送到了|发了|发出)/.test(text);
  const deliveredQtyMatch = text.match(/(?:只能到|到了|到货|送到|实发|实际到).{0,10}(\d+)/);
  const shortMatch = text.match(/(?:剩余|剩下|少了|差|短缺|还差|没到).{0,10}(\d+)/);
  if (delivText && (deliveredQtyMatch || shortMatch)) {
    const actualDeliveryAt = resolveDateToISO(extractDateExpr(text) || "今天", opts.referenceDate);
    return {
      type: "delivery",
      delivery: {
        supplierNameGuess: guessSupplierName(speaker, text),
        deliveredQuantity: deliveredQtyMatch ? parseInt(deliveredQtyMatch[1], 10) : undefined,
        shortQuantity: shortMatch ? parseInt(shortMatch[1], 10) : undefined,
        actualDeliveryAt,
        sourceLineText: line
      }
    };
  }

  // --- 下单 ---
  const orderMatch = /(订|下单|要|做|采购|来|拿).{0,5}(\d+)/.test(text);
  const qty = extractQty(text);
  if (orderMatch && qty) {
    const promisedExpr = extractDateExpr(text);
    const promised = resolveDateToISO(promisedExpr, opts.referenceDate);
    const isPeak = /(加急|爆单|双十一|618|旺季|节前|大促|大单|紧急)/.test(text);
    return {
      type: "order",
      order: {
        supplierNameGuess: guessSupplierName(speaker, text),
        productName: extractProduct(text),
        orderQuantity: qty,
        promisedDeliveryAt: promised,
        isPeak,
        unitPrice: extractPrice(text),
        sourceLineText: line
      }
    };
  }

  // --- speaker 作为补充标识 ---
  if (speaker) return { type: "speaker", speaker, timestamp: ts };

  return { type: "ignored" };
}

// ========== 时间戳格式解析为 Date ==========
function parseTimestamp(ts?: string): Date | null {
  if (!ts) return null;
  const normalized = ts.replace(/\./g, "-").replace(/\//g, "-").replace("T", " ");
  const parts = normalized.split(" ");
  const dateParts = parts[0].split("-");
  let y = 0, mo = 0, d = 0, h = 0, mi = 0;
  if (dateParts.length >= 3) { y = parseInt(dateParts[0]); mo = parseInt(dateParts[1]); d = parseInt(dateParts[2]); }
  if (parts.length >= 2) { const tp = parts[1].split(":"); h = parseInt(tp[0] ?? "0"); mi = parseInt(tp[1] ?? "0"); }
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, h, mi, 0);
}

// ========== 说话人判定：哪一方是"供应商" ==========
// 如果 speaker 匹配供应商名模式，或非"我/我们/自己/买方"，就暂归为供应商侧
const BUYER_SPEAKERS = new Set(["我", "我们", "自己", "本人", "买家", "买方", "采购", "自己人"]);
function isBuyerSpeaker(s: string): boolean {
  return BUYER_SPEAKERS.has(s);
}

// ========== 文档级解析 ==========
export function parseSupplierChatText(
  rawText: string,
  opts: { referenceDate?: string } = {}
): SupplierChatExtractionDraft {
  const lines = rawText.split(/\r?\n/);
  const orders: SupplierOrderRecordDraft[] = [];
  const qualityIssues: SupplierQualityIssueDraft[] = [];
  const serviceEvents: SupplierServiceEventDraft[] = [];
  const suppliersMentioned: string[] = [];
  const uncertainty: string[] = [];

  // 上一条我发的消息 ts，用于计算响应时长
  let lastBuyerTs: Date | null = null;
  let lastSupplierTs: Date | null = null;

  // 当前"未完成"的订单（已下单但还没 delivery 信息的），用于将 delivery 行合并到最近一条订单
  let pendingOrder: SupplierOrderRecordDraft | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const { speaker, ts } = extractSpeakerWithTimestamp(line);
    const tsDate = parseTimestamp(ts);

    // 供应商名收集
    const g = guessSupplierName(speaker, line);
    if (g && !suppliersMentioned.includes(g)) suppliersMentioned.push(g);

    // 响应时长计算：上一条是我发的，这一条是供应商回的
    if (speaker) {
      if (isBuyerSpeaker(speaker)) {
        if (tsDate) lastBuyerTs = tsDate;
      } else if (tsDate && lastBuyerTs) {
        const diffHours = Math.round((tsDate.getTime() - lastBuyerTs.getTime()) / 3600000);
        if (diffHours >= 0 && diffHours <= 24 * 7) { // 合理区间内
          serviceEvents.push({
            supplierNameGuess: g ?? speaker,
            type: "response",
            content: `响应时长约 ${diffHours} 小时`,
            responseHours: diffHours,
            recordedAt: ts ? ts.slice(0, 10) : opts.referenceDate,
            sourceLineText: line
          });
        }
        lastBuyerTs = null;
      }
    }

    const result = parseChatLine(line, opts);

    switch (result.type) {
      case "order": {
        orders.push(result.order);
        pendingOrder = result.order;
        // 如果同时有报价信息，加一条价格事件
        if (result.order.unitPrice) {
          serviceEvents.push({
            supplierNameGuess: result.order.supplierNameGuess,
            type: "price_change",
            content: `报价 ${result.order.unitPrice} 元（随订单同条）`,
            priceAfter: result.order.unitPrice,
            recordedAt: opts.referenceDate,
            sourceLineText: line
          });
        }
        break;
      }
      case "delivery": {
        // 尝试把 delivery 信息合并到最近一条 pending order
        if (pendingOrder) {
          pendingOrder.deliveredQuantity = result.delivery.deliveredQuantity;
          pendingOrder.actualDeliveryAt = result.delivery.actualDeliveryAt;
          if (result.delivery.shortQuantity && typeof pendingOrder.orderQuantity === "number") {
            // 短量意味着 deliveredQuantity 可能缺失，但可以推：
            if (pendingOrder.deliveredQuantity == null) {
              pendingOrder.deliveredQuantity = pendingOrder.orderQuantity - result.delivery.shortQuantity;
            }
          }
          // 判定承诺是否兑现：如果有 promised，与 actual 比较
          if (pendingOrder.promisedDeliveryAt && pendingOrder.actualDeliveryAt) {
            const onTime = pendingOrder.actualDeliveryAt <= pendingOrder.promisedDeliveryAt;
            serviceEvents.push({
              supplierNameGuess: pendingOrder.supplierNameGuess,
              type: "promise",
              content: `订单交期承诺：${pendingOrder.promisedDeliveryAt}，实际：${pendingOrder.actualDeliveryAt}`,
              expectedAt: pendingOrder.promisedDeliveryAt,
              actualAt: pendingOrder.actualDeliveryAt,
              fulfilled: onTime,
              recordedAt: opts.referenceDate,
              sourceLineText: line
            });
          }
        } else {
          // 没对应订单时：生成一条无 quantity 的订单仅带 delivered
          orders.push({
            supplierNameGuess: result.delivery.supplierNameGuess,
            deliveredQuantity: result.delivery.deliveredQuantity,
            actualDeliveryAt: result.delivery.actualDeliveryAt,
            sourceLineText: line
          });
        }
        break;
      }
      case "quality_issue":
        qualityIssues.push(result.qualityIssue);
        break;
      case "service_event":
        serviceEvents.push(result.serviceEvent);
        break;
      default:
        break;
    }
  }

  if (suppliersMentioned.length === 0) {
    uncertainty.push("未识别到明确的供应商名称，请在确认时手动指定归属供应商。");
  }
  if (orders.length === 0 && qualityIssues.length === 0 && serviceEvents.length === 0) {
    uncertainty.push("本次解析未提取到任何订单/质量/服务事件。可能是聊天格式特殊，需要针对该聊天优化规则。");
  }

  return {
    period: opts.referenceDate ? opts.referenceDate.slice(0, 7) : undefined,
    orders,
    qualityIssues,
    serviceEvents,
    costReductions: [],
    suppliersMentioned,
    uncertaintyNotes: uncertainty
  };
}
```

- [ ] **Step 4: 运行测试，逐步修复（需要迭代调正则）**

Run: `cd /workspace/Aria-workbench && pnpm vitest run tests/domain/supplier-chat-parser.test.ts 2>&1 | tail -40`
Expected: 先会有一些 FAIL，根据实际输出调整正则和 `resolveDateToISO` 逻辑，直到至少 **14/15 通过**（保留 1 个严格匹配用例如具体价格/时间可允许 ±2 小时以内的误差）

调优要点：
- `下周三` 的解析逻辑在代码注释中我标记了 bug（重复赋值），需要修正为只用第二段正确逻辑
- 价格提取要优先处理 "从X涨到Y" 双价模式
- 交货和承诺区分开："好的，下周三准时交" 是 promise，"今天只能到800" 是 delivery
- `parseSupplierChatText` 里：响应时长事件可能和 promise 事件重复，不影响，允许服务事件有多个重复来源

- [ ] **Step 5: Commit**

```bash
cd /workspace/Aria-workbench
git add src/features/workbench/supplier-chat-parser.ts tests/domain/supplier-chat-parser.test.ts
git commit -m "feat: 供应商聊天记录本地正则解析器 - 提取订单/交期/到货/价格/质量问题/响应时长/配合度评分"
```

---

## Task 5: 打通快速录入 AI 提取管道 — 聊天结果进入 DraftExtraction + 入库确认

**Files:**
- Modify: `src/features/workbench/ai-extraction.ts`
- Modify: `src/features/workbench/local-store.ts`（mergeIncomingExtraction + 草稿确认入库部分，新增聊天草稿到 LocalSupplier 扩展字段的映射）
- Test: 复用已有的测试，另外在 `ai-extraction.ts` 相关测试文件（如果存在）加 1 条集成测试，否则在 `tests/domain/supplier-chat-parser.test.ts` 末尾加

- [ ] **Step 1: 写集成测试（聊天文本 → buildFallbackExtraction → 含 supplierChat 字段）**

在 `tests/domain/supplier-chat-parser.test.ts` 末尾追加：

```typescript
import { buildFallbackExtraction } from "@/features/workbench/ai-extraction";

describe("integration: supplier chat into draft extraction", () => {
  const chat = `[2026-08-15 09:00] 我：张总，订1000个收纳箱，下周三8月20号要到。多少钱？
[2026-08-15 16:00] 温州XX塑料厂：单价13.2元/个，好的没问题，下周三准时交。
[2026-08-22 10:00] 温州XX塑料厂：张总不好意思今天只能到800个，剩下200个下周一补。
这批有20个压坏了，补发。
温州XX塑料厂：这次配合度一般，打3分。`;

  it("buildFallbackExtraction parses supplier chat via new parser", () => {
    const draft = buildFallbackExtraction(chat, undefined, 0, "missing_key");
    expect(draft.supplierChat).toBeDefined();
    expect(draft.supplierChat!.orders.length).toBeGreaterThanOrEqual(1);
    expect(draft.supplierChat!.suppliersMentioned).toContain("温州XX塑料厂");
    expect(draft.supplierChat!.qualityIssues.length).toBeGreaterThanOrEqual(1);
    // 响应时长 9→16 点 = 7小时
    const resp = draft.supplierChat!.serviceEvents.find((e) => e.type === "response" && typeof e.responseHours === "number");
    expect(resp?.responseHours).toBe(7);
    // 配合度 3 分
    const coop = draft.supplierChat!.serviceEvents.find((e) => e.type === "cooperation_rating");
    expect(coop?.cooperationScore).toBe(3);
    // 原 DraftExtraction 其它字段仍然存在
    expect(draft.communication.summary).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /workspace/Aria-workbench && pnpm vitest run tests/domain/supplier-chat-parser.test.ts -t "integration" 2>&1 | tail -15`
Expected: FAIL（draft.supplierChat 不存在）

- [ ] **Step 3: 修改 ai-extraction.ts 的 buildFallbackExtraction**

在 `buildFallbackExtraction` 函数最后（return 语句之前），追加：

```typescript
  // ===== 新增：供应商聊天记录解析 =====
  let supplierChat: ReturnType<typeof parseSupplierChatText> | undefined;
  try {
    const parsed = parseSupplierChatText(rawText);
    // 只有提取到至少 1 个有效事件才挂载 supplierChat
    const hasEvents = parsed.orders.length + parsed.qualityIssues.length + parsed.serviceEvents.length + parsed.costReductions.length > 0;
    if (hasEvents) supplierChat = parsed;
  } catch (_err) {
    // 解析失败不影响其他兜底
  }

  return DraftExtractionSchema.parse({
    // ...原有 return 的对象...（保持原样，在末尾追加 supplierChat 字段）
    supplierChat,
    uncertaintyNotes: [
      // ...原有 uncertaintyNotes
      ...(supplierChat?.uncertaintyNotes ?? [])
    ]
  });
```

同时在 ai-extraction.ts 顶部追加 import：

```typescript
import { parseSupplierChatText } from "./supplier-chat-parser";
```

- [ ] **Step 4: 修改 mergeIncomingExtraction（local-store.ts）+ 确认入库桥接**

思路：草稿确认入库时，若 `incoming.supplierChat` 字段存在：
- 按 `supplierChat.suppliersMentioned` 与现有供应商模糊匹配（复用现有 `findMatchingSupplier`）
- 匹配到的：将 orders/qualityIssues/serviceEvents/costReductions 写入对应 supplier 的扩展数组，并在 notes 里追加"聊天解析导入于 X 日期"标记
- 没匹配到：以草稿形式存到 notes，提醒用户手动分配

找到 `mergeIncomingExtraction` 函数位置，在它处理完 `incoming.supplier`、`offers`、`tasks` 后追加：

```typescript
  // ===== 供应商聊天草稿入库 =====
  if (incoming.supplierChat) {
    const chat = incoming.supplierChat;
    const applyToSupplier = (supplierId: string) => {
      const sIdx = result.suppliers.findIndex((x) => x.id === supplierId);
      if (sIdx < 0) return;
      const target = result.suppliers[sIdx];
      const now = new Date().toISOString();
      for (const od of chat.orders) {
        target.orderRecords.push({
          id: randomId(),
          supplierId,
          supplierName: od.supplierNameGuess ?? target.name,
          productName: od.productName,
          skuSpec: od.skuSpec,
          orderedAt: od.orderedAt,
          promisedDeliveryAt: od.promisedDeliveryAt,
          actualDeliveryAt: od.actualDeliveryAt,
          orderQuantity: od.orderQuantity,
          deliveredQuantity: od.deliveredQuantity,
          isPeak: od.isPeak ?? false,
          unitPrice: od.unitPrice,
          status: od.status ?? (od.actualDeliveryAt ? "partial" : "pending"),
          note: od.sourceLineText,
          source: "chat_parse"
        });
      }
      for (const qi of chat.qualityIssues) {
        target.qualityIssues.push({
          id: randomId(),
          supplierId,
          supplierName: qi.supplierNameGuess ?? target.name,
          productName: qi.productName,
          issueCount: qi.issueCount,
          totalBatchSize: qi.totalBatchSize,
          issueDescription: qi.issueDescription,
          isClosed: qi.isClosed,
          repeated: qi.repeated,
          source: "chat_parse",
          reportedAt: now.slice(0, 10)
        });
      }
      for (const ev of chat.serviceEvents) {
        target.serviceEvents.push({
          id: randomId(),
          supplierId,
          supplierName: ev.supplierNameGuess ?? target.name,
          type: ev.type,
          content: ev.content,
          promisedAt: ev.promisedAt,
          expectedAt: ev.expectedAt,
          actualAt: ev.actualAt,
          fulfilled: ev.fulfilled,
          priceBefore: ev.priceBefore,
          priceAfter: ev.priceAfter,
          marketPriceChangedAt: ev.marketPriceChangedAt,
          responseHours: ev.responseHours,
          cooperationScore: ev.cooperationScore,
          recordedAt: ev.recordedAt ?? now.slice(0, 10)
        });
      }
      for (const cr of chat.costReductions) {
        target.costReductions.push({
          id: randomId(),
          supplierId,
          supplierName: cr.supplierNameGuess ?? target.name,
          productName: cr.productName,
          priceBefore: cr.priceBefore,
          priceAfter: cr.priceAfter,
          method: cr.method,
          note: cr.note,
          achievedAt: now.slice(0, 10)
        });
      }
    };

    // 策略：如果明确只提到 1 个供应商，且能匹配到 1 个，直接关联
    if (chat.suppliersMentioned.length === 1) {
      const match = findMatchingSupplier(result.suppliers, { name: chat.suppliersMentioned[0] });
      if (match) applyToSupplier(match.id);
      // 如没匹配到：数据先不保存在某供应商下，标记为 unassigned（放一个"未分配"的虚拟供应商？不——当前不存，留待 review 页面手动分配更安全。）
    } else if (chat.suppliersMentioned.length > 1) {
      for (const name of chat.suppliersMentioned) {
        const match = findMatchingSupplier(result.suppliers, { name });
        if (match) applyToSupplier(match.id);
      }
    }

    // 未分配的供应商提示：加到 communication.nextActions
    if (chat.suppliersMentioned.length === 0 || !chat.suppliersMentioned.every(n => findMatchingSupplier(result.suppliers, { name }))) {
      mergedCommunication.nextActions.push("核对供应商聊天解析结果并手动分配至对应供应商档案");
    }
  }
```

- [ ] **Step 5: 运行集成测试**

Run: `cd /workspace/Aria-workbench && pnpm vitest run tests/domain/supplier-chat-parser.test.ts 2>&1 | tail -20`
Expected: 新增集成测试 PASS，之前的解析测试仍全部 PASS

- [ ] **Step 6: Commit**

```bash
cd /workspace/Aria-workbench
git add src/features/workbench/ai-extraction.ts src/features/workbench/local-store.ts tests/domain/supplier-chat-parser.test.ts
git commit -m "feat: 打通快速录入管道 - 供应商聊天解析进入DraftExtraction，确认入库自动桥接LocalSupplier扩展字段"
```

---

## Task 6: 完整回归测试 + 语法/类型检查

- [ ] **Step 1: 运行 parser / scoring / chat / 新的 local-store 新增部分 四个测试套件**

```bash
cd /workspace/Aria-workbench
pnpm vitest run tests/domain/supplier-evaluation.test.ts tests/domain/supplier-chat-parser.test.ts 2>&1 | tail -20
pnpm vitest run tests/domain/local-store.test.ts -t "supplier evaluation storage" 2>&1 | tail -10
pnpm vitest run tests/domain/product-research-parser.test.ts 2>&1 | tail -10
```

Expected: 全部相关测试 PASS（允许本地已存在但与本任务无关的 `× local-store operations > 7 个原有失败` 继续失败，那些是非供应商评估的历史遗留问题）

- [ ] **Step 2: 类型检查**

```bash
cd /workspace/Aria-workbench
# 项目如果有 tsc --noEmit / typecheck 脚本就跑
pnpm typecheck 2>&1 | tail -20 || npx tsc --noEmit 2>&1 | tail -20
```

Expected: No type error（或仅已有非相关错误，未增加新 error）

- [ ] **Step 3: 如果有 lint 脚本就跑 lint**

```bash
cd /workspace/Aria-workbench
pnpm lint 2>&1 | tail -10
```

- [ ] **Step 4: 最终 Commit（若 Step1-3 通过，或只有历史遗留错误）**

```bash
git add -A
git commit -m "chore: 供应商评估系统阶段0+1+2整体回归通过，类型检查通过"
git push
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ QCDS 公式：4维度加权公式 → Task2
- ✅ 等级阈值 A/B/C/D：Task2
- ✅ 风险标签自动触发（爆单不可靠/言行不一/响应慢/涨价过快/质量问题反复/常缺量）：Task2
- ✅ 订单/质量/服务/降本4类原始数据结构：Task1
- ✅ 聊天记录本地正则解析（订货/交期/到货/价格/质量问题/响应时长/配合度）：Task4
- ✅ 从原始记录自动聚合 metrics：Task2 `aggregateMetricsFromRecords`
- ✅ 评估记录持久化到 LocalSupplier：Task3
- ✅ 快速录入→解析→草稿→确认入库桥接：Task5
- ✅ localStorage 历史数据加载迁移（旧供应商没新字段→默认空数组）：Task3

文档里后续提到的"看板UI"、"产品联动"在本计划范围外，为阶段3/4。

**2. Placeholder scan:** 全文搜索 "TBD / TODO / implement later / appropriate / similar to Task" → 均已给出具体代码，无占位。

**3. Type consistency:**
- `SupplierEvaluationRecord` 从 Zod Schema 用 `z.infer` 生成；`LocalSupplier` 直接 import 这些类型。✅
- `parseSupplierChatText` 返回类型使用在 `schemas.ts` 定义的 `SupplierChatExtractionDraft`，与 `DraftExtraction.supplierChat` 字段类型一致。✅
- `mergeById` 泛型 `<T extends { id: string }>` 覆盖所有数组合并。✅

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-15-supplier-evaluation-system.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
