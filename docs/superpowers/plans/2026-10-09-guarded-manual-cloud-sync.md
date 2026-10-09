# Guarded Manual Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current local workbench's business data manually back up to Supabase without stale-snapshot overwrite, then prepare the current local UI for verified cloud release.

**Architecture:** The browser keeps the editable local snapshot and an explicit pending-backup state. A manual preflight reads the cloud row with its revision, previews record differences, and submits an optimistic-concurrency write; a readback validates the result. The service rejects versionless full-snapshot writes. Automatic mode remains behind a disabled-by-default switch and uses the same guarded path.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest, Supabase PostgREST, Vercel.

## Global Constraints

- Preserve all existing user records and uncommitted source changes. Work in the present local checkout because the desired UI exists as uncommitted code here.
- `manual` is the default mode; no interval or focus-triggered cloud writes. Future `auto` may only call the guarded path.
- Missing data is not zero. Do not manufacture Jushuitan order facts, ERP integration, or director approvals.
- Before publishing, preserve the latest business JSON and compare cloud record IDs and representative values. Never label an unverified write as synced.
- Release must not proceed while full tests, typecheck or production build fail; current failures are baseline release blockers to diagnose separately.

---

### Task 1: Guard the server snapshot contract

**Files:**
- Modify: `src/app/api/supabase-proxy/route.ts`
- Test: `tests/domain/supplier-lifecycle-sync.test.ts`
- Test: `tests/domain/manual-sync-proxy.test.ts`

**Interfaces:**
- GET `action=latest` produces `[{id, updated_at, data}]`.
- POST `action=upsert` consumes `{data, expectedUpdatedAt}` and returns `409` for missing or stale revision.

- [ ] **Step 1: Write failing tests** for a latest response exposing `updated_at`, a missing revision returning `409` with no PATCH, a stale revision returning `409`, and a current revision updating exactly one row.

```ts
expect(latest[0]).toMatchObject({ id: 'snapshot-1', updated_at: revision });
expect((await POST(versionlessRequest)).status).toBe(409);
expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('id=eq.snapshot-1'), expect.objectContaining({ method: 'PATCH' }));
expect((await POST(staleRequest)).status).toBe(409);
expect((await POST(currentRequest)).status).toBe(200);
```

Run: `npx vitest run tests/domain/manual-sync-proxy.test.ts tests/domain/supplier-lifecycle-sync.test.ts`
Expected: the new versionless/stale cases fail for the present unguarded API.

- [ ] **Step 2: Implement conditional update.** The server requires a string `expectedUpdatedAt`, compares it with the fetched row, uses it in the PATCH filter, and treats a zero-row PATCH as a conflict. Reject legacy `insert` and `update` actions on `workbench_data` unless their callers are migrated to the same guard; existing repository search found no callers.

```ts
if (!body.expectedUpdatedAt || body.expectedUpdatedAt !== latestJson[0]?.updated_at)
  return NextResponse.json({ ok: false, data: { error: 'snapshot_changed' } }, { status: 409 });
const revisionGuard = `&updated_at=eq.${encodeURIComponent(body.expectedUpdatedAt)}`;
```

- [ ] **Step 3: Run the two targeted suites.** Expected: all target tests pass and no test can issue an unconditional full-snapshot write.

### Task 2: Separate local saves from cloud backup

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Create: `src/features/workbench/manual-cloud-sync.ts`
- Test: `tests/domain/local-store.test.ts`
- Test: `tests/domain/manual-cloud-sync.test.ts`

**Interfaces:**
- `getSyncMode(): 'manual' | 'auto'` defaults to `manual`.
- `prepareCloudBackup(local): Promise<BackupPreview>` returns remote revision, local revision, collection differences and a safe-to-upload decision.
- `commitCloudBackup(preview): Promise<VerifiedBackup>` compares local revision again, conditionally uploads, then rereads and verifies normalized content.

- [ ] **Step 1: Write failing tests** showing that ordinary local save sets pending state but does not call fetch in manual mode; first-time equivalent snapshots establish a base; a changed cloud revision or changed local preview returns conflict; a network failure leaves local data and pending state intact.

