# 产品与供应决策闭环实施计划

> For agentic workers: use subagent-driven-development or executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 在不接入聚水潭的前提下，把产品机会、现有产品、内部SKU、供应商报价、供应方案、产品汰换和决策档案串成可追溯闭环。

**Architecture:** 继续使用现有 LocalWorkbenchData 作为业务数据模型和 Supabase 同步载体。新增字段采用向后兼容的可选字段，并集中通过 normalizeWorkbenchData 补默认值；页面只消费结构化关联，不直接解析原始文件。先完成现有产品与供应决策，再增加档案导入导出。

**Tech Stack:** Next.js 15、React 19、TypeScript、Zod、Vitest、Supabase proxy、XLSX 文件解析。

## Global Constraints

- 不接入聚水潭，不自动抓取运营数据、库存、订单、点击率或退货率。
- 不删除现有机会、供应商、货盘、SKU关联和原始资料。
- 入仓产品使用正式内部SKU；一件代发只使用观察编号，不冒充正式仓库编码。
- SKU“匹配状态”和供应商“采购状态”必须分开保存。
- 导入默认进入待确认区，不覆盖旧版本。
- 合同和业务文件不得进入 GitHub 代码库。
- 每个任务必须先写失败测试，再写最小实现，完成后运行相关测试和 TypeScript 检查。

---

### Task 1: 产品分类与现有产品状态

**Files:**
- Modify: src/features/workbench/product-knowledge.ts
- Modify: src/features/workbench/local-store.ts
- Modify: src/features/workbench/display-labels.ts
- Modify: src/app/products/page.tsx
- Modify: src/app/products/[productId]/page.tsx
- Test: tests/domain/product-portfolio.test.ts

**Interfaces:**
- Add ProductRecordKind = opportunity | existing | observation | archived.
- Add ProductMode = inbound | dropship | hybrid.
- Add ProductPortfolioStatus = active | observe | optimize | paused | discontinued.
- Extend ProductKnowledgeV2 with optional recordKind, productMode, portfolioStatus, internalProductCode, observationCode.
- Add normalizeProductPortfolioFields(product) and call it from existing normalization.

- [ ] Step 1: Write failing tests for legacy products defaulting to opportunity, existing products retaining explicit status, and observation products accepting an observation code without an internal SKU.
- [ ] Step 2: Run npm test -- --run tests/domain/product-portfolio.test.ts; expect failure because the new fields and normalizer do not exist.
- [ ] Step 3: Add the types, Zod-compatible defaults, labels, and normalization. Default imported legacy opportunity records to opportunity; do not rewrite existing lifecycle history.
- [ ] Step 4: Replace the single 产品机会漏斗 filter with three filters: 产品机会、现有产品、观察产品; retain the existing lifecycle filter inside the opportunity view.
- [ ] Step 5: Add editable status fields on the product detail page. For inbound, show internal product/SKU fields; for dropship, show observation code and no warehouse-code requirement.
- [ ] Step 6: Run npm test -- --run tests/domain/product-portfolio.test.ts tests/domain/local-store.test.ts and npx tsc --noEmit; expect all tests and type checking to pass.
- [ ] Step 7: Commit with git add src/features/workbench/product-knowledge.ts src/features/workbench/local-store.ts src/features/workbench/display-labels.ts src/app/products/page.tsx src/app/products/[productId]/page.tsx tests/domain/product-portfolio.test.ts && git commit -m "feat: separate product opportunities from portfolio products".

### Task 2: 内部SKU与供应方案

**Files:**
- Modify: src/features/workbench/local-store.ts
- Modify: src/app/sku-master/import/page.tsx
- Modify: src/app/products/[productId]/page.tsx
- Modify: src/app/offers/page.tsx
- Modify: src/app/quotes/page.tsx
- Create: src/features/workbench/supply-decision.ts
- Test: tests/domain/supply-decision.test.ts

