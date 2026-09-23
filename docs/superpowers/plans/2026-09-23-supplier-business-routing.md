# Supplier Business Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent supplier aliases, product-to-supplier routing, and separate dropship/inbound cooperation display without replacing the existing supplier or procurement flows.

**Architecture:** Extend the existing local workbench snapshot with two small mapping collections. Keep workbook parsing pure, build a routing preview from source facts plus saved mappings, and write formal records only after every selected routing decision is validated. Derive supplier cooperation modes from records and relationships instead of duplicating supplier masters.

**Tech Stack:** Next.js, React, TypeScript, SheetJS, Vitest, Testing Library, local workbench store.

## Global Constraints

- One legal supplier remains one supplier master.
- Dropship and inbound performance stay separate.
- Preserve workbook sheet and row provenance.
- Re-importing the same platform and period updates records idempotently.
- Missing values remain “未采集” and are never scored as zero.
- Reuse the procurement table borders and current visual language.
- Do not refactor unrelated dirty-worktree files.

---

### Task 1: Persistent routing model

**Files:**
- Modify: `src/features/workbench/dropship-performance-import.ts`
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/domain/dropship-performance-import.test.ts`
- Test: `tests/domain/local-store.test.ts`

**Interfaces:**
- Produces: `SupplierAliasMapping`, `DropshipProductRouting`, `SupplierBusinessMode`, `supplierAliasMappings`, `dropshipProductRoutings`.
- Consumes: existing `LocalSupplier`, `DropshipProductPeriod`, and `LocalWorkbenchData`.

- [ ] **Step 1: Write failing normalization and mapping tests**

Add tests proving legacy snapshots normalize missing mapping collections to empty arrays and preserve stored alias/product mappings through save-load/export-import.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run tests/domain/dropship-performance-import.test.ts tests/domain/local-store.test.ts`

Expected: FAIL because the mapping fields and types do not exist.

- [ ] **Step 3: Add minimal data types and normalization**

Implement:

```ts
export type SupplierBusinessMode = 'dropship' | 'inbound';
export type SupplierAliasMapping = {
  id: string;
  platform: string;
  sourceName: string;
  normalizedSourceName: string;
  supplierId: string;
  confirmedAt: string;
};
export type DropshipProductRouting = {
  id: string;
  platform: string;
  productName: string;
  normalizedProductName: string;
  supplierId: string;
  businessMode: SupplierBusinessMode;
  confirmedAt: string;
};
```

Add both arrays to `LocalWorkbenchData`, `emptyData`, normalization, and cloud/local merging without altering existing records.

- [ ] **Step 4: Run tests and verify GREEN**

Run the Task 1 command and expect all selected tests to pass.

- [ ] **Step 5: Commit only Task 1 files**

Commit message: `feat: persist supplier import routing`

---

### Task 2: Routing preview and idempotent import

**Files:**
- Modify: `src/features/workbench/dropship-performance-import.ts`
- Test: `tests/domain/dropship-performance-import.test.ts`

**Interfaces:**
- Produces: `DropshipRoutingDecision`, expanded `DropshipImportPreview`, and an `applyDropshipImport` result that persists confirmed mappings.
- Consumes: Task 1 mapping collections.

- [ ] **Step 1: Write failing routing tests**

Cover these behaviors independently:

```ts
it('uses a saved alias to merge merchant and after-sales rows');
it('reports source, effective, matched, pending and unrouted product counts');
it('routes a product to one supplier as dropship');
it('blocks conflicting aliases and unrouted selected products');
it('re-imports the same period without duplicate records or mappings');
```

- [ ] **Step 2: Run the domain test and verify RED**

Run: `npm test -- --run tests/domain/dropship-performance-import.test.ts`

Expected: FAIL on missing routing API/counts.

- [ ] **Step 3: Implement alias-aware grouping**

Resolve source names in this order: exact supplier name, saved alias, normalized suggestion, unmatched. Build one group per resolved supplier or unresolved source name. Detect two saved aliases that resolve the same source/platform to different suppliers and return a blocking issue.

- [ ] **Step 4: Implement product routing and statistics**

Add preview counts for raw rows, effective records, matched supplier groups, pending supplier groups, and unrouted products. Apply saved product routing before requesting a decision. Default new workbook product decisions to `dropship` but do not write them without a supplier ID.

- [ ] **Step 5: Implement atomic persistence**

On confirm, validate decisions first, then return one updated `LocalWorkbenchData` containing period records, pending rows, product periods, alias mappings, and product mappings. Deduplicate by platform plus normalized source/product name and update the same period business key.

- [ ] **Step 6: Run tests and verify GREEN**

Run the Task 2 command and expect all tests to pass.

- [ ] **Step 7: Commit only Task 2 files**

Commit message: `feat: route supplier workbook data`

---

