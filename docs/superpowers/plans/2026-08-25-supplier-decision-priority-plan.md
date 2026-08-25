# Supplier Decision Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove SKU coverage as a supplier action and make the supplier overview prioritize attribution, supply split, and quality signals.

**Architecture:** Keep the existing supplier decision aggregation in `product-master.ts`, but remove the `complete_coverage` decision from its output. Keep the actual supplied SKU count as reference data and update the supplier page to use clearer labels and filters.

**Tech Stack:** Next.js, React, TypeScript, Vitest.

## Global Constraints

- SKU coverage must not create a supplier action.
- Actual supplied SKU count remains reference information.
- Quality signals must not be treated as direct supplier attribution without a supplier relationship.
- Do not add ERP or financial functionality.

---

### Task 1: Update decision rules with regression coverage

**Files:**
- Modify: `tests/domain/supplier-decision-overview.test.ts`
- Modify: `src/features/workbench/product-master.ts`

**Interfaces:**
- `buildSupplierDecisionOverviewRows(...)` continues returning supplier decision rows.
- `complete_coverage` is no longer emitted for partial SKU coverage.

- [ ] **Step 1: Add a failing test** asserting that a single supplier with partial product-family SKU coverage is `maintain_primary`, retains `coveredSkuCount`, and does not produce `complete_coverage`.
- [ ] **Step 2: Run the targeted domain test and verify it fails because the current implementation emits `complete_coverage`.
- [ ] **Step 3: Remove coverage from the decision priority in `decisionForSupplierRow` and the overview aggregation fallback; preserve the coverage counts and evidence as reference values.
- [ ] **Step 4: Run the targeted domain test and verify it passes.
- [ ] **Step 5: Commit the domain rule change.

### Task 2: Align supplier page presentation

**Files:**
- Modify: `tests/ui/supplier-decision-overview.test.tsx`
- Modify: `src/app/suppliers/page.tsx`

**Interfaces:**
- Decision filters contain only `all`, `maintain_primary`, `review_split`, `confirm_supplier`, and `review_quality`.
- The table label becomes `实际供货 SKU`.

- [ ] **Step 1: Update the UI contract test to require the new label and absence of the coverage action label.
- [ ] **Step 2: Run the UI contract test and verify it fails against the current page.
- [ ] **Step 3: Remove the coverage filter/pill and change the table heading and action-link branching to the remaining real actions.
- [ ] **Step 4: Run the UI contract test and verify it passes.
- [ ] **Step 5: Commit the page presentation change.

### Task 3: Verify local behavior and deploy

**Files:**
- No new source files.

- [ ] **Step 1: Run targeted tests for domain and UI decision overview.
- [ ] **Step 2: Run the full test suite and TypeScript/build verification.
- [ ] **Step 3: Inspect `/suppliers` locally and confirm partial coverage no longer creates a pending action.
- [ ] **Step 4: Push the verified commits to GitHub `main` and confirm the cloud endpoint responds successfully.
