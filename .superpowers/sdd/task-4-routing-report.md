# Task 4 Supplier cooperation-mode presentation

## RED evidence

- Command: `npm test -- --run tests/ui/supplier-business.test.tsx tests/ui/supplier-profile-workspace.test.tsx`
- Result: 2 failed, 10 passed.
- Expected failures:
  - `deriveSupplierBusinessModes is not a function`.
  - inbound fulfillment could not be presented separately from dropship facts.
- Additional RED: procurement-only fulfillment evidence returned `[]` instead of `['inbound']`.

## GREEN evidence

- Command: `npm test -- --run tests/ui/supplier-business.test.tsx tests/ui/supplier-profile-workspace.test.tsx`
- Result: 2 files passed, 13 tests passed.
- Command: `npx tsc --noEmit`
- Result: passed (exit 0).

## Files

- `src/features/workbench/dropship-decision-loop.ts`
- `src/components/workbench/supplier-profile-workspace.tsx`
- `tests/ui/supplier-business.test.tsx`
- `tests/ui/supplier-profile-workspace.test.tsx`
- `.superpowers/sdd/task-4-routing-report.md`

## Self-review

- A supplier remains one master record; cooperation modes are derived from existing records and relationships.
- Dropship evidence: period records, dropship product routing, dropship procurement fulfillment.
- Inbound evidence: warehouse purchase records, inbound routing, active SKU/product relationships, warehouse procurement fulfillment.
- The supplier profile uses compact badges and existing table components.
- Dropship period metrics and inbound procurement facts render in separate sections; no combined score was introduced.

## Concerns

- Existing Vite CJS deprecation warning remains.
- One existing UI test logs the expected Supabase proxy fallback warning in jsdom; local persistence still succeeds.

## Commit

- Implementation SHA: `4948d6a`

## Review follow-up

### RED evidence

- A dropship routing plus a generic active product relationship incorrectly produced `['dropship', 'inbound']`.
- A dropship-only profile rendered the inbound-oriented performance payload.
- An inbound profile rendered that payload outside the “入仓履约” section.

### Fix

- Generic product/SKU relationships no longer count as inbound evidence. Inbound now requires explicit inbound routing, warehouse/inbound purchase evidence, or warehouse procurement fulfillment.
- The existing performance payload is classified as inbound-oriented and renders only inside “入仓履约” when inbound evidence exists.
- Dropship period metrics remain isolated in “代发履约”; no mixed score was added.

### GREEN evidence

- Focused result: 2 files passed, 16 tests passed.
- TypeScript: passed.

### Historical baseline concern

- The earlier Task 4 commit added files that were historically untracked in the supplied baseline, making that old diff broad. Per instruction, this follow-up does not rewrite, rebase, or reconstruct those files; it changes only the reviewed behavior and focused tests.
