# Supplier Assignment Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 SKU 供应关系基础上，增加产品族默认主供/备供关系、SKU 例外关系、依据与生效历史，并让产品主表和供应商详情页使用同一套解析结果。

**Architecture:** 继续使用 `LocalWorkbenchData` 作为本地与云端同步的统一数据快照。新增产品族级关系记录，关系解析按“SKU 例外 > 产品族默认 > 入仓证据 > 货盘匹配候选 > 待确认”计算；页面只调用解析函数，不自行推断供应商关系。

**Tech Stack:** Next.js 15 App Router、React、TypeScript、Vitest、现有 local-store/Supabase 同步机制、Tailwind CSS。

## Global Constraints

- 只处理已经入仓的产品，不复制聚水潭采购、库存和订单功能。
- 货盘匹配不自动升级为主供关系，入仓证据不自动替换当前主供。
- 产品族默认关系覆盖全部有效 SKU，SKU 级例外优先于产品族默认关系。
- 每次关系变更保留生效月份、变更原因和依据。
- 不新增无数据依据的供应商评分字段。
- 任何新增字段都必须经过本地保存、刷新读取和现有同步入口。

---

### Task 1: 扩展供应关系数据模型与持久化

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Create: `tests/domain/supplier-assignment-storage.test.ts`

**Interfaces:**
- Produces `LocalProductSupplierAssignment`：`id`、`productFamilyKey`、`supplierId?`、`supplierName?`、`role: "primary" | "backup"`、`effectiveFrom`、`effectiveTo?`、`status: "active" | "ended"`、`source: "manual" | "imported" | "evidence"`、`reason?`、`evidence?`。
- Adds `productSupplierAssignments?: LocalProductSupplierAssignment[]` to `LocalWorkbenchData`.
- Produces `saveProductSupplierAssignments(entries)` that closes conflicting active records for the same product family/role and appends the new effective record without deleting history.

- [ ] **Step 1: Write failing storage tests**

Add tests for:

```ts
it("persists a product-family primary supplier and reloads it", () => {
  saveProductSupplierAssignments([{
    productFamilyKey: "无胶白板贴小纸管",
    supplierId: "supplier-a",
    supplierName: "供应商A",
    role: "primary",
    effectiveFrom: "2026-07",
    status: "active",
    source: "manual",
    reason: "确认当前主供",
    evidence: "7月实际入仓记录",
  }]);
  expect(loadLocalWorkbenchData().productSupplierAssignments).toHaveLength(1);
});

it("ends the previous active primary record instead of deleting it", () => {
  saveProductSupplierAssignments(firstRecord);
  saveProductSupplierAssignments(secondRecord);
  const records = loadLocalWorkbenchData().productSupplierAssignments ?? [];
  expect(records.some((record) => record.status === "ended")).toBe(true);
  expect(records.some((record) => record.supplierName === "供应商B" && record.status === "active")).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --run tests/domain/supplier-assignment-storage.test.ts`

Expected: FAIL because the new type, collection, and save function do not exist.

- [ ] **Step 3: Implement the minimal storage support**

Add the type and collection to `LocalWorkbenchData`; add normalization with an empty-array fallback; implement `saveProductSupplierAssignments` beside `saveSkuSupplierAssignments`. When saving an active record, set `effectiveTo` on the previous active record to the month before the new `effectiveFrom`, mark it `ended`, and append the new record. Keep legacy snapshots untouched.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- --run tests/domain/supplier-assignment-storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workbench/local-store.ts tests/domain/supplier-assignment-storage.test.ts
git commit -m "feat: persist product supplier assignments"
```

### Task 2: 统一供应关系解析优先级

**Files:**
- Modify: `src/features/workbench/relationship-rules.ts`
- Modify: `tests/domain/relationship-rules.test.ts`

**Interfaces:**
- Adds `productFamilyKey` and `productSupplierAssignments` to the classifier input.
- Produces `ResolvedSupplierRelationship` with `supplierId?`, `supplierName?`, `role?`, `source: "sku_assignment" | "family_assignment" | "inbound_evidence" | "offer_match" | "unconfirmed"`, `reason`, and `effectiveFrom?`.
- Keeps `formatSkuRelationshipStatus` compatible with existing callers.

- [ ] **Step 1: Write failing resolver tests**

Cover these exact cases:

```ts
it("uses the product-family primary supplier for every SKU by default", () => {
  const result = classifySkuRelationship({
    skuMasterId: "sku-1",
    skuCode: "Y-01BBT",
    productFamilyKey: "白板贴",
    period: "2026-07",
    offerLinks: [],
    assignments: [],
    productSupplierAssignments: [familyPrimary("白板贴", "供应商A")],
    inboundFacts: [],
  });
  expect(result.supplyStatus).toBe("assigned");
  expect(result.supplierName).toBe("供应商A");
  expect(result.supplierRelationshipSource).toBe("family_assignment");
});

it("lets a SKU exception override the family default", () => {
  const result = classifySkuRelationship({
    ...baseInput,
    productFamilyKey: "白板贴",
    assignments: [skuAssignment("Y-02BBT", "供应商B")],
    productSupplierAssignments: [familyPrimary("白板贴", "供应商A")],
  });
  expect(result.supplierName).toBe("供应商B");
  expect(result.supplierRelationshipSource).toBe("sku_assignment");
});