### Task 3: Five-step import workspace

**Files:**
- Modify: `src/components/workbench/dropship-performance-import-dialog.tsx`
- Test: `tests/ui/dropship-performance-import.test.tsx`

**Interfaces:**
- Consumes: Task 2 preview counts and routing decisions.
- Produces: one modal flow with upload, supplier mapping, product routing, final preview, and confirmation.

- [ ] **Step 1: Write failing UI tests**

Test that the modal:

- shows all three Sheet counts and effective record counts;
- labels supplier rows as automatic, saved alias, suggested, or pending;
- requires a supplier for selected product routing;
- shows the final write counts before enabling confirmation;
- preserves successful re-import behavior.

- [ ] **Step 2: Run the UI test and verify RED**

Run: `npm test -- --run tests/ui/dropship-performance-import.test.tsx`

Expected: FAIL because the current modal has a single preview screen.

- [ ] **Step 3: Implement the smallest step controller**

Use a local `step` value (`upload`, `supplier`, `product`, `review`) and keep the parsed preview in memory. Do not add routes or a new page.

- [ ] **Step 4: Add bordered tables and validation**

Reuse `procurementTable`. Show counts at the top, one select per unresolved supplier, and product supplier/business-mode controls. Disable progression with a precise message when a selected record is not routed.

- [ ] **Step 5: Add final write preview and success summary**

The review step must list formal period records, pending suppliers, saved aliases, routed products, and unresolved items before confirmation.

- [ ] **Step 6: Run the UI and domain tests**

Run: `npm test -- --run tests/ui/dropship-performance-import.test.tsx tests/domain/dropship-performance-import.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit only Task 3 files**

Commit message: `feat: add supplier import routing workspace`

---

### Task 4: Supplier cooperation-mode presentation

**Files:**
- Modify: `src/components/workbench/supplier-business-ledger.tsx`
- Modify: `src/components/workbench/supplier-profile-workspace.tsx`
- Modify: `src/features/workbench/dropship-decision-loop.ts`
- Test: `tests/ui/supplier-business.test.tsx`
- Test: `tests/ui/supplier-profile-workspace.test.tsx`

**Interfaces:**
- Produces: `deriveSupplierBusinessModes(data, supplierId): SupplierBusinessMode[]`.
- Consumes: dropship period records, product routing, procurement fulfillment records, and product-supplier relationships.

- [ ] **Step 1: Write failing presentation tests**

Prove that one supplier can display both “代发” and “入仓”, that its dropship section shows only period metrics, and that inbound records remain in their existing procurement/fulfillment section.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run tests/ui/supplier-business.test.tsx tests/ui/supplier-profile-workspace.test.tsx`

Expected: FAIL because cooperation modes are not derived or displayed.

- [ ] **Step 3: Implement mode derivation**

Derive `dropship` from `dropship_period` records or dropship product routing. Derive `inbound` from inbound procurement fulfillment/relationships. Return both without creating another supplier master or a mixed score.

- [ ] **Step 4: Add compact mode badges and separated sections**

Place cooperation mode near supplier identity. Keep the existing tabs and tables; only add the derived badges and explicit “代发履约 / 入仓履约” labels where ambiguity exists.

- [ ] **Step 5: Run tests and verify GREEN**

Run the Task 4 command and expect all tests to pass.

- [ ] **Step 6: Commit only Task 4 files**

Commit message: `feat: distinguish supplier business modes`

---

### Task 5: Regression and real-workbook verification

**Files:**
- Verify only; modify scoped files only if a failing test proves a defect.

**Interfaces:**
- Consumes all prior tasks.
- Produces verified behavior against `C:/Users/Administrator/Desktop/代发供应商履约表.xlsx`.

- [ ] **Step 1: Run focused regression**

Run:

```powershell
npm test -- --run tests/domain/dropship-performance-import.test.ts tests/domain/dropship-period-performance.test.ts tests/domain/dropship-decision-loop.test.ts tests/domain/local-store.test.ts tests/ui/dropship-performance-import.test.tsx tests/ui/supplier-business.test.tsx tests/ui/supplier-profile-workspace.test.tsx
npx tsc --noEmit
git diff --check
```

Expected: all selected tests and type checking pass; `git diff --check` reports no new whitespace errors.

- [ ] **Step 2: Verify the supplied workbook preview**

Confirm the preview reports 30 merchant records, 30 product records, 30 after-sales records, and explicitly reports the unresolved cross-Sheet mappings rather than silently omitting them.

- [ ] **Step 3: Verify idempotency in a disposable test snapshot**

Apply the same confirmed preview twice and assert one period record per supplier/platform/period and one mapping per normalized alias/product key.

- [ ] **Step 4: Review scoped diff**

Inspect only the files listed in Tasks 1-4 and ensure unrelated dirty-worktree changes are neither staged nor modified.
