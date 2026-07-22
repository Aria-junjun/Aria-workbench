# Library Usability Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current local workbench reliable for daily use by adding edit, delete, practical filtering, and local backup/import.

**Architecture:** Keep the app local-first and browser-storage based. Add small reusable local-store operations first, then use them in list/detail pages without introducing cloud sync or authentication.

**Tech Stack:** Next.js App Router, React client components, TypeScript, browser `localStorage`, Vitest.

## Global Constraints

- Do not connect Supabase in this stage.
- Do not add paid AI/API dependencies.
- Preserve current local data shape so future Web migration remains straightforward.
- Keep UI simple and usable for non-technical daily operation.
- Add export/import backup because local browser storage can be lost.

---

### Task 1: Local Store Operations

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/domain/local-store.test.ts`

**Interfaces:**
- Produces: `deleteLocalItem(collection, id)`, `updateLocalItem(collection, id, patch)`, `exportLocalWorkbenchData()`, `importLocalWorkbenchData(jsonText)`.
- Consumes: existing `loadLocalWorkbenchData()` and `saveLocalWorkbenchData()`.

- [ ] Write tests for delete, update, export, and import.
- [ ] Add typed local-store helpers with basic validation.
- [ ] Run `npm test`.
- [ ] Commit as `feat: add local workbench data operations`.

### Task 2: Backup Page

**Files:**
- Create: `src/app/settings/page.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `exportLocalWorkbenchData()` and `importLocalWorkbenchData(jsonText)`.

- [ ] Add a settings entry in the sidebar.
- [ ] Add export button that downloads a JSON backup.
- [ ] Add import file picker that replaces local data after explicit confirmation.
- [ ] Show clear success/error messages.
- [ ] Run `npm run build`.
- [ ] Commit as `feat: add local data backup and restore`.

### Task 3: Edit And Delete Details

**Files:**
- Create: `src/components/workbench/edit-fields.tsx`
- Modify: `src/app/suppliers/[supplierId]/page.tsx`
- Modify: `src/app/offers/[offerId]/page.tsx`
- Modify: `src/app/products/[productId]/page.tsx`
- Modify: `src/app/knowledge/[cardId]/page.tsx`

**Interfaces:**
- Consumes: `updateLocalItem()` and `deleteLocalItem()`.

- [ ] Add edit mode on each detail page.
- [ ] Support text fields and newline-separated list fields.
- [ ] Add delete button with confirmation.
- [ ] After delete, return to the relevant list page.
- [ ] Keep all display text Chinese and readable.
- [ ] Run `npm test` and `npm run build`.
- [ ] Commit as `feat: edit and delete workbench records`.

### Task 4: Practical Filters

**Files:**
- Create: `src/components/workbench/library-toolbar.tsx`
- Modify: `src/app/suppliers/page.tsx`
- Modify: `src/app/offers/page.tsx`
- Modify: `src/app/products/page.tsx`
- Modify: `src/app/knowledge/page.tsx`

**Interfaces:**
- Consumes: existing `includesQuery()` and `sortPinnedFirst()`.

- [ ] Add “全部 / 仅置顶” filter to each library.
- [ ] Add simple tag/category chips where data exists.
- [ ] Preserve multi-column card layout.
- [ ] Fix garbled Chinese copy in touched pages.
- [ ] Run `npm test` and `npm run build`.
- [ ] Commit as `feat: improve library search and filters`.

### Task 5: Verification

**Files:**
- No new files.

- [ ] Restart local dev server.
- [ ] Open `/suppliers`, `/offers`, `/products`, `/knowledge`, and `/settings`.
- [ ] Verify export/import, edit, delete, pin, search, and filter interactions.
- [ ] Commit any final polish as `fix: polish library usability`.

## Self-Review

- Spec coverage: Covers edit, delete, search/filter, backup/import, and keeps local-first scope.
- Placeholder scan: No TBD/TODO placeholders.
- Type consistency: Collection names match existing local-store keys.
