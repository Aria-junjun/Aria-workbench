# Industry Insight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent, local-first 行业洞察 workspace that teaches and records six research steps, preserves evidence classification, and produces a reusable opportunity report without inventing industry conclusions.

**Architecture:** Add a focused domain module for the industry-insight project model and report completeness rules. Persist projects through the existing `LocalWorkbenchData` bridge so local and cloud sync behavior stays consistent. Add list, intake, and single-page workspace routes with step navigation; each step saves independently and the final report is assembled from the same project record.

**Tech Stack:** Next.js App Router, React, TypeScript, existing local-store persistence, Vitest, Testing Library, existing Tailwind/CSS conventions, lucide-react.

## Global Constraints

- Keep 行业洞察 independent from 需求探索 and 竞品分析; only expose future-safe reference points.
- Do not scrape external sources, calculate market size/share, auto-classify Gartner/Kondratieff stages, or preload course case data.
- Every editable field must show a question, a whiteboard贴 placeholder, and a short example below the field; examples must never be saved as project data.
- Every saved observation must distinguish `fact`, `inference`, `unverified`, or `strategy`, and evidence metadata must remain visible in the report.
- Archive records instead of physically deleting them; provide restore for archived projects.
- Preserve unrelated working-tree changes and keep existing supplier, demand, and competitor tests passing.

---

### Task 1: Add the industry-insight domain model and report rules

**Files:**
- Create: `src/features/workbench/industry-insight.ts`
- Create: `tests/domain/industry-insight.test.ts`

**Interfaces:**
- Produces `IndustryInsightProject`, `IndustryDimension`, `IndustryStageRecord`, `IndustryChainNode`, `IndustryEvidence`, `IndustryConclusion`, `createIndustryInsightProject`, `updateIndustryInsightProject`, `getIndustryInsightCompleteness`, and `buildIndustryInsightReport`.
- Keeps labels and whiteboard贴 examples as exported constants so the UI does not duplicate business wording.

- [ ] **Step 1: Write the failing tests**

Cover these exact behaviors:

```ts
it("creates an empty six-step project without prefilled case data", () => {
  const project = createIndustryInsightProject({ title: "白板贴行业判断", productName: "白板贴" });
  expect(project.steps).toEqual({ purpose: "draft", boundary: "draft", dimensions: "draft", stage: "draft", chain: "draft", conclusion: "draft" });
  expect(project.dimensions).toHaveLength(4);
  expect(project.boundary.object).toBe("");
  expect(project.createdAt).toBeTruthy();
});

it("classifies facts separately from inferences and excludes examples from the report", () => {
  const project = updateIndustryInsightProject(createIndustryInsightProject({ title: "测试" }), {
    dimensions: [{ key: "scale", fact: "已收集销售记录", evidence: "销售台账", judgment: "规模仍需外部数据验证", tag: "inference" }],
  });
  const report = buildIndustryInsightReport(project);
  expect(report.sections.find((section) => section.key === "dimensions")?.content).toContain("已收集销售记录");
  expect(report.sections.map((section) => section.content).join(" ")).not.toContain("示例：");
});

it("flags missing evidence and reports the next action instead of auto-judging a stage", () => {
  const project = updateIndustryInsightProject(createIndustryInsightProject({ title: "测试" }), {
    stage: { currentStage: "unclear", basis: "", milestones: [], nextInflection: "", durationAssumption: "", evidenceIds: [] },
  });
  const completeness = getIndustryInsightCompleteness(project);
  expect(completeness.missing).toContain("阶段判断依据");
  expect(buildIndustryInsightReport(project).limitations).toContain("不会自动判定行业阶段");
});

it("archives and restores without changing the record id", () => {
  const original = createIndustryInsightProject({ title: "测试" });
  const archived = updateIndustryInsightProject(original, { status: "archived" });
  const restored = updateIndustryInsightProject(archived, { status: "draft" });
  expect(restored.id).toBe(original.id);
  expect(restored.status).toBe("draft");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run tests/domain/industry-insight.test.ts`

