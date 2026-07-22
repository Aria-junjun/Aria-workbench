# Action Dashboard Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static homepage counters with an actionable dashboard showing open tasks, pinned work, recent records, and concise quick links.

**Architecture:** Add a pure dashboard view-model helper that consumes the existing local workbench data and returns sorted display records. Keep the homepage as a presentation layer only; do not add a second data store or change existing library schemas.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, existing local workbench types and localStorage helpers.

## Global Constraints

- Keep the homepage focused on actions, not inventory statistics.
- Reuse existing `pinned`, `createdAt`, and task `status` fields.
- Do not change supplier, offer, product, knowledge-card, or task detail pages.
- Do not add an independent homepage data cache.
- Show concise summaries and omit empty fields.

### Task 1: Dashboard View Model

**Files:**
- Create: `src/features/workbench/dashboard.ts`
- Test: `tests/domain/dashboard.test.ts`

**Interfaces:**
- Consumes: `LocalWorkbenchData`.
- Produces: `getDashboardView(data)` with `openTasks`, `pinnedItems`, and `recentItems`.

- [ ] Write tests for priority sorting, pinned aggregation, and recent cross-module sorting.
- [ ] Run the focused test and confirm it fails because the helper does not exist.
- [ ] Implement the smallest pure helper using existing fields and stable detail URLs.
- [ ] Run the focused test and the full test suite.

### Task 2: Action Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `loadLocalWorkbenchData()` and `getDashboardView()`.
- Produces: actionable homepage sections with links to existing pages.

- [ ] Replace static zero counters with open tasks, pinned work, recent records, and quick links.
- [ ] Add empty states with a next action instead of showing zero-only cards.
- [ ] Run the full test suite and production build.
- [ ] Verify the homepage in the local browser at `/`.

### Task 3: Review

**Files:**
- Modify: none unless verification finds a defect.

- [ ] Check `git diff --check`.
- [ ] Confirm existing navigation and local data APIs are unchanged.
- [ ] Commit the implementation with a focused message.
