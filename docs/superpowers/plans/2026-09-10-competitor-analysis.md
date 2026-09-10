# 竞品分析模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent, guided competitor-analysis workspace that turns the course's five-layer method and six-step strategy process into a beginner-friendly, evidence-traceable product workflow.

**Architecture:** Add a typed domain model and local-store persistence for analysis projects, competitors, five-layer observations, stage/version records, product comparisons, strategies, and evidence. Add a project list plus a six-step client workspace following the existing demand-exploration conventions, with example copy shown through placeholders and hints but never saved as user data. Keep the first version qualitative and evidence-based; no unsupported overall competitor score.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, existing local-store/Supabase snapshot sync.

## Global Constraints

- Keep competitor analysis independent from demand exploration while preserving optional future cross-links.
- Do not auto-fill whiteboard examples into user records.
- Distinguish facts, inferences, unverified items, and strategy recommendations.
- Use recoverable archive behavior for projects; do not physically delete historical analysis.
- Follow test-first development for every new domain behavior and UI contract.
- Preserve unrelated uncommitted supplier changes in the working tree.

### Task 1: Domain model and persistence

**Files:**
- Create: `src/features/workbench/competitor-analysis.ts`
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/domain/competitor-analysis.test.ts`
- Test: `tests/domain/local-store.test.ts`

**Interfaces:**
- Produce `CompetitorAnalysisProject`, `CompetitorProfile`, `FiveLayerAnalysis`, `CompetitorStageRecord`, `ProductComparison`, `CompetitorStrategy`, and `CompetitorEvidence` types.
- Produce `createCompetitorAnalysisProject`, `addCompetitorProfile`, `updateFiveLayerAnalysis`, `archiveCompetitorAnalysisProject`, `restoreCompetitorAnalysisProject`, `buildCompetitorAnalysisReport`.
- Produce local-store helpers `loadCompetitorAnalysisProjects`, `saveCompetitorAnalysisProject`, and `updateCompetitorAnalysisProject`.

- [ ] Write failing tests for project creation, evidence tagging, archive/restore, strategy traceability, and report section generation.
- [ ] Run `npx vitest run tests/domain/competitor-analysis.test.ts tests/domain/local-store.test.ts` and confirm the new APIs fail because they do not exist.
- [ ] Implement the minimal typed model and pure update functions; normalize missing arrays and preserve archived history.
- [ ] Add the new collection to `LocalWorkbenchData`, defaults, normalization, and local-store save/load paths so existing sync snapshots carry it.
- [ ] Run the focused tests and confirm they pass.
- [ ] Commit `feat: add competitor analysis domain model`.

### Task 2: Project list and creation flow

**Files:**
- Create: `src/app/competitor-analysis/page.tsx`
- Create: `src/app/competitor-analysis/new/page.tsx`
- Create: `src/components/workbench/competitor-analysis/analysis-home.tsx`
- Create: `src/components/workbench/competitor-analysis/analysis-intake-form.tsx`
- Modify: `src/components/app-shell.tsx`
- Test: `tests/ui/competitor-analysis-home.test.tsx`

**Interfaces:**
- Consume the domain and local-store APIs from Task 1.
- Produce navigation at `/competitor-analysis` and `/competitor-analysis/new`.

- [ ] Write failing UI contract tests for the new navigation label, project cards, example hints, recoverable archive action, and creation fields.
- [ ] Run the focused UI test and verify it fails because the route/components do not exist.
- [ ] Implement the list and intake pages with the existing card style, beginner copy, gray examples, project status, progress, archive, and restore.
- [ ] Add the new module to the workbench sidebar without changing the demand-exploration route.
- [ ] Run the focused UI test and type-check.
- [ ] Commit `feat: add competitor analysis project entry`.

### Task 3: Six-step workspace shell

**Files:**
- Create: `src/app/competitor-analysis/[projectId]/page.tsx`
- Create: `src/components/workbench/competitor-analysis/analysis-workspace.tsx`
- Create: `src/components/workbench/competitor-analysis/step-navigation.tsx`
- Create: `src/components/workbench/competitor-analysis/evidence-panel.tsx`
- Test: `tests/ui/competitor-analysis-workspace.test.tsx`

**Interfaces:**
- Consume `CompetitorAnalysisProject` and evidence helpers.
- Produce stable step keys: `goal`, `competitors`, `layers`, `stages`, `self_state`, `strategy_report`.

- [ ] Write failing tests for the six-step navigation, persistent project header, step status, evidence panel, and back/forward navigation.
- [ ] Run the focused UI test and confirm the workspace shell is missing.
- [ ] Implement the workspace shell with local refresh after each save and step-level incomplete states.
- [ ] Add evidence panel fields for source, type, date, link/attachment description, fact statement, and note.
- [ ] Run UI tests and type-check.
- [ ] Commit `feat: add competitor analysis workspace shell`.

### Task 4: Goal, competitor, and five-layer forms

**Files:**
- Create: `src/components/workbench/competitor-analysis/goal-step.tsx`
- Create: `src/components/workbench/competitor-analysis/competitor-step.tsx`
- Create: `src/components/workbench/competitor-analysis/five-layer-step.tsx`
- Create: `src/components/workbench/competitor-analysis/layer-card.tsx`
- Test: `tests/ui/competitor-analysis-five-layer.test.tsx`

**Interfaces:**
- Consume project update functions and expose four-field layer entries: observation, evidence, implication, inspiration.

- [ ] Write failing tests for beginner examples, non-prefilled inputs, multiple competitors, competitor relation choices, and all five layer labels.
- [ ] Run the focused UI test and confirm the fields are absent.
- [ ] Implement the guided forms with placeholder/example separation and save/skip controls.
- [ ] Implement validation that requires a product, user, and decision question before marking the goal step complete.
- [ ] Run UI tests and type-check.
- [ ] Commit `feat: add guided competitor and five-layer analysis`.

### Task 5: Stage, self-state, and strategy output

**Files:**
- Create: `src/components/workbench/competitor-analysis/stage-step.tsx`
- Create: `src/components/workbench/competitor-analysis/self-state-step.tsx`
- Create: `src/components/workbench/competitor-analysis/strategy-step.tsx`
- Create: `src/components/workbench/competitor-analysis/report-preview.tsx`
- Test: `tests/ui/competitor-analysis-report.test.tsx`

**Interfaces:**
- Consume stage, comparison, strategy, and report builders from Task 1.
- Produce report sections with fact/inference/unverified/strategy labels and trace links.

- [ ] Write failing tests for timeline records, six difference types, four strategy types, evidence traceability, and report sections.
- [ ] Run the focused UI test and confirm the output flow is missing.
- [ ] Implement stage/version timeline, self-state comparison, strategy records, priority/action fields, and report preview.
- [ ] Add explicit limitations section and prevent unreferenced strategies from being marked complete.
- [ ] Run focused tests and type-check.
- [ ] Commit `feat: add competitor strategy and report output`.

### Task 6: Integration and verification

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Modify: `src/components/workbench/competitor-analysis/*.tsx`
- Test: `tests/e2e/competitor-analysis-save-load.test.ts`

- [ ] Write a save-load integration test covering a project with two competitors, five-layer evidence, one stage record, one self-state comparison, and one strategy.
- [ ] Run the integration test and ensure it fails if any collection is not persisted or normalized.
- [ ] Fix only the persistence or normalization path exposed by the failing test.
- [ ] Run `npx vitest run tests/domain/competitor-analysis.test.ts tests/ui/competitor-analysis-home.test.tsx tests/ui/competitor-analysis-workspace.test.tsx tests/ui/competitor-analysis-five-layer.test.tsx tests/ui/competitor-analysis-report.test.tsx tests/e2e/competitor-analysis-save-load.test.ts`.
- [ ] Run `npx tsc --noEmit` and `git diff --check`.
- [ ] Open `/competitor-analysis` locally and verify the project list, creation flow, six steps, example separation, archive/restore, and report preview.
- [ ] Commit `test: verify competitor analysis save and report flow`.