it("does not turn a matched offer into a primary supplier", () => {
  const result = classifySkuRelationship({ ...baseInput, productSupplierAssignments: [] });
  expect(result.supplyStatus).toBe("unconfirmed");
  expect(result.supplierRelationshipSource).toBe("offer_match");
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run tests/domain/relationship-rules.test.ts`

Expected: FAIL because the classifier does not yet resolve product-family assignments or return the source field.

- [ ] **Step 3: Implement the resolver**

Add a period-aware lookup for active family assignments. Resolve SKU assignment first, then family assignment, and only then fall back to inbound evidence and offer matching. Preserve the existing `matchStatus` and `supplyStatus` values so current UI remains compatible.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/domain/relationship-rules.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workbench/relationship-rules.ts tests/domain/relationship-rules.test.ts
git commit -m "feat: resolve family and sku supplier relationships"
```

### Task 3: Add supplier-detail relationship maintenance entry

**Files:**
- Create: `src/components/workbench/supplier-relationship-editor.tsx`
- Modify: `src/app/suppliers/[supplierId]/page.tsx`
- Create: `tests/ui/supplier-relationship-editor.test.tsx`

**Interfaces:**
- Component props: `supplierId`, `supplierName`, `productFamilies`, `currentPeriod`, `existingAssignments`, `onSaved`.
- Uses `saveProductSupplierAssignments` and emits a saved relationship refresh through `onSaved`.

- [ ] **Step 1: Write the UI contract test**

Assert the source/component contains the required actions and explanatory copy:

```ts
expect(source).toContain("设为主供");
expect(source).toContain("设为备供");
expect(source).toContain("关系范围");
expect(source).toContain("生效月份");
expect(source).toContain("变更原因");
expect(source).toContain("关系依据");
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run tests/ui/supplier-relationship-editor.test.tsx`

Expected: FAIL because the editor does not exist.

- [ ] **Step 3: Implement the editor**

Provide a compact form with product-family selector, relation role selector, effective month input, reason, evidence, and save button. Default scope is product family. Do not expose scoring fields. On save, write one family assignment and refresh the supplier detail view.

- [ ] **Step 4: Mount the editor in the supplier detail page**

Build product-family options from `skuMasters` using `deriveProductFamilyKey`/`groupSkuMastersByProduct`; pass the current supplier as the target supplier. Keep existing evaluation, communication, and quote tabs unchanged.

- [ ] **Step 5: Run focused UI tests**

Run: `npm test -- --run tests/ui/supplier-relationship-editor.test.tsx tests/ui/supplier-detail-decision.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/workbench/supplier-relationship-editor.tsx src/app/suppliers/[supplierId]/page.tsx tests/ui/supplier-relationship-editor.test.tsx
git commit -m "feat: add supplier relationship editor"
```

### Task 4: Wire product master and supplier decision displays

**Files:**
- Modify: `src/app/product-master/page.tsx`
- Modify: `src/app/suppliers/page.tsx`
- Modify: `tests/ui/product-master-relationship-status.test.ts`
- Modify: `tests/ui/supplier-decision-overview.test.tsx`

**Interfaces:**
- Both pages consume the same `classifySkuRelationship` result and must not implement independent supplier precedence logic.

- [ ] **Step 1: Add failing display-contract assertions**

Assert product-family rows expose current primary/backup, SKU exception count, and pending confirmation count; assert supplier overview exposes a link/action for pending relationship confirmation.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run tests/ui/product-master-relationship-status.test.ts tests/ui/supplier-decision-overview.test.tsx`

Expected: FAIL for the new labels/actions.

- [ ] **Step 3: Implement shared display wiring**

Pass `productSupplierAssignments` into all classifiers. Product master family rows show `主供`, `备供`, `SKU例外`, and `待确认`; expanded rows show whether the relationship is inherited or overridden and its evidence. Supplier overview replaces the misleading “SKU覆盖” action emphasis with a relationship action such as `维护供应关系` or `待确认供应关系`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/ui/product-master-relationship-status.test.ts tests/ui/supplier-decision-overview.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/product-master/page.tsx src/app/suppliers/page.tsx tests/ui/product-master-relationship-status.test.ts tests/ui/supplier-decision-overview.test.tsx
git commit -m "feat: wire supplier relationships into decisions"
```

### Task 5: Full verification and cloud sync

**Files:**
- Modify: `docs/architecture/2026-08-25-workbench-domain-model.md` only if the implemented field names differ from the documented model.

- [ ] **Step 1: Run formatting and type checks**

Run: `git diff --check` and `npx tsc --noEmit`.

Expected: no whitespace errors and exit code 0.

- [ ] **Step 2: Run the full test suite**

Run: `npm test -- --run`.

Expected: all test files pass, including the new storage, resolver, editor, and display tests.

- [ ] **Step 3: Build from a clean Next cache**

Run: `if (Test-Path -LiteralPath '.next') { Remove-Item -LiteralPath '.next' -Recurse -Force }; npm run build`.

Expected: Next.js production build succeeds and generates `/product-master`, `/suppliers`, and `/suppliers/[supplierId]`.

- [ ] **Step 4: Commit any documentation alignment**

```bash
git add docs/architecture/2026-08-25-workbench-domain-model.md
git commit -m "docs: align supplier relationship model"
```

Skip this commit only when the existing architecture document already matches the implemented names.

- [ ] **Step 5: Push and verify repository state**

Run: `git push origin HEAD:main; git status --short; git log -1 --oneline`.

Expected: push succeeds, working tree is clean, and the final commit is visible on `main`.

