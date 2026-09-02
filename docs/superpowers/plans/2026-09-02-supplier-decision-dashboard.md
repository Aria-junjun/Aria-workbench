# 供应商决策看板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将供应商中心和供应商详情页改造成以月度决策为核心的看板，明确区分聚水潭绩效与工作台判断，并保留可追溯的产品族、SKU和历史依据。

**Architecture:** 在现有本地工作台数据模型之上增加纯函数式的供应商看板视图模型，统一计算当前月统计、待处理原因、绩效摘要和数据状态。供应商主页只消费该视图模型；详情页按本月判断、产品族表现、数据依据和历史判断组织内容，关系/能力维护继续作为独立设置入口。

**Tech Stack:** Next.js App Router、React、TypeScript、Tailwind CSS、Vitest、本地工作台存储。

## Global Constraints

- 聚水潭负责提供采购、入仓、销售、退货及其原生绩效结果；工作台负责产品族、供应关系、成本、证据和决策上下文。
- 正常供应商不进入待处理区域，不生成额外提醒。
- 无来源的数据必须显示 N/A 或待采集，不显示为 0 分，也不补满分。
- 不把不同产品族或不同供应商的数量合并成一个总量。
- 主页不默认展示能力、货盘、沟通和复杂评分细则。
- 本轮只改本地代码和本地数据，不同步云端。

## 文件结构与职责

- Modify: `src/features/workbench/supplier-dashboard.ts` — 供应商主页与详情页共用的纯视图模型、状态和排序规则。
- Test: `tests/domain/supplier-dashboard.test.ts` — 看板视图模型的排序、数据状态和绩效分层测试。
- Modify: `src/app/suppliers/page.tsx` — 供应商中心三段式布局：顶部统计、待处理供应商、全部供应商绩效总览。
- Test: `tests/ui/supplier-dashboard.test.tsx` — 主页字段和异常优先级的 UI 契约测试。
- Modify: `src/app/suppliers/[supplierId]/page.tsx` — 详情页收敛为本月判断、产品族表现、数据依据和历史判断。
- Test: `tests/ui/supplier-detail-decision.test.tsx`、`tests/ui/supplier-evidence-display.test.tsx` — 详情页结构、入口和旧模块不可见测试。

---

### Task 1: 建立供应商看板视图模型

**Files:**
- Create: `src/features/workbench/supplier-dashboard.ts`
- Create: `tests/domain/supplier-dashboard.test.ts`

**Interfaces:**
- Consumes: `LocalSupplier`、`LocalProductKnowledge`、`LocalSkuMaster`、`LocalSupplierDecisionRecord`、`LocalMonthlyInboundSnapshot`、供应商评估结果和成本核验结果。
- Produces:
  - `buildSupplierDashboard(data, period): SupplierDashboardViewModel`
  - `buildSupplierDashboardSupplier(input): SupplierDashboardSupplier`
  - `classifySupplierIssue(input): SupplierIssue | null`

- [ ] **Step 1: Write failing domain tests**

覆盖以下事实：质量问题排在交付问题前；缺数据进入待补数据而不是低分；正常保持主供不进入待处理；聚水潭绩效和工作台判断分开保存；供应商统计使用当前月份数据。

```ts
it("sorts quality issues before delivery and missing data", () => {
  const result = buildSupplierDashboard(fixture, "2026-07");
  expect(result.actionQueue.map((item) => item.issueType)).toEqual([
    "quality",
    "delivery",
    "data_missing",
  ]);
});

it("keeps ERP score separate from workbench judgment", () => {
  const result = buildSupplierDashboard(fixture, "2026-07");
  expect(result.suppliers[0].erpPerformanceScore).toBe(92);
  expect(result.suppliers[0].workbenchJudgment).toBe("needs_review");
});

it("does not treat normal keep-primary decisions as actions", () => {
  const result = buildSupplierDashboard(fixture, "2026-07");
  expect(result.actionQueue.some((item) => item.action === "保持主供")).toBe(false);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npx vitest run tests/domain/supplier-dashboard.test.ts --reporter=dot`

Expected: FAIL because the view-model module and functions do not yet exist.

- [ ] **Step 3: Implement the minimal view model**

Use explicit types for `issueType`, `workbenchJudgment`, `dataStatus` and `recommendedAction`. Aggregate only the requested period; retain product-family keys and SKU counts; use existing score/cost helpers instead of duplicating formulas. Sort issues by `quality`, `delivery`, `cost`, `relationship`, `data_missing`, then by severity descending.

- [ ] **Step 4: Run the focused test and confirm pass**

Run: `npx vitest run tests/domain/supplier-dashboard.test.ts --reporter=dot`

Expected: all view-model tests pass.

- [ ] **Step 5: Commit the domain unit**

```bash
git add src/features/workbench/supplier-dashboard.ts tests/domain/supplier-dashboard.test.ts
git commit -m "feat: add supplier dashboard view model"
```

### Task 2: 重做供应商中心主页

