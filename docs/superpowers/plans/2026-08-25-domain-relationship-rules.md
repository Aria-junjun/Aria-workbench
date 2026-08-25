# Domain Relationship Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将产品族、SKU、货盘规格和实际供应关系的判断规则集中到可测试的领域辅助层，并消除 SKU 覆盖率作为供应商动作的错误用法。

**Architecture:** 不改现有持久化数据结构，不自动修改已有供应商或货盘关系。新增纯函数读取现有 `LocalSkuOfferLink`、`LocalSkuSupplierAssignment` 和月度入仓事实，输出“规格匹配状态”和“实际供应状态”两套互不混淆的结果；产品/供应商页面继续消费现有聚合函数，但不再把部分 SKU 覆盖生成供应商待办。

**Tech Stack:** Next.js 15, TypeScript, Vitest, Testing Library, 现有 `local-store` 数据模型。

## Global Constraints

- `confirmed` 规格对应只表示 SKU 与货盘规格匹配，不表示供应商成为主供。
- 实际供应关系必须以月度入仓事实或有效期内的 SKU 供应商 assignment 为证据。
- SKU 覆盖率只保留为参考字段，不产生供应商动作。
- 退货率只作为产品质量复核信号，多供应商场景不直接归因。
- 撤销的规格对应关系不得参与有效匹配结果。
- 没有证据时返回“待确认/未采集”，不补零、不生成默认评分。
- 本任务不接入聚水潭 API，不新增日常录入，不修改业务数据。

---

### Task 1: 建立 SKU 关系状态领域函数

**Files:**
- Create: `src/features/workbench/relationship-rules.ts`
- Test: `tests/domain/relationship-rules.test.ts`

**Interfaces:**
- `getConfirmedOfferLinks(links, skuMasterId): LocalSkuOfferLink[]`
- `getActiveSupplierAssignment(assignments, skuCode, period): SupplierAssignmentForLookup | undefined`
- `classifySkuRelationship(input): SkuRelationshipSummary`

- [x] **Step 1: Write the failing tests**

```ts
it("treats a confirmed offer link as a match but does not infer a primary supplier", () => {
  const result = classifySkuRelationship({
    skuMasterId: "sku-a",
    skuCode: "Y-01",
    period: "2026-07",
    offerLinks: [{ id: "link-1", skuMasterId: "sku-a", offerId: "offer-a", status: "confirmed", confirmedAt: "2026-07-01" }],
    assignments: [],
    inboundFacts: [],
  });

  expect(result.matchStatus).toBe("matched");
  expect(result.supplyStatus).toBe("unconfirmed");
  expect(result.supplierName).toBeUndefined();
});

it("uses the active assignment for the requested month only", () => {
  const result = classifySkuRelationship({
    skuMasterId: "sku-a",
    skuCode: "Y-01",
    period: "2026-07",
    offerLinks: [],
    assignments: [
      { id: "old", skuCode: "Y-01", supplierName: "供应商甲", effectiveFrom: "2026-01", effectiveTo: "2026-06", status: "ended", source: "manual" },
      { id: "current", skuCode: "Y-01", supplierName: "供应商乙", effectiveFrom: "2026-07", status: "active", source: "manual" },
    ],
    inboundFacts: [],
  });

  expect(result.supplyStatus).toBe("assigned");
  expect(result.supplierName).toBe("供应商乙");
});

it("keeps revoked links and missing supplier evidence out of the confirmed relationship", () => {
  const result = classifySkuRelationship({
    skuMasterId: "sku-a",
    skuCode: "Y-01",
    period: "2026-07",
    offerLinks: [{ id: "link-1", skuMasterId: "sku-a", offerId: "offer-a", status: "revoked", confirmedAt: "2026-07-01" }],
    assignments: [],
    inboundFacts: [{ skuMasterId: "sku-a", period: "2026-07", receivedQuantity: 10 }],
  });

  expect(result.matchStatus).toBe("unmatched");
  expect(result.supplyStatus).toBe("supplier_unconfirmed");
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --run tests/domain/relationship-rules.test.ts`

Expected: FAIL because `relationship-rules.ts` and `classifySkuRelationship` do not exist.

- [x] **Step 3: Implement the minimal pure functions**

