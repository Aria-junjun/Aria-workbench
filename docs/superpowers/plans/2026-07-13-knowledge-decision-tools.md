# Knowledge Decision Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace passive commercial knowledge cards with a personal bookshelf, callable decision tools, and lightweight application records.

**Architecture:** Extend the existing localStorage data model without removing legacy knowledge cards. Parse a strict text-based book package locally, store books and tools separately, and match real questions to tools using deterministic keyword scoring before any future AI call.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, browser localStorage.

## Global Constraints

- Existing local data and backups must continue to load.
- UI copy is Chinese.
- The MVP must work without an API key.
- One pasted book package imports one book and multiple tools in a single confirmation.
- Existing cards are shown under a virtual legacy shelf and remain editable through their current detail pages.

---

### Task 1: Book Package Domain

**Files:**
- Create: `src/features/workbench/knowledge-library.ts`
- Create: `tests/domain/knowledge-library.test.ts`

**Interfaces:**
- Produces: `parseBookPackage(text)`, `matchDecisionTools(question, tools)`, `legacyCardToDecisionTool(card)`.

- [ ] Write failing tests for parsing repeated decision tools, rejecting incomplete packages, legacy conversion, and deterministic matching.
- [ ] Run `npm test -- tests/domain/knowledge-library.test.ts` and confirm missing-module failure.
- [ ] Implement the parser and matcher with no network dependency.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Compatible Local Storage

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Modify: `tests/domain/local-store.test.ts`

**Interfaces:**
- Produces: `LocalKnowledgeBook`, `LocalDecisionTool`, `LocalKnowledgeApplication`, `saveBookPackage`, `createTaskFromKnowledgeAction`.

- [ ] Write failing tests showing old backups normalize to empty new collections and imported books/tools persist together.
- [ ] Run the focused local-store tests and confirm expected failures.
- [ ] Add new optional-compatible collections and save helpers.
- [ ] Re-run focused tests and confirm they pass.

### Task 3: Knowledge Home and Import

**Files:**
- Modify: `src/app/knowledge/page.tsx`
- Create: `src/app/knowledge/import/page.tsx`

**Interfaces:**
- Consumes: domain parser/matcher and local store helpers.
- Produces: problem-solving view, bookshelf view, and batch import review.

- [ ] Build the two-tab knowledge home with local matching and legacy shelf.
- [ ] Build book-package paste, parse, editable review, and single-click save.
- [ ] Ensure empty and invalid input states are explicit.

### Task 4: Book and Tool Use

**Files:**
- Create: `src/app/knowledge/books/[bookId]/page.tsx`
- Create: `src/app/knowledge/tools/[toolId]/page.tsx`

**Interfaces:**
- Consumes: stored books, tools, applications, and task creation helper.
- Produces: book detail, diagnostic tool detail, action-to-task workflow, and application history.

- [ ] Add book overview and expandable tool list.
- [ ] Add tool diagnosis inputs and action selection.
- [ ] Save an application record and optionally create a task.

### Task 5: Verification

**Files:**
- Verify all files above.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start or reuse the dev server and verify import, bookshelf, matching, and task creation in the browser.
- [ ] Review the final diff and report any remaining limitations.
