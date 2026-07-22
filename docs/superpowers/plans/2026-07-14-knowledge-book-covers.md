# Knowledge Book Covers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow imported and existing knowledge books to store a compressed local cover and display it consistently on the bookshelf and book detail page.

**Architecture:** Add an optional `coverImage` Data URL to the existing book model. A focused browser utility validates and compresses one image, while a reusable client component owns upload, preview, replacement, removal, and Chinese errors. Existing local-store normalization keeps older books valid and leaves future replacement with an object-storage URL possible.

**Tech Stack:** Next.js 15, React 19, TypeScript, browser Canvas API, Tailwind CSS, Vitest.

## Global Constraints

- Accept only JPG, PNG, and WebP images up to 10 MB.
- Scale images proportionally so the longest edge is no more than 720 px.
- Store a compressed WebP Data URL; do not store the original image.
- Existing books without a cover must continue to load and show a placeholder.
- Do not add network cover search, automatic cropping, third-party upload, or new dependencies.

---

### Task 1: Cover image processing

**Files:**
- Create: `src/features/workbench/knowledge-cover.ts`
- Create: `tests/domain/knowledge-cover.test.ts`

**Interfaces:**
- Produces: `validateKnowledgeCover(input: { type: string; size: number }): string | undefined`
- Produces: `fitKnowledgeCoverDimensions(width: number, height: number): { width: number; height: number }`
- Produces: `compressKnowledgeCover(file: File): Promise<string>`

- [ ] **Step 1: Write failing validation and sizing tests**

Test accepted MIME types, rejection of PDF and files above 10 MB, landscape scaling from 1440x960 to 720x480, portrait scaling from 800x1200 to 480x720, and no enlargement of a 300x450 image.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm.cmd test -- tests/domain/knowledge-cover.test.ts`

Expected: FAIL because `knowledge-cover.ts` does not exist.

- [ ] **Step 3: Implement validation, dimension calculation, and Canvas compression**

Use constants `MAX_FILE_BYTES = 10 * 1024 * 1024`, `MAX_EDGE = 720`, accepted MIME types `image/jpeg`, `image/png`, and `image/webp`. Load through `URL.createObjectURL`, draw to Canvas, emit WebP, and revoke the object URL in `finally`. Try decreasing WebP quality/scale when the encoded Data URL remains unusually large, and throw Chinese error messages for validation, decoding, or Canvas failures.

- [ ] **Step 4: Run the focused test and verify pass**

Run: `npm.cmd test -- tests/domain/knowledge-cover.test.ts`

Expected: all cover utility tests PASS.

---

### Task 2: Book model and local persistence

**Files:**
- Modify: `src/features/workbench/knowledge-library.ts`
- Modify: `src/features/workbench/local-store.ts`
- Modify: `tests/domain/local-store.test.ts`

**Interfaces:**
- Extends: `KnowledgeBookDraft.coverImage?: string`
- Extends: `LocalKnowledgeBook.coverImage?: string`
- Consumes: existing `saveBookPackage(parsed)` and `updateLocalItem("knowledgeBooks", id, patch)`

- [ ] **Step 1: Add failing persistence tests**

Set `parsed.book.coverImage` to a WebP Data URL before `saveBookPackage`, assert it remains after save/reload, assert `updateLocalItem` can replace and remove the value, and assert legacy book records without the field still normalize successfully.

- [ ] **Step 2: Run the focused persistence test and verify failure**

Run: `npm.cmd test -- tests/domain/local-store.test.ts`

Expected: FAIL because the book types do not expose `coverImage`.

- [ ] **Step 3: Extend types and normalization**

Add the optional field to both book types. Preserve only string values during normalization; map invalid values to `undefined`. Continue relying on the existing spread in `saveBookPackage` so the cover is saved with the book and included in JSON backups.

- [ ] **Step 4: Run the focused persistence test and verify pass**

Run: `npm.cmd test -- tests/domain/local-store.test.ts`

Expected: all local-store tests PASS.

---

### Task 3: Upload editor and bookshelf presentation

**Files:**
- Create: `src/features/workbench/book-cover-editor.tsx`
- Modify: `src/app/knowledge/import/page.tsx`
- Modify: `src/app/knowledge/page.tsx`
- Modify: `src/app/knowledge/books/[bookId]/page.tsx`

**Interfaces:**
- Consumes: `compressKnowledgeCover(file)`
- Produces: `BookCoverEditor({ title, value, onChange })`
- Persists existing-book edits with `updateLocalItem("knowledgeBooks", book.id, { coverImage })`

- [ ] **Step 1: Build the reusable editor**

Render a stable 2:3 preview, a native file input restricted by `accept="image/jpeg,image/png,image/webp"`, replace/remove controls, loading state, and concise Chinese errors. Pass the compressed Data URL through `onChange` and pass `undefined` when deleting.

- [ ] **Step 2: Add cover selection to book import**

Place `BookCoverEditor` in the parsed book-information section. Update `parsed.book.coverImage` before `saveBookPackage` runs, leaving the ChatGPT text package format unchanged.

- [ ] **Step 3: Add cover editing to existing book details**

Place the editor beside the book title. On change, call `updateLocalItem`, reload client data, and keep book deletion behavior unchanged.

- [ ] **Step 4: Display covers on the bookshelf**

Render each book card with a fixed 2:3 cover area, `object-cover`, meaningful alt text, and a neutral “暂无封面” placeholder. Keep title, author, purpose, tool count, and usage count visible without overlap at mobile and desktop widths.

- [ ] **Step 5: Run full automated verification**

Run: `npm.cmd test`

Expected: all test files PASS.

Run: `npm.cmd run build`

Expected: Next.js compilation, type checking, and static page generation PASS.

- [ ] **Step 6: Verify the user flow in the local browser**

Open `/knowledge`, confirm the existing book has a placeholder, open its detail page, upload a cover, return to the bookshelf and confirm the cover persists after reload. Replace and remove the cover once, then restore the chosen cover. Verify the import page also previews a selected cover before save.