**Interfaces:**
- Extend LocalSkuMaster with optional productId and productMode.
- Add SupplierOfferDecisionStatus = unreviewed | candidate | primary | backup | not_selected | rejected.
- Add SupplierOfferDecision with id, productId, optional skuMasterId, supplierId, offerId, status, reason, decidedAt, reviewAt.
- Export buildSupplyPlan(data, productId) returning skuRows, primarySuppliers, backupSuppliers, missingFields.

- [ ] Step 1: Write failing tests for one product with two internal SKUs, three matched suppliers, one primary supplier, one backup supplier, and a missing MOQ warning.
- [ ] Step 2: Run npm test -- --run tests/domain/supply-decision.test.ts; expect failure because buildSupplyPlan and the decision model do not exist.
- [ ] Step 3: Add the decision model and normalize duplicate decisions by productId, skuMasterId, supplierId, offerId while preserving prior decisions.
- [ ] Step 4: Add productId to the SKU import confirmation path. Existing imported SKU rows remain valid when productId is absent and appear in an 待关联产品 state.
- [ ] Step 5: Add a 供应方案 section to product detail with one row per internal SKU and actions for candidate, primary, backup, not selected.
- [ ] Step 6: Add filters to offers and quotes for decision status; keep all raw offers visible in history but make the active supply plan the default decision view.
- [ ] Step 7: Add missing-field task generation for absent quote, MOQ, lead time, or backup supplier. Link each generated task to product, SKU, supplier, or offer.
- [ ] Step 8: Run npm test -- --run tests/domain/supply-decision.test.ts tests/domain/sku-comparison.test.ts tests/domain/local-store.test.ts, npx tsc --noEmit, and npm run build.
- [ ] Step 9: Commit with git add src/features/workbench/local-store.ts src/features/workbench/supply-decision.ts src/app/sku-master/import/page.tsx src/app/products/[productId]/page.tsx src/app/offers/page.tsx src/app/quotes/page.tsx tests/domain/supply-decision.test.ts && git commit -m "feat: add product supply plans and supplier decisions".

### Task 3: 现有产品汰换评分与决策历史

**Files:**
- Inspect and reuse: src/features/workbench/product-knowledge.ts existing decision fields
- Modify: src/features/workbench/local-store.ts
- Modify: src/app/products/[productId]/page.tsx
- Create: src/features/workbench/product-evaluation.ts
- Test: tests/domain/product-evaluation.test.ts

**Interfaces:**
- Add ProductEvaluationRecord with id, productId, period, scores, total, recommendation, dataSources, reason, createdAt.
- Export calculateProductEvaluation(scores) and getProductEvaluationRecommendation(total, scores).
- Store records append-only in productEvaluations so later evaluations do not overwrite history.

- [ ] Step 1: Locate the user-approved product replacement scoring fields in the existing backup/specification and map each field to a stable key; do not invent a new scoring standard.
- [ ] Step 2: Write failing tests for score calculation, missing-data labeling, and append-only history.
- [ ] Step 3: Run npm test -- --run tests/domain/product-evaluation.test.ts; expect failure before the evaluator exists.
- [ ] Step 4: Implement the evaluator using the existing approved weights and distinguish manual, imported, and derived data sources.
- [ ] Step 5: Add an evaluation panel to existing products only. Opportunity products keep their opportunity decision and are not scored by this model.
- [ ] Step 6: Add decision actions: continue, optimize, observe, pause, discontinue; each requires a reason and saves an evaluation record.
- [ ] Step 7: Run npm test -- --run tests/domain/product-evaluation.test.ts tests/domain/local-store.test.ts, npx tsc --noEmit, and npm run build.
- [ ] Step 8: Commit with git add src/features/workbench/product-knowledge.ts src/features/workbench/local-store.ts src/features/workbench/product-evaluation.ts src/app/products/[productId]/page.tsx tests/domain/product-evaluation.test.ts && git commit -m "feat: add existing product evaluation history".

