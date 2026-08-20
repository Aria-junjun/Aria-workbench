# Direct File Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to upload `.xlsx`, `.csv`, or `.txt` files on the quick intake page and send the extracted content through the existing review-and-save flow.

**Architecture:** Add one server-side file-to-text utility, one multipart upload API route, and one focused UI entry on `/intake`. Keep the existing extraction, review, and local storage flow unchanged.

**Tech Stack:** Next.js route handlers, React client UI, Vitest, `xlsx` for local Excel parsing.

## Global Constraints

- No paid API dependency for file parsing.
- Do not store uploaded source files in the app; only extracted text enters the existing draft flow.
- Keep support limited to `.xlsx`, `.csv`, and `.txt` for this MVP.
- Reuse the current review page before入库.

---

### Task 1: File-To-Text Utility

**Files:**
- Create: `src/features/workbench/file-text.ts`
- Test: `tests/domain/file-text.test.ts`

**Interfaces:**
- Produces: `extractWorkbenchFileText(input: { fileName: string; mimeType?: string; buffer: Buffer }): string`

- [ ] Write tests for `.txt`, `.csv`, and `.xlsx`.
- [ ] Verify tests fail before implementation.
- [ ] Implement minimal extraction.
- [ ] Verify tests pass.

### Task 2: Upload API

**Files:**
- Create: `src/app/api/intake/file/route.ts`

**Interfaces:**
- Consumes: `extractWorkbenchFileText`
- Produces: JSON `{ draftId, storage, extraction, extractedText }`

- [ ] Accept multipart `file`.
- [ ] Reject missing/unsupported files with a clear 400 response.
- [ ] Call existing `extractWorkbenchDraft`.

### Task 3: Intake UI

**Files:**
- Modify: `src/app/intake/page.tsx`

**Interfaces:**
- Consumes: `/api/intake/file`

- [ ] Add direct file import box.
- [ ] Accept `.xlsx,.csv,.txt`.
- [ ] Upload selected file and route to `/review/[draftId]`.
- [ ] Show simple error/loading states.

### Task 4: Verification

- [ ] Run targeted file extraction tests.
- [ ] Run full test suite.
- [ ] Run production build.
- [ ] Restart local dev server.
