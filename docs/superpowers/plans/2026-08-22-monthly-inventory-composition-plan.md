# 月度采购库存与组合 SKU 关联实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不影响现有销售月度快照的前提下，增加供应商对账表的月度实际入仓导入，并建立销售组合 SKU、基础产品 SKU 与供应商生效月份之间的可追溯关联。

**Architecture:** 新增独立的月度入仓快照类型，不复用或覆盖 `skuOperatingSnapshots`。新增组合 SKU 关系与供应商生效关系的领域函数，销售编码始终保留原值，基础 SKU 只用于供应和入仓汇总。产品主表先提供导入预览和产品族汇总，后续供应链驾驶舱只消费这些已保存的结果。

**Tech Stack:** Next.js 15 App Router、React、TypeScript、Vitest、现有 `local-store` 本地/云端同步机制、现有 `xlsx` 浏览器解析方式。

## Global Constraints

- 只处理 `productMode !== "dropship"` 的已入仓产品。
- 月度导入不覆盖其他月份，也不覆盖现有销售、退货、ERP 成本快照。
- 实际入仓数量与采购订单数量不是同一字段，本阶段只保存对账表能证明的实际入仓数量。
- 组合 SKU 的完整销售编码必须保留；只能新增基础 SKU 关系，不能改写原始销售编码。
- 供应商更换必须按生效月份保存，历史月份不能被新供应商覆盖。
- 空白数值不自动转为 0；只有表格明确填写 0 时才保存为 0。
- 无法确定的供应商、SKU 或规格必须进入人工确认状态，不自动强匹配。

---

### Task 1: 建立月度入仓快照和组合 SKU 领域模型

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Create: `src/features/workbench/monthly-inbound.ts`
- Create: `src/features/workbench/sku-composition.ts`
- Test: `tests/domain/monthly-inbound.test.ts`
- Test: `tests/domain/sku-composition.test.ts`

**Interfaces:**
- `LocalMonthlyInboundSnapshot`: `{ id, skuMasterId, period, receivedQuantity?, actualStock?, availableStock?, inTransitQuantity?, supplierId?, supplierName?, sourceFileName, sourceSheetName, importedAt }`
- `LocalSkuComposition`: `{ id, salesSkuCode, componentSkuCode, componentQuantity, relationStatus: "confirmed" | "pending", effectiveFrom?, effectiveTo?, source, note? }`
- `LocalSkuSupplierAssignment`: `{ id, skuCode, supplierId?, supplierName?, effectiveFrom, effectiveTo?, status: "active" | "ended", source, note? }`
- `parseSkuCompositionCode(salesSkuCode, productName): { baseSkuCode?: string; accessoryCount?: number; confidence: "exact" | "suggested" | "manual" }`
- `aggregateMonthlyInbound(rows): { receivedQuantity, actualStock, availableStock, inventoryGap, inTransitQuantity }`

- [ ] **Step 1: Write the failing tests for monthly snapshot upsert and historical preservation.**

  Test that saving August data for one SKU leaves July data unchanged, replaces only an existing August record after explicit upsert, and preserves `undefined` for blank values.

- [ ] **Step 2: Run the focused test and confirm it fails because the new types/functions do not exist.**

  Run: `npm test -- tests/domain/monthly-inbound.test.ts`

  Expected: FAIL with missing module or missing function errors.

- [ ] **Step 3: Write the failing tests for composition parsing and supplier history.**

  Test that `Y-02BBT-8` produces a suggested base code `Y-02BBT` only when the product name indicates the whiteboard-plus-pen bundle, that `Y-02BBT` remains unchanged, and that a supplier assignment effective in August does not change a July lookup.

- [ ] **Step 4: Run the composition test and confirm the expected failure.**

  Run: `npm test -- tests/domain/sku-composition.test.ts`

  Expected: FAIL because the composition and effective-date lookup functions are not implemented.

