# Knowledge Import Integrity Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect and safely recover knowledge items lost between a stored ChatGPT book package and the current decision-tool records.

**Architecture:** Extend the pure book-package parser to support multiline numbered and bulleted fields, then add a pure audit function that compares reparsed tools with stored tools. A local-store repair function performs additive merges while preserving IDs and history. The book detail page exposes preview-first audit and explicit confirmation.

**Tech Stack:** Next.js 15, React 19, TypeScript, localStorage, Vitest.

## Global Constraints

- Never invent content absent from the stored raw book package.
- Never overwrite non-empty scalar fields or delete current list items/tools.
- Preserve existing tool IDs, timestamps, book links, tasks, and application history.
- Require explicit confirmation before applying recoverable additions.
- Treat fewer than two diagnostic questions or fewer than two actions as a source-sufficiency warning, not proof of poor knowledge quality.

---

### Task 1: Multiline book-package parsing

**Files:**
- Modify: `src/features/workbench/knowledge-library.ts`
- Modify: `tests/domain/knowledge-library.test.ts`

**Interfaces:**
- Keeps: `parseBookPackage(text: string): ParsedBookPackage`
- Adds support for field content continuing until the next known field label.

- [ ] Add a failing test with numbered, hyphen, and bullet lines under triggers, diagnostic questions, actions, and limitations.
- [ ] Run `npm.cmd test -- tests/domain/knowledge-library.test.ts` and verify the new test fails because only same-line content is captured.
- [ ] Implement known-field block extraction and strip list prefixes such as `1.`, `1、`, `-`, `*`, and `•`.
- [ ] Re-run the focused test and verify both legacy single-line and new multiline formats pass.

### Task 2: Pure integrity audit

**Files:**
- Modify: `src/features/workbench/knowledge-library.ts`
- Modify: `tests/domain/knowledge-library.test.ts`

**Interfaces:**
- Produces: `auditKnowledgeBookImport(rawText: string, currentTools: AuditableDecisionTool[]): KnowledgeBookAudit`
- Produces audit statuses: `recoverable`, `identical`, or `source_insufficient`.

- [ ] Add failing tests for recoverable list additions, one new raw-package tool, identical content, and source-insufficient content.
- [ ] Run the focused test and verify failure because the audit API does not exist.
- [ ] Implement name-based matching, normalized de-duplication, scalar fill detection, per-field counts, and source-sufficiency warnings.
- [ ] Re-run the focused test and verify all audit scenarios pass.

### Task 3: Additive repair persistence

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Modify: `tests/domain/local-store.test.ts`

**Interfaces:**
- Produces: `repairKnowledgeBookFromRawText(bookId: string): { updatedTools: number; addedTools: number }`
- Consumes: `parseBookPackage(book.rawText)`.

- [ ] Add a failing persistence test proving repair preserves an existing tool ID and manual action, adds missing parsed items and a new tool, and leaves application history unchanged.
- [ ] Run `npm.cmd test -- tests/domain/local-store.test.ts` and verify failure because the repair API does not exist.
- [ ] Implement additive merges for arrays and empty-only fills for scalar fields; append raw-only tools with new IDs; never remove records.
- [ ] Re-run the focused persistence test and verify pass.

### Task 4: Book-detail audit workflow

**Files:**
- Modify: `src/app/knowledge/books/[bookId]/page.tsx`

**Interfaces:**
- Consumes: `auditKnowledgeBookImport(book.rawText, tools)`.
- Consumes: `repairKnowledgeBookFromRawText(book.id)` after user confirmation.

- [ ] Add a “检查导入完整性” button when `rawText` exists.
- [ ] Render audit status, current/reparsed tool counts, per-tool list counts, recoverable additions, new tools, and source-sufficiency warnings.
- [ ] Add “确认补充遗漏内容” only for recoverable results; after repair reload local data and rerun the audit.
- [ ] Show a concise error when raw text cannot be parsed and do not mutate data.

### Task 5: Verification

**Files:**
- Verify the files above without unrelated changes.

- [ ] Run `npm.cmd test` and require zero failures.
- [ ] Run `npm.cmd run build` and require compilation, type checking, and page generation to pass.
- [ ] Restart the local dev server after build.
- [ ] In the browser, open 《竞争战略》, run the audit, confirm the result is visible, and do not apply repair unless recoverable additions are shown and the user explicitly confirms.