```ts
saveLocalWorkbenchData(edited);
expect(localStorage.getItem('personal-commercial-workbench:pending-sync')).toBeTruthy();
expect(fetchMock).not.toHaveBeenCalled();
expect(await commitCloudBackup(stalePreview)).toMatchObject({ status: 'conflict' });
```

Run: `npx vitest run tests/domain/manual-cloud-sync.test.ts tests/domain/local-store.test.ts`
Expected: the no-automatic-write test fails against current `saveLocalWorkbenchData`.

- [ ] **Step 2: Implement a small sync service** with normalized stable-ID comparison, persisted cloud base revision/hash, local revision captured at preflight, and a guarded POST carrying `expectedUpdatedAt`. Do not clear pending until readback IDs and normalized content match.

```ts
if (getSyncMode() === 'auto') void backupPendingLocalDataThroughGuardedPath();
// Manual mode deliberately does not call saveWorkbenchData from an ordinary local save.
```

- [ ] **Step 3: Re-run the targeted suites.** Expected: manual save is local only; conflict/readback failure preserves the pending marker; success stores the verified cloud revision and time.

### Task 3: Present manual backup and safe restore

**Files:**
- Modify: `src/components/data-sync-loader.tsx`
- Modify: `src/app/settings/page.tsx`
- Test: `tests/ui/data-sync-loader.test.tsx`
- Test: `tests/ui/manual-cloud-sync.test.tsx`

**Interfaces:**
- Header badge displays local-only, pending, verified, conflict or connection-error state and verification time.
- Settings exposes `备份到云端` and separately `从云端恢复`.

- [ ] **Step 1: Write failing UI tests** for no mount/focus/interval fetch in manual mode; clicking backup first displays collection differences and needs confirmation; conflict shows no success; restore downloads local JSON before a second confirmation.

```tsx
render(<DataSyncLoader />);
expect(fetchMock).not.toHaveBeenCalled();
fireEvent.click(screen.getByRole('button', { name: '备份到云端' }));
expect(await screen.findByText(/云端差异/)).toBeInTheDocument();
```

Run: `npx vitest run tests/ui/data-sync-loader.test.tsx tests/ui/manual-cloud-sync.test.tsx`
Expected: the current loader performs a mount sync and fails the first assertion.

- [ ] **Step 2: Implement manual controls.** The button first runs preflight, displays added/changed/deleted counts, and only on explicit confirmation calls the guarded upload. The restore control exports the current browser JSON before applying cloud data and refuses an unconfirmed pending-local overwrite. Keep the `auto` branch wired to the guarded service but disabled by default.
- [ ] **Step 3: Re-run target tests.** Expected: no automatic network operation in manual mode and no false `已同步云端` state.

### Task 4: Release verification and cloud handoff

**Files:**
- Modify only release-blocking tests or source proven defective by diagnosis; keep unrelated user changes untouched.
- Review: `AGENTS.md`, `src/components/app-shell.tsx`, all files staged for the release, and the backed-up business JSON.

- [ ] **Step 1: Run `npx tsc --noEmit` and `npm test`.** Diagnose each baseline failure; correct stale assertions only when current behavior matches approved product rules, and fix actual defects with failing regression tests first.
- [ ] **Step 2: Run a production build without deleting the running dev build.** Expected: successful build with no type errors. If a separate build output path is needed, configure it without destructive cleanup.
- [ ] **Step 3: Review release diff and deployment branch.** Include the current local navigation and required pages intentionally; do not blindly stage all 194 preexisting changed/untracked paths. Preserve the local backup and identify rollback commit before any push.
- [ ] **Step 4: Publish only after all gates pass.** Verify the Vercel page shows the local navigation, GET can still read the pre-release cloud IDs, no automatic write occurs on load, a controlled manual backup returns a new cloud revision, and readback matches the browser snapshot. If any gate fails, stop and report the exact blocker; do not claim cloud sync completed.
- [ ] **Step 5: Treat RLS separately.** Inspect `public.workbench_data` policies and the authenticated server route; plan denial of anonymous direct access without disrupting the service-role route. Do not apply unreviewed SQL as part of this code release.
