# Import batch deletion report

## Status

DONE

## Scope

- Permanent user-operated action for every distinct `platform + periodStart + periodEnd` import batch.
- No batch is hardcoded and no cleanup is executed automatically.

## Implementation

- Added pure batch listing, preview, and apply functions in `src/features/workbench/scoped-dropship-cleanup.ts`.
- Removes only matching dropship period records, pending dropship suppliers, and product periods.
- Removes alias and product routing mappings only when the scoped removal leaves no period reference.
- Preserves supplier masters and every non-dropship business record.
- Added a permanent batch-management table to the dropship period ledger, with one delete action per distinct batch.
- The dialog shows exact counts, downloads the full current snapshot as JSON, requires an explicit checkbox, saves once atomically, and displays success.

## TDD evidence

- RED: focused tests failed because the cleanup module and visible action did not exist.
- GREEN: focused domain and UI tests passed after the minimal implementation.
- Tests cover exact matching, preservation, orphan mapping cleanup, no automatic deletion, explicit confirmation, and one atomic save call.

## Concerns

- Historical mappings do not carry an import batch ID. Following review, deletion now always retains all supplier alias and product routing mappings; preview states this explicitly.
- Existing Vite CJS and test-only Supabase proxy warnings are unrelated and non-blocking.

## Review fixes

- Mapping safety: `supplierAliasMappings` and `dropshipProductRoutings` are never deleted because current schema cannot prove batch ownership.
- Snapshot consistency: opening the preview captures one immutable full snapshot and serialized revision. Preview and backup use that capture. Confirmation compares persisted data against the captured revision immediately before deletion; any difference aborts without saving and requires reopening the preview.
- Added domain coverage for retained mappings and UI coverage for retained-mapping disclosure plus stale-preview abort.