Use existing `LocalSkuOfferLink`, `LocalSkuSupplierAssignment` and a small inbound fact type. `getConfirmedOfferLinks` filters by SKU and `status === "confirmed"`; `getActiveSupplierAssignment` delegates to the existing effective-period lookup; `classifySkuRelationship` sets:

- `matchStatus`: `matched` only when at least one confirmed, non-revoked link exists, otherwise `unmatched`.
- `supplyStatus`: `assigned` when an active assignment exists, `supplier_unconfirmed` when inbound exists without a supplier, otherwise `unconfirmed`.
- `supplierName`: only from the active assignment or a named inbound fact; never from the offer link.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- --run tests/domain/relationship-rules.test.ts`

Expected: PASS.

- [x] **Step 5: Commit the isolated domain rule**

```powershell
git add tests/domain/relationship-rules.test.ts src/features/workbench/relationship-rules.ts
git commit -m "feat: separate SKU matching from supplier assignment"
```

### Task 2: Remove SKU coverage as a supplier action

**Files:**
- Modify: `src/features/workbench/product-master.ts`
- Modify: `src/app/product-master/page.tsx`
- Modify: `tests/domain/product-master-inbound.test.ts`
- Modify: `tests/ui/supplier-decision-overview.test.tsx`

**Interfaces:**
- `ProductSupplierDecision` no longer emits `complete_coverage`.
- `ProductSupplierDecisionRow.coveredSkuCount` and `totalSkuCount` remain reference fields.
- `buildProductSupplierDecisionRows` still emits `confirm_supplier`, `review_split`, `review_quality`, or `maintain_primary`.

- [x] **Step 1: Add the failing regression test**

Add a product-family case with one named supplier supplying one of two SKUs and assert `decision === "maintain_primary"`, `actionLabel === "保持主供"`, and `coveredSkuCount === 1`. Also assert the product master summary does not count `complete_coverage` as a pending supplier action.

- [x] **Step 2: Run the focused tests and verify the expected failure**

Run: `npm test -- --run tests/domain/product-master-inbound.test.ts tests/ui/supplier-decision-overview.test.tsx`

Expected: the new product-family assertion fails because the current product decision helper still returns `complete_coverage` for partial coverage.

- [x] **Step 3: Implement the minimal rule change**

Remove the coverage branch from `decisionForSupplierRow`, remove `complete_coverage` from the public decision union and update the product master pending count to include only `confirm_supplier`. Keep coverage counts visible as reference data and leave the existing supplier overview coverage display unchanged.

- [x] **Step 4: Run the focused tests and verify they pass**

Run: `npm test -- --run tests/domain/product-master-inbound.test.ts tests/domain/supplier-decision-overview.test.ts tests/ui/supplier-decision-overview.test.tsx`

Expected: PASS.

- [x] **Step 5: Commit the decision-rule correction**

```powershell
git add tests/domain/product-master-inbound.test.ts tests/domain/supplier-decision-overview.test.tsx src/features/workbench/product-master.ts src/app/product-master/page.tsx
git commit -m "fix: keep SKU coverage as supplier reference"
```

### Task 3: Regression verification

**Files:**
- No production files unless a test exposes a type mismatch.

- [x] **Step 1: Run all domain and UI tests related to the workbench**

Run: `npm test -- --run tests/domain/relationship-rules.test.ts tests/domain/sku-composition.test.ts tests/domain/product-master-inbound.test.ts tests/domain/supplier-decision-overview.test.ts tests/ui/supplier-decision-overview.test.tsx tests/ui/supplier-evidence-display.test.tsx`

Expected: PASS.

- [x] **Step 2: Run type checking**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [x] **Step 3: Run production build**

Run: `npm run build`

Expected: build completes successfully and the product-master/suppliers routes remain generated.

- [x] **Step 4: Review the resulting behavior**

Confirm the visible result: partial SKU coverage remains a reference ratio, an unmatched actual supplier remains actionable, and a confirmed offer link alone does not display a supplier assignment.

- [x] **Step 5: Commit any test-only stabilization and report sync status**

If the working tree is clean after Task 2, no additional commit is needed. The implementation branch can then be pushed to GitHub `main`; Vercel deployment is only required after production code changes are accepted.
