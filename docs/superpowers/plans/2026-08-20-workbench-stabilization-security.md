# Workbench Stabilization and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a reproducible build/test baseline and replace the client-only access gate with a minimal server-validated single-user session without changing business data shape.

**Architecture:** Keep the existing Next.js App Router and localStorage/Supabase data model. First restore dependencies and align tests with current schemas. Then add a server login route with an HttpOnly signed session cookie, protect server API routes, and remove public fallback credentials; defer full Supabase Auth/RLS multi-user migration to a separate project.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Supabase JS, Web Crypto API.

**Execution status:** Completed on 2026-08-20. `npm run build`, `npx tsc --noEmit`, and the full suite (`38` files / `248` tests) passed. No deployment or push was performed.

## Global Constraints

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Do not add a database migration in this stabilization pass.
- Preserve existing localStorage keys and backup formats.
- Do not deploy or push without an explicit later request.
- Every behavior change must have a failing test before implementation.

### Task 1: Restore and verify dependency installation

**Files:**
- Modify: `package-lock.json` only if npm reports a lock mismatch.
- Test: `package.json` scripts and installed dependency tree.

- [ ] **Step 1: Remove only the incomplete local dependency directory**

Verify the target is exactly `Aria-workbench-main/node_modules`, then remove that directory and keep all source files intact.

- [ ] **Step 2: Install from the committed lockfile**

Run `npm ci` from the project root and require a successful exit.

- [ ] **Step 3: Verify build and test executables exist**

Run `Test-Path node_modules/.bin/next` and `Test-Path node_modules/.bin/vitest`; both must be `True`.

- [ ] **Step 4: Commit dependency-only changes if any**

Run `git diff -- package-lock.json` and commit only if the lockfile changed unexpectedly after review.

### Task 2: Align legacy test fixtures with current schemas

**Files:**
- Modify: `tests/domain/confirm-draft.test.ts`
- Modify: `tests/domain/local-store.test.ts`
- Modify: `tests/domain/supplier-evaluation.test.ts`

**Interfaces:** Existing production schemas remain the source of truth. Test fixtures must include `businessModel` where `SupplierDraft` requires it, `ignored` where order/service records require it, and `businessModel` on evaluation records.

- [ ] **Step 1: Add a failing regression assertion for normalized defaults**

Extend the existing local-store normalization test to assert that an old supplier receives `businessModel: "inbound"` and an old order receives `ignored: false`.

- [ ] **Step 2: Run the focused test and confirm the failure is fixture/schema mismatch**

Run `npx vitest run tests/domain/local-store.test.ts -t "businessModel|ignored"`.

- [ ] **Step 3: Update only test fixtures**

Add the required fields to inline fixtures without weakening production schemas or changing production defaults.

- [ ] **Step 4: Run focused domain tests**

Run supplier evaluation, supplier chat parser, local-store, and confirm-draft tests. Record any unrelated historical failures separately.

### Task 3: Restore build and type-check baseline

**Files:**
- Modify: only files required by compiler errors after Tasks 1-2.
- Test: existing Vitest and TypeScript configuration.

- [ ] **Step 1: Run `npx tsc --noEmit` and classify every remaining error**

No error may be dismissed without identifying its file and cause.

- [ ] **Step 2: Run `npm run build`**

Build must complete without missing-module errors from `react-markdown` or other lockfile dependencies.

- [ ] **Step 3: Run the complete test suite**

Run `npm test` and retain the exact failing test names if historical failures remain.

- [ ] **Step 4: Commit the stabilization fixes**

Commit source/test changes with `fix: restore workbench build and type consistency`.

### Task 4: Define server session behavior with failing tests

**Files:**
- Create: `src/features/auth/session.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Modify: `tests/domain/auth-session.test.ts`

**Interfaces:**
- `createSessionToken(secret: string, subject: string, now?: number): Promise<string>`
- `verifySessionToken(token: string, secret: string, now?: number): Promise<boolean>`
- Login accepts `{ password: string }`, returns `401` for mismatch, and sets an HttpOnly cookie for success.

- [ ] **Step 1: Write tests for token expiry, tampering, and password mismatch**

Tests must assert that a valid token verifies, a changed payload/signature fails, expired tokens fail, and login rejects a wrong password without setting a cookie.

- [ ] **Step 2: Run the tests and verify they fail because the session module/routes do not exist**

Run `npx vitest run tests/domain/auth-session.test.ts`.

- [ ] **Step 3: Implement signed tokens with Web Crypto HMAC-SHA256**

Use a server-only secret from `WORKBENCH_SESSION_SECRET`; never provide a fallback secret in production code.

- [ ] **Step 4: Implement login/logout routes**

Read `WORKBENCH_PASSWORD` only on the server, set an HttpOnly, SameSite=Lax, Secure-in-production cookie, and clear it on logout.

- [ ] **Step 5: Run auth tests and verify they pass**

Do not proceed if token tampering or wrong-password cases pass incorrectly.

### Task 5: Integrate the session with the existing UI and API boundary

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/auth-guard.tsx`
- Modify: `src/app/api/supabase-proxy/route.ts`
- Modify: `src/app/api/debug/sync/route.ts`
- Modify: `src/app/api/config/status/route.ts`
- Modify: `tests/domain/auth-session.test.ts`

- [ ] **Step 1: Add failing tests for protected API access and login UI contract**

Unauthenticated requests must receive `401`; authenticated requests may continue to the existing handler. The login page must call the server route rather than comparing a password in browser code.

- [ ] **Step 2: Implement server-side guards**

Create a shared `requireWorkbenchSession()` helper and call it before any data/debug response. Preserve existing response shapes for authenticated requests.

- [ ] **Step 3: Replace client password comparison**

Submit the password to `/api/auth/login`; after success, redirect to the original path. Use `/api/auth/logout` when signing out.

- [ ] **Step 4: Remove the hard-coded password and Supabase fallback credentials**

Missing environment variables must produce a clear configuration error or local-only fallback without embedding credentials in source.

- [ ] **Step 5: Run focused auth/API tests and build**

Verify `401` behavior, successful login, logout cookie clearing, type-check, and production build.

### Task 6: Final verification and handoff

**Files:**
- Modify: `.env.example` if the repository does not already document required server variables.
- Modify: `docs/superpowers/plans/2026-08-20-workbench-stabilization-security.md` to mark completed steps.

- [ ] **Step 1: Run all tests**

Run `npm test` and record exact pass/fail totals.

- [ ] **Step 2: Run type-check and production build**

Both must exit successfully before claiming completion.

- [ ] **Step 3: Review sensitive-string scan**

Search source for hard-coded passwords, service-role keys, and fallback secrets. No production credential may remain.

- [ ] **Step 4: Report deployment prerequisites**

List `WORKBENCH_PASSWORD`, `WORKBENCH_SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as Vercel environment variables, without requesting or displaying their values.
