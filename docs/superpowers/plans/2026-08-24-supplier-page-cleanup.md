# 供应商页面整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce visual density on the supplier page and keep product-family names separate from SKU specifications.

**Architecture:** Keep the evidence-based decision overview at the top. Add client-side pagination to the existing supplier evaluation table after the current filters. Normalize family display names in the shared SKU grouping helper so every consumer receives the family name without size/specification suffixes.

**Tech Stack:** Next.js App Router, React state, TypeScript, Vitest, Tailwind utility classes.

## Global Constraints

- Do not delete or rewrite existing SKU, supplier, offer, inbound, or evaluation records.
- Do not add a left navigation panel for this change; the page remains a single supplier decision workspace.
- Product-family names contain the base product only; size/specification stays on the SKU row.
- Existing supplier scores remain available as reference data, not as a new decision rule.

---

### Task 1: Normalize product-family display names

**Files:**
- Modify: `src/features/workbench/product-master.ts`
- Test: `tests/domain/product-master.test.ts`

**Interfaces:**
- `deriveProductFamilyKey(productName, productFamilyKey)` remains the single normalization entry point.
- `groupSkuMastersByProduct(rows)` must return `productName` equal to the normalized family key when the source name contains a specification suffix.

- [ ] **Step 1: Write the failing test**

Add a case asserting that `groupSkuMastersByProduct` groups `无胶白板贴小纸管0.3*0.6m` and `无胶白板贴小纸管0.45*2m` as `无胶白板贴小纸管`, while preserving both SKU IDs.

- [ ] **Step 2: Run the focused test and verify it fails**

Run `npm test -- --run tests/domain/product-master.test.ts` and confirm the returned group name still contains the first SKU specification.

- [ ] **Step 3: Implement the minimal normalization**

Use the existing `deriveProductFamilyKey` result as the group display name instead of `productName.split("+")[0]`. Preserve explicit `productFamilyKey` values exactly after trimming.

- [ ] **Step 4: Run the focused test and verify it passes**

Run `npm test -- --run tests/domain/product-master.test.ts` and confirm all product grouping tests pass.

### Task 2: Paginate the supplier evaluation list

**Files:**
- Modify: `src/app/suppliers/page.tsx`
- Test: `tests/ui/supplier-page-pagination.test.tsx`

**Interfaces:**
- The existing `filtered` supplier result remains the source for the list.
- The rendered rows use a derived `paginatedSuppliers` slice and expose page controls with 10 rows per page.

- [ ] **Step 1: Write the failing UI contract test**

Read the supplier page source and assert it contains the page-size constant, page state, a paginated slice, and the visible labels `上一页`, `下一页`, and `第 1 /`.

- [ ] **Step 2: Run the focused UI test and verify it fails**

Run `npm test -- --run tests/ui/supplier-page-pagination.test.tsx` and confirm the pagination contract is absent.

- [ ] **Step 3: Implement pagination**

Add page state reset when query/category/grade/model filters change, derive the total page count and current slice from `filtered`, and render compact controls below the supplier table. Disable previous/next buttons at the boundaries. Keep the decision overview above the table unchanged.

- [ ] **Step 4: Run focused tests and type-check**

Run `npm test -- --run tests/ui/supplier-page-pagination.test.tsx tests/domain/product-master.test.ts` and `npx tsc --noEmit`.

### Task 3: Regression verification and delivery

**Files:**
- Verify: `src/app/suppliers/page.tsx`, `src/features/workbench/product-master.ts`

- [ ] **Step 1: Run full tests**

Run `npm test -- --run`; expected result is all test files passing.

- [ ] **Step 2: Run production build**

Stop the development server before `npm run build`, then run the build and confirm Next.js completes successfully.

- [ ] **Step 3: Restart and smoke-test local routes**

Clean generated `.next`, restart `npm run dev -- -p 3000`, and request `/suppliers`, `/product-master`, and `/offers`; each must return HTTP 200.

- [ ] **Step 4: Commit and push**

Run `git diff --check`, commit the page cleanup, and push the current branch to `origin/main` so Vercel can deploy the same source.
