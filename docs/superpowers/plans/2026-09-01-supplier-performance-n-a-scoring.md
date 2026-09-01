# 供应商绩效 N/A 评分与证据明细 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让供应商绩效评分只纳入有事实和基准的指标，并在前端及导出中呈现 N/A、公式和证据链。

**Architecture:** 在现有 `supplier-evaluation.ts` 中增加可适用指标的判定与归一化加权函数，保留历史评分字段兼容性；供应商详情页根据新的评分状态显示分数或 N/A，并沿用现有原始数据区域作为完整细则出口。

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Vitest, 现有 local-store 数据层。

## Global Constraints

- 首次响应 SLA 与问题解决 SLA 分离。
- 问题解决以双方确认的承诺解决日期和验收通过为准。
- 无问题指标为 N/A，不记 0 分，不虚构 100 分，不进入总分分母。
- 只改本地，不同步云端。
- 现有 6/7 月数据结构保持兼容。

---

### Task 1: 可适用指标归一化评分

**Files:**
- Modify: `src/features/workbench/supplier-evaluation.ts`
- Test: `tests/domain/supplier-evaluation.test.ts`

**Interfaces:**
- Produces `calculateApplicableTotalScoreAndGrade(dimScores, model)`，对 `undefined` 维度排除权重并重新归一化。

- [ ] **Step 1: Write the failing test**

```ts
it("excludes non-applicable dimensions from the total score", () => {
  const result = calculateApplicableTotalScoreAndGrade({
    delivery: 90,
    cost: undefined,
    quality: 80,
    service: undefined,
  });
  expect(result.total).toBeCloseTo(85, 5);
  expect(result.includedDimensions).toEqual(["delivery", "quality"]);
  expect(result.excludedDimensions).toEqual(["cost", "service"]);
  expect(result.grade).toBe("A");
});

it("returns no score when every dimension is non-applicable", () => {
  const result = calculateApplicableTotalScoreAndGrade({});
  expect(result.total).toBeUndefined();
  expect(result.grade).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/supplier-evaluation.test.ts`
Expected: FAIL because `calculateApplicableTotalScoreAndGrade` is not defined.

- [ ] **Step 3: Write minimal implementation**

Add a typed helper that filters numeric scores, applies `getQcdsWeights(model)`, divides by the sum of included weights, and only calls `gradeFromTotal` when at least one score is present.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/supplier-evaluation.test.ts`
Expected: PASS, with existing scoring tests still passing.

- [ ] **Step 5: Commit**

```bash
git add src/features/workbench/supplier-evaluation.ts tests/domain/supplier-evaluation.test.ts
git commit -m "feat: normalize supplier scores by applicable metrics"
```

### Task 2: 明确首次响应、解决时效和无问题状态

**Files:**
- Modify: `src/features/workbench/supplier-evaluation.ts`
- Modify: `src/app/suppliers/[supplierId]/page.tsx`
- Test: `tests/domain/supplier-evaluation.test.ts`
- Test: `tests/ui/supplier-detail-decision.test.tsx`

**Interfaces:**
- Adds `ScoreMetricStatus` and exposes `not_applicable` in score breakdown details.

- [ ] **Step 1: Write the failing test**

```ts
it("marks missing quality issues as not applicable instead of zero", () => {
  const breakdown = getQualityBreakdown({});
  expect(breakdown.status).toBe("not_applicable");
  expect(breakdown.score).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/supplier-evaluation.test.ts`
Expected: FAIL because quality breakdown currently defaults missing values to 100.

- [ ] **Step 3: Write minimal implementation**

Mark a dimension `not_applicable` when none of its source metrics exists, keep measured dimensions numeric, and render `N/A（无对应问题/数据）` in the supplier detail page. Keep the existing response SLA copy limited to “首次有效响应”; do not use it as a resolution deadline.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/supplier-evaluation.test.ts tests/ui/supplier-detail-decision.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workbench/supplier-evaluation.ts src/app/suppliers/[supplierId]/page.tsx tests/domain/supplier-evaluation.test.ts tests/ui/supplier-detail-decision.test.tsx
git commit -m "feat: distinguish response and resolution scoring"
```

### Task 3: 完整评分细则导出

**Files:**
- Modify: `src/app/suppliers/[supplierId]/page.tsx`
- Modify: `src/features/workbench/supplier-evaluation.ts`
- Test: `tests/ui/supplier-detail-decision.test.tsx`

- [ ] **Step 1: Write the failing test**

Assert the supplier detail source includes an export action and the fields `原始值`、`基准值`、`计算公式`、`证据来源`、`责任归属`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/supplier-detail-decision.test.tsx`
Expected: FAIL because no complete-detail export action exists.

- [ ] **Step 3: Write minimal implementation**

Build a CSV export from the score breakdown and raw metrics. Include one row per dimension/submetric, its raw value, baseline, formula, result status, evidence source and responsibility; encode as UTF-8 with BOM and download from the supplier detail page.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/supplier-detail-decision.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/suppliers/[supplierId]/page.tsx src/features/workbench/supplier-evaluation.ts tests/ui/supplier-detail-decision.test.tsx
git commit -m "feat: export supplier performance details"
```

### Task 4: 回归验证

- [ ] **Step 1:** Run `npx vitest run` and confirm all test files pass.
- [ ] **Step 2:** Run `npx tsc --noEmit` and confirm no type errors.
- [ ] **Step 3:** Run `git diff --check` and confirm no whitespace errors.
- [ ] **Step 4:** Check local route `/suppliers` and supplier detail route return HTTP 200.
- [ ] **Step 5:** Keep changes local; do not run `git push`.