- [ ] **Step 5: Add the new persisted types and pure domain helpers.**

  Extend `LocalWorkbenchData` with optional arrays for monthly inbound snapshots, SKU compositions, and SKU supplier assignments. Add additive normalisation in the existing local-store migration path so old backups receive empty arrays without changing existing records. Implement pure helpers in the two new feature files; do not infer an arbitrary base SKU from every numeric suffix.

- [ ] **Step 6: Add local-store save/load functions with period-scoped replacement.**

  Add `saveMonthlyInboundSnapshots(entries)` and `findSkuSupplierAtPeriod(skuCode, period)`. The save function must replace only the same `skuMasterId + period` pair, preserve other periods, and call the existing local/cloud persistence path.

- [ ] **Step 7: Run both focused tests and confirm they pass.**

  Run: `npm test -- tests/domain/monthly-inbound.test.ts tests/domain/sku-composition.test.ts`

  Expected: all focused tests pass.

---

### Task 2: Parse heterogeneous supplier reconciliation workbooks

**Files:**
- Create: `src/features/workbench/supplier-inbound-import.ts`
- Test: `tests/domain/supplier-inbound-import.test.ts`

**Interfaces:**
- `SupplierInboundImportRow`: `{ rowNumber, deliveryDate?, supplierName?, supplierProductName, supplierSpec, receivedQuantity, unit?, unitPrice?, amount?, sourceFileName, sourceSheetName, importedAt }`
- `SupplierInboundImportIssue`: `{ rowNumber, code, message }`
- `SupplierInboundImportResult`: `{ rows, errors, detectedHeaders, summary }`
- `parseSupplierInboundRows(rawRows, meta): SupplierInboundImportResult`
- `formatSupplierInboundImportError(cause): string`

- [ ] **Step 1: Write a failing test using the supplied July reconciliation structure.**

  Use rows with headers `送货日期、产品名称、产品规格、送货数量、单位、单价、金额`, carry the date and product name down for blank merged cells, ignore rows beginning with `合计`, `本月货款`, `截止本月`, `供应商确认`, and calculate the sample total of 11,060 units from the detail rows.

- [ ] **Step 2: Run the parser test and verify the expected failure.**

  Run: `npm test -- tests/domain/supplier-inbound-import.test.ts`

  Expected: FAIL because the new parser does not exist.

- [ ] **Step 3: Add keyword-based header detection and row normalization.**

  Support aliases for date, product name, specification, quantity, unit, unit price, amount, supplier, and ignore summary/signature rows. Carry forward the latest non-empty date and product name. Preserve the original supplier product name/specification for later manual mapping.

- [ ] **Step 4: Add validation and duplicate handling.**

  Reject missing product/specification or negative quantity, retain blank supplier as `undefined`, and report malformed numeric cells by row. Do not reject the whole file because one supplier name is absent.

- [ ] **Step 5: Run the focused parser tests and the existing Jushuitan parser tests.**

  Run: `npm test -- tests/domain/supplier-inbound-import.test.ts tests/domain/jushuitan-sales-import.test.ts`

  Expected: all tests pass and existing sales import behavior remains unchanged.

---

### Task 3: Add monthly inbound import and confirmation UI