Expected: FAIL because `src/features/workbench/industry-insight.ts` does not exist.

- [ ] **Step 3: Implement the minimal domain module**

Implement typed records for the six steps, four dimensions (`scale`, `trend`, `share_shift`, `substitution`), evidence tags, stage choices, and chain layers. The factory must initialize blank values and timestamps. `getIndustryInsightCompleteness` must return a list of human-readable missing inputs. `buildIndustryInsightReport` must return section content plus a fixed limitation statement that no automatic stage judgment or external data calculation is performed.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --run tests/domain/industry-insight.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the isolated domain work**

```powershell
git add src/features/workbench/industry-insight.ts tests/domain/industry-insight.test.ts
git commit -m "feat: add industry insight domain model"
```

### Task 2: Persist industry-insight projects through the existing workbench store

**Files:**
- Modify: `src/features/workbench/local-store.ts` at imports, `LocalWorkbenchData`, `emptyData`, `normalizeWorkbenchData`, and feature helpers after competitor-analysis helpers
- Create: `tests/domain/industry-insight-store.test.ts`

**Interfaces:**
- Produces `loadIndustryInsightProjects`, `saveIndustryInsightProject`, `updateIndustryInsightProjectRecord`, and `archiveIndustryInsightProject`.
- Uses the existing `loadLocalWorkbenchData`/`saveLocalWorkbenchData` path so local persistence and the existing sync bridge remain unchanged.

- [ ] **Step 1: Write the failing persistence tests**

Mock `window.localStorage` with the same test helper used by existing local-store tests. Assert that a saved project survives a reload, a patch updates only the matching id, and archive/restore preserves the record.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run tests/domain/industry-insight-store.test.ts`

Expected: FAIL because the new collection and helper functions are not defined.

- [ ] **Step 3: Implement persistence and normalization**

Add `industryInsightProjects?: IndustryInsightProject[]` to the data type, initialize it to `[]`, normalize malformed/missing values to `[]`, and implement save/update/archive helpers using the existing timestamp conventions. Do not add a second storage key.

- [ ] **Step 4: Run persistence and existing store tests**

Run: `npm test -- --run tests/domain/industry-insight-store.test.ts tests/domain/local-store.test.ts`

Expected: PASS, with no regression in existing local-store behavior.

- [ ] **Step 5: Commit the persistence work**

```powershell
git add src/features/workbench/local-store.ts tests/domain/industry-insight-store.test.ts
git commit -m "feat: persist industry insight projects"
```

### Task 3: Add navigation, list page, and intake page

**Files:**
- Modify: `src/components/app-shell.tsx`
- Create: `src/app/industry-insight/page.tsx`
- Create: `src/app/industry-insight/new/page.tsx`
- Create: `src/components/workbench/industry-insight/insight-home.tsx`
- Create: `src/components/workbench/industry-insight/insight-intake-form.tsx`
- Create: `tests/ui/industry-insight-home.test.tsx`

**Interfaces:**
- The list page reads `loadIndustryInsightProjects` and links active records to `/industry-insight/[projectId]`.
- The intake form creates a blank project with title/product/user/decision fields and routes to its workspace.

- [ ] **Step 1: Write the failing UI tests**

Assert that the sidebar renders “行业洞察”, the empty state explains the six-step workflow, the new form shows whiteboard贴 placeholders and short examples, and submitting the form creates a project link without saving example text.

- [ ] **Step 2: Run the focused UI tests to verify failure**

Run: `npm test -- --run tests/ui/industry-insight-home.test.tsx`

Expected: FAIL because the routes/components do not exist.

- [ ] **Step 3: Implement the navigation and pages**

Add a stable sidebar entry with a globe/trend icon. Use existing card/button styling. Keep examples visually distinct from entered values. Include archive filtering on the list and a restore action for archived records.

- [ ] **Step 4: Run focused UI tests**

Run: `npm test -- --run tests/ui/industry-insight-home.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the navigation and intake work**

