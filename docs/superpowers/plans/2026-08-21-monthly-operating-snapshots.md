# Monthly Operating Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add low-maintenance monthly SKU operating snapshots and product-family month-over-month summaries without overwriting existing SKU, offer, supplier, or decision data.

**Architecture:** Store one normalized snapshot per SKU and `YYYY-MM` period in the existing local workbench payload so it remains compatible with the current local/cloud sync envelope. Keep the existing SKU fields as a backward-compatible current-value fallback, and compute family summaries from selected-period snapshots with explicit pending states. Keep Jushuitan integration out of this iteration.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Vitest, existing `local-store` persistence and Supabase proxy sync.

## Global Constraints

- Do not delete or rename existing SKU, offer, supplier, or decision fields.
- Do not add a Jushuitan API client in this iteration.
- Do not store raw order lines; store monthly SKU aggregates only.
- Missing metrics must remain missing and display as pending, never as fabricated zeroes.
- Existing local data must load without migration errors.

---

### Task 1: Add monthly snapshot domain model and aggregation

**Files:**
- Modify: `src/features/workbench/local-store.ts` near `LocalSkuMaster` and `LocalWorkbenchData`
- Modify: `src/features/workbench/product-master.ts`
- Test: `tests/domain/product-master.test.ts`

**Interfaces:**
- Add `LocalSkuOperatingSnapshot` with `id`, `skuMasterId`, `period`, the six operating metrics, `source: "manual" | "imported"`, `createdAt`, and `updatedAt`.
- Add optional `skuOperatingSnapshots?: LocalSkuOperatingSnapshot[]` to `LocalWorkbenchData`.
- Add `aggregateSkuSnapshots(rows, previousRows)` returning the selected-period summary and period-over-period deltas.
- Add `saveSkuOperatingSnapshot(skuMasterId, period, patch)` that upserts by `(skuMasterId, period)` and preserves prior periods.

- [ ] Write failing tests for upsert-by-period, legacy current-value fallback, missing-data pending state, and weighted family margin.
- [ ] Run `npm test -- tests/domain/product-master.test.ts` and verify the new assertions fail for the expected missing-function reason.
- [ ] Implement the snapshot type, normalized persistence, upsert helper, and summary function with no unrelated refactor.
- [ ] Run the focused test again and verify it passes.
- [ ] Commit with `feat: add monthly sku operating snapshots`.

### Task 2: Add monthly entry and family comparison to the product master

**Files:**
- Modify: `src/app/product-master/page.tsx`
- Test: `tests/ui/product-master.test.tsx` (create if absent)

**Interfaces:**
- Add a `YYYY-MM` month selector defaulting to the current month.
- Add a “保存本月快照” action that writes only the selected month.
- Render family summary from selected snapshots and previous-month snapshots.
- Render SKU inputs as draft values for the selected month, falling back to the legacy current-value fields only when no snapshot exists.

- [ ] Write a UI/domain test that renders the month selector, shows pending when no snapshot exists, and preserves a previous month after saving a new month.
- [ ] Run the focused test and verify it fails before the UI wiring exists.
- [ ] Implement the month selector, draft state, save action, summary display, and compact month-over-month labels.
- [ ] Keep existing source notes and supply-plan columns unchanged.
- [ ] Run focused UI tests and `npx tsc --noEmit`.
- [ ] Commit with `feat: add monthly product master review`.

### Task 3: Verify local/cloud payload compatibility and deploy the completed version

**Files:**
- Modify only if needed: `src/features/workbench/local-store.ts` normalization/export paths
- Test: `tests/domain/local-store.test.ts` and full suite

**Interfaces:**
- Existing export/import and Supabase sync envelopes must carry `skuOperatingSnapshots` without dropping the collection.

- [ ] Add a persistence test covering export/import of snapshots and legacy data without snapshots.
- [ ] Run `npm test` and `npm run build`; fix only failures caused by this feature.
- [ ] Verify `/product-master` and `/sku-master/import` return HTTP 200 locally.
- [ ] Commit the final implementation and inspect `git diff main..HEAD` for accidental deletions.
- [ ] Push/merge the feature branch into the configured deployment branch only after local checks pass, then verify the Vercel production deployment and cloud page match the local commit.