**Files:**
- Modify: `src/app/suppliers/page.tsx`
- Test: `tests/ui/supplier-dashboard.test.tsx`

**Interfaces:**
- Consumes: `buildSupplierDashboard(data, period)` from Task 1.
- Produces: three visible sections with fixed labels and action links into the supplier detail page.

- [ ] **Step 1: Write failing UI contract tests**

```ts
it("renders the three decision sections", () => {
  const source = readFileSync(pagePath, "utf8");
  expect(source).toContain("供应商中心");
  expect(source).toContain("待处理供应商");
  expect(source).toContain("全部供应商绩效总览");
  expect(source).toContain("聚水潭绩效");
  expect(source).toContain("工作台判断");
});

it("does not present the supplier home as a long archive table", () => {
  const source = readFileSync(pagePath, "utf8");
  expect(source).not.toContain("聊天快速评估");
  expect(source).not.toContain("供应商能力");
});
```

- [ ] **Step 2: Run the UI test and confirm failure**

Run: `npx vitest run tests/ui/supplier-dashboard.test.tsx --reporter=dot`

Expected: FAIL because the current home page does not contain the final section labels and result split.

- [ ] **Step 3: Implement the three-section page**

Replace the main supplier list presentation with:

1. current-period statistics;
2. action queue showing supplier, product family, issue, value, period and action;
3. all-supplier performance table showing supplier, product-family count, inbound quantity, ERP score, workbench judgment, cost variance and action.

Keep filters/sorting as compact controls. Do not render normal suppliers in the action queue.

- [ ] **Step 4: Run the UI test and confirm pass**

Run: `npx vitest run tests/ui/supplier-dashboard.test.tsx --reporter=dot`

Expected: all homepage contract tests pass.

- [ ] **Step 5: Commit the homepage**

```bash
git add src/app/suppliers/page.tsx tests/ui/supplier-dashboard.test.tsx
git commit -m "feat: redesign supplier center dashboard"
```

### Task 3: 收敛供应商详情页

**Files:**
- Modify: `src/app/suppliers/[supplierId]/page.tsx`
- Test: `tests/ui/supplier-detail-decision.test.tsx`
- Test: `tests/ui/supplier-evidence-display.test.tsx`

**Interfaces:**
- Consumes: supplier dashboard view-model fields and existing monthly cost rows.
- Produces: detail sections `本月判断`、`产品族表现`、`数据依据`、`历史判断`; independent top-right maintenance actions.

- [ ] **Step 1: Extend failing UI tests**

Assert that the detail page contains the four decision sections, current period, ERP/workbench result labels, and only independent maintenance panel controls. Assert that the visible page does not contain `聊天快速评估` or `评估详情`.

- [ ] **Step 2: Run the detail tests and confirm failure**

Run: `npx vitest run tests/ui/supplier-detail-decision.test.tsx tests/ui/supplier-evidence-display.test.tsx --reporter=dot`

Expected: FAIL for the missing final labels or any remaining visible legacy section.

- [ ] **Step 3: Implement the detail layout**

Keep the decision loop and monthly cost linkage, but make the monthly judgment the default tab. Render product-family rows first and SKU details only after expansion. Put relationship and capability maintenance behind separate top-right buttons; clicking one must render only its own panel. Preserve raw values, sources and historical records behind detail tabs and export links.

- [ ] **Step 4: Run the detail tests and confirm pass**

Run: `npx vitest run tests/ui/supplier-detail-decision.test.tsx tests/ui/supplier-evidence-display.test.tsx --reporter=dot`

Expected: all detail tests pass.

- [ ] **Step 5: Commit the detail page**

```bash
git add src/app/suppliers/[supplierId]/page.tsx tests/ui/supplier-detail-decision.test.tsx tests/ui/supplier-evidence-display.test.tsx
git commit -m "feat: simplify supplier decision detail"
```

### Task 4: 全量验证与本地验收

**Files:**
- No source changes unless a verification failure identifies a scoped defect.

- [ ] **Step 1: Run all supplier domain and UI tests**

Run: `npx vitest run tests/domain/supplier-dashboard.test.ts tests/domain/supplier-monthly-cost.test.ts tests/domain/supplier-evaluation.test.ts tests/ui/supplier-dashboard.test.tsx tests/ui/supplier-detail-decision.test.tsx tests/ui/supplier-evidence-display.test.tsx --reporter=dot`

Expected: all listed test files pass.

- [ ] **Step 2: Run type and whitespace checks**

Run: `npx tsc --noEmit` and `git diff --check`

Expected: both commands exit successfully.

- [ ] **Step 3: Perform browser acceptance**

Open `/suppliers` and verify the three sections, current month, issue-first ordering and ERP/workbench split. Open one supplier detail and verify monthly judgment, product-family rows, independent maintenance panels, and absence of the chat quick-evaluation entry.

- [ ] **Step 4: Record local-only result**

Confirm that no cloud synchronization or external data mutation occurred. Keep unrelated working-tree changes untouched.
