# Quote Comparison Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user select offers and generate a standardized quote comparison table that can be copied.

**Architecture:** Add a small pure table-row formatter, selection state in the offer library, and a `/quotes` client page that renders selected offers from localStorage.

**Tech Stack:** Next.js App Router, React client components, TypeScript, browser localStorage, Vitest.

## Global Constraints

- Keep the feature local-first.
- Do not add paid APIs or cloud sync.
- Do not implement Excel export in this MVP.
- Use existing offer fields only.

---

### Task 1: Quote Table Formatter

**Files:**
- Create: `src/features/workbench/quote-table.ts`
- Test: `tests/domain/quote-table.test.ts`

**Interfaces:**
- Produces: `quoteTableHeaders`, `buildQuoteRows(offers)`, `buildQuoteClipboardText(rows)`.
- Consumes: `LocalOffer`.

- [ ] Write a test for row formatting with missing fields.
- [ ] Write the formatter.
- [ ] Run `npm test -- tests/domain/quote-table.test.ts`.
- [ ] Commit as `feat: add quote table formatter`.

### Task 2: Offer Selection

**Files:**
- Modify: `src/app/offers/page.tsx`

- [ ] Add selected offer ids state.
- [ ] Add checkbox per offer card.
- [ ] Add `生成对比表` button when one or more offers are selected.
- [ ] Navigate to `/quotes?offerIds=<ids>`.
- [ ] Preserve pin/search/filter behavior.

### Task 3: Quote Page

**Files:**
- Create: `src/app/quotes/page.tsx`

- [ ] Read `offerIds` from URL.
- [ ] Load local offers and filter selected ids.
- [ ] Render standardized table.
- [ ] Add `复制表格` button using tab-separated clipboard text.
- [ ] Show an empty state if no matching offers exist.
- [ ] Run `npm test` and `npm run build`.
- [ ] Commit as `feat: generate quote comparison table`.

## Self-Review

- Scope is limited to selectable offer comparison and copyable table.
- No placeholders.
- Formatter interfaces are defined before UI tasks consume them.