**Files:**
- Modify: `src/app/product-master/page.tsx`
- Create: `src/components/workbench/supplier-inbound-import-preview.tsx`
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/ui/product-master-inbound-import.test.tsx`

**Interfaces:**
- Preview component props: `{ result: SupplierInboundImportResult; period: string; skuMasters: LocalSkuMaster[]; suppliers: LocalSupplier[]; onCancel: () => void; onConfirm: (rows: ConfirmedInboundRow[]) => void }`
- `ConfirmedInboundRow`: `{ skuMasterId, period, receivedQuantity?, actualStock?, availableStock?, inTransitQuantity?, supplierId?, supplierName?, sourceFileName, sourceSheetName, importedAt }`

- [ ] **Step 1: Write failing UI tests for the import entry and confirmation state.**

  Test that the product master shows a `导入月度实际入仓表` action, previews row count and unmatched rows, allows cancellation, and does not save until confirmation.

- [ ] **Step 2: Run the UI test and verify it fails before the entry exists.**

  Run: `npm test -- tests/ui/product-master-inbound-import.test.tsx`

  Expected: FAIL because the entry and preview component do not exist.

- [ ] **Step 3: Implement the import entry using the existing workbook reader pattern.**

  Accept `.xlsx`, `.xls`, and `.csv`; parse the first worksheet with `parseSupplierInboundRows`; use the selected month; show filename and sheet name. Do not call `saveMonthlyInboundSnapshots` during file selection.

- [ ] **Step 4: Implement confirmation mapping.**

  Match supplier rows to internal SKU by exact supplier code when available, otherwise suggest by normalized product family plus normalized specification. Show unmatched rows and require manual selection or explicit skip before saving. If the workbook has no supplier name, require selecting the supplier once for the import batch.

- [ ] **Step 5: Implement save and success feedback.**

  Save only confirmed rows, report imported and skipped counts, and display a warning when the same SKU/month will be replaced. Refresh the current page data through the existing store mechanism without clearing sales snapshots.

- [ ] **Step 6: Run the focused UI tests and all domain tests.**

  Run: `npm test -- tests/ui/product-master-inbound-import.test.tsx tests/domain/monthly-inbound.test.ts tests/domain/supplier-inbound-import.test.ts`

  Expected: all focused tests pass.

---

### Task 4: Show monthly supply facts and composition relationships in product master

**Files:**
- Modify: `src/app/product-master/page.tsx`
- Create: `src/components/workbench/sku-composition-panel.tsx`
- Test: `tests/domain/product-master.test.ts`
- Test: `tests/ui/product-master-inbound-import.test.tsx`

**Interfaces:**
- `buildProductInboundSummary(skuMasters, inboundSnapshots, salesSnapshots, period): ProductInboundSummary`
- `ProductInboundSummary`: `{ receivedQuantity, actualStock, availableStock, inventoryGap, receivedToShippedRatio?: number, missingPreviousPeriod: boolean }`

- [ ] **Step 1: Write failing summary tests.**

  Test aggregation by product family, blank values remaining unavailable, `receivedToShippedRatio` returning undefined when shipped quantity is zero, and month-over-month inventory change being unavailable without a previous snapshot.

- [ ] **Step 2: Run the summary tests and confirm they fail.**

  Run: `npm test -- tests/domain/product-master.test.ts`

  Expected: FAIL because the summary helper does not exist.

- [ ] **Step 3: Implement the pure summary helper and composition display.**

  Add a compact “月度供应与库存” section to each product-family row or expansion area. Show actual inbound, actual stock, available stock, gap, and ratio with explicit `待采集`/`暂无销售样本` states. Add a secondary composition panel that shows `Y-02BBT-8 → Y-02BBT × 1 + 白板笔 × 8` only after confirmation; suggested relations remain visibly unconfirmed.

- [ ] **Step 4: Add effective-month supplier display.**

  Display current supplier for the selected month and preserve a link to historical supplier assignments. Changing the current supplier must not change prior month summaries.

- [ ] **Step 5: Run focused tests, full tests, type check, and production build.**

  Run:

  - `npm test`
  - `npx tsc --noEmit`
  - `npm run build`

  Expected: all tests pass, type check exits 0, and the production build completes successfully.

---

### Task 5: Commit and verify local/cloud handoff

**Files:**
- Modify: no additional source files

- [ ] **Step 1: Verify the working tree contains only the planned changes.**

  Run: `git status --short` and `git diff --check`.

- [ ] **Step 2: Commit the feature in one coherent commit.**

  Run: `git add src tests docs/superpowers/specs docs/superpowers/plans; git commit -m "feat: add monthly inbound supply intake"`.

- [ ] **Step 3: Push the branch changes to the repository main branch.**

  Run: `git push origin HEAD:main`.

- [ ] **Step 4: Verify local page availability and report deployment status accurately.**

  Check `http://localhost:3000/product-master`; report GitHub push success separately from Vercel deployment completion, which depends on the connected deployment system.