### Task 4: 业务档案、版本与决策包导入导出

**Files:**
- Modify: src/features/workbench/local-store.ts
- Modify: src/app/settings/page.tsx
- Modify: src/app/products/[productId]/page.tsx
- Modify: src/app/suppliers/[supplierId]/page.tsx
- Create: src/features/workbench/business-archives.ts
- Test: tests/domain/business-archives.test.ts

**Interfaces:**
- Add BusinessArchiveRecord with id, kind, title, fileName, mimeType, source, version, status, optional productId, skuMasterId, supplierId, offerId, decisionId, effectiveAt, expiresAt, notes, createdAt.
- Export exportProductDecisionPackage(data, productId) and exportSupplierArchivePackage(data, supplierId) returning JSON-safe packages with structured records and archive metadata.
- Export importBusinessPackage(current, package, mode) where mode is pending_review or additive; neither mode overwrites existing versions.

- [ ] Step 1: Write failing tests for version creation, product package contents, supplier package contents, and additive import without overwriting an existing contract or quote.
- [ ] Step 2: Run npm test -- --run tests/domain/business-archives.test.ts; expect failure because archive types and package functions do not exist.
- [ ] Step 3: Implement metadata storage and package export. Original file content is represented by a private-storage reference or backup attachment entry; no binary content is committed to Git.
- [ ] Step 4: Add archive sections to product and supplier detail pages with filters for current, expired, and historical versions.
- [ ] Step 5: Extend settings backup import/export to include archive metadata, product evaluations, supply decisions, and decision history.
- [ ] Step 6: Add a pending-review import screen that previews target associations and rejects duplicate version keys without deleting prior records.
- [ ] Step 7: Run npm test -- --run tests/domain/business-archives.test.ts tests/domain/program-backup.test.ts tests/domain/local-store.test.ts, npx tsc --noEmit, and npm run build.
- [ ] Step 8: Commit with git add src/features/workbench/business-archives.ts src/features/workbench/local-store.ts src/app/settings/page.tsx src/app/products/[productId]/page.tsx src/app/suppliers/[supplierId]/page.tsx tests/domain/business-archives.test.ts && git commit -m "feat: add versioned business archives and decision packages".

### Task 5: 首页改为异常与待决策视图

**Files:**
- Modify: src/features/workbench/dashboard.ts
- Modify: src/app/page.tsx
- Create: tests/domain/dashboard-exceptions.test.ts

- [ ] Step 1: Write failing tests for missing quote, missing MOQ/lead time, no primary supplier, overdue evaluation, and open decision tasks.
- [ ] Step 2: Run npm test -- --run tests/domain/dashboard-exceptions.test.ts; expect failure before exception aggregation exists.
- [ ] Step 3: Add getDashboardExceptions(data) and return actionable items with severity, title, summary, href, and sourceType.
- [ ] Step 4: Replace the current knowledge-first dashboard emphasis with exception counts and 待决策产品; keep the quick-entry and navigation cards.
- [ ] Step 5: Run npm test -- --run tests/domain/dashboard-exceptions.test.ts tests/domain/dashboard.test.ts, npx tsc --noEmit, and npm run build.
- [ ] Step 6: Commit with git add src/features/workbench/dashboard.ts src/app/page.tsx tests/domain/dashboard-exceptions.test.ts && git commit -m "feat: surface product and supply exceptions on dashboard".

## Final verification

- Run npm test and expect all test files to pass.
- Run npx tsc --noEmit and expect exit code 0.
- Run npm run build and expect the Next.js production build to complete.
- Start the local server with npm run dev and verify /, /products, /offers, /quotes, /suppliers, and /settings load.
- Export a product decision package and import it into a clean backup copy; verify old records remain and new versions appear in pending review.
- Verify the existing SKU comparison regression remains fixed after all tasks.