```powershell
git add src/components/app-shell.tsx src/app/industry-insight src/components/workbench/industry-insight/insight-home.tsx src/components/workbench/industry-insight/insight-intake-form.tsx tests/ui/industry-insight-home.test.tsx
git commit -m "feat: add industry insight entry pages"
```

### Task 4: Build the six-step workspace and report preview

**Files:**
- Create: `src/app/industry-insight/[projectId]/page.tsx`
- Create: `src/components/workbench/industry-insight/insight-workspace.tsx`
- Create: `src/components/workbench/industry-insight/insight-step-nav.tsx`
- Create: `src/components/workbench/industry-insight/insight-report.tsx`
- Create: `tests/ui/industry-insight-workspace.test.tsx`
- Create: `tests/ui/industry-insight-report.test.tsx`

**Interfaces:**
- Workspace edits one `IndustryInsightProject` at a time and calls the persistence helpers after each step.
- Report component consumes `buildIndustryInsightReport(project)` and renders evidence tags, completeness gaps, opportunity/risk/unverified items, and the limitation statement.

- [ ] **Step 1: Write failing workspace/report tests**

Cover independent step navigation, save-and-return behavior, four-dimension input, stage evidence fields, chain node creation, visible fact/inference/unverified/strategy tags, and report rendering with a missing-evidence warning.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm test -- --run tests/ui/industry-insight-workspace.test.tsx tests/ui/industry-insight-report.test.tsx`

Expected: FAIL because the workspace and report components do not exist.

- [ ] **Step 3: Implement the workspace**

Create a step navigation with six named steps. Each step has a question, whiteboard贴 placeholder, helper example, classification control, evidence fields, and an explicit save button. Render a progress/completeness summary, but never turn completeness into a score or automatic stage decision. Provide add/remove controls for chain nodes and evidence rows; removal only removes unsaved form rows, while projects are archived rather than deleted.

- [ ] **Step 4: Implement the report preview**

Render boundary summary, four dimensions, stage record, chain overview, conclusions, evidence trace, gaps, and limitations. Make clear which content is fact, inference, unverified, or strategy. Add copy/export-ready report layout without inventing a file download format in this task.

- [ ] **Step 5: Run focused UI tests**

Run: `npm test -- --run tests/ui/industry-insight-workspace.test.tsx tests/ui/industry-insight-report.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the workspace and report**

```powershell
git add src/app/industry-insight/[projectId] src/components/workbench/industry-insight tests/ui/industry-insight-workspace.test.tsx tests/ui/industry-insight-report.test.tsx
git commit -m "feat: add industry insight six-step workspace"
```

### Task 5: Run complete verification and document the handoff

**Files:**
- Modify: none unless verification exposes an implementation defect

- [ ] **Step 1: Run all targeted domain and UI tests**

Run: `npm test -- --run tests/domain/industry-insight.test.ts tests/domain/industry-insight-store.test.ts tests/ui/industry-insight-home.test.tsx tests/ui/industry-insight-workspace.test.tsx tests/ui/industry-insight-report.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run type-check and formatting checks**

Run: `npx tsc --noEmit` and `git diff --check`

Expected: no TypeScript errors and no whitespace errors.

- [ ] **Step 3: Run the full regression suite**

Run: `npm test`

Expected: PASS for the existing suite, including demand-exploration, competitor-analysis, and supplier tests.

- [ ] **Step 4: Review the user-visible route**

Open `http://localhost:3000/industry-insight`, create a blank whiteboard贴 example project, save one step, revisit it, and verify the report clearly separates evidence from judgment.

- [ ] **Step 5: Commit only the feature files and report verification**

Review `git status --short` and ensure existing unrelated edits are not staged. If all checks pass, create the final feature commit with `git add <explicit feature paths>` and `git commit -m "feat: add industry insight workspace"`.
