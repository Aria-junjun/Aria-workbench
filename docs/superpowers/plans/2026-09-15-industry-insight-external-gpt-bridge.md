# Industry Insight External GPT Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a field-locked external GPT bridge to Industry Insight so a user can generate a research task package, paste back a Markdown draft, review each recognized field, and only then save confirmed content into the existing six-step project.

**Architecture:** Keep `IndustryInsightProject` as the only formal report model. Add a focused bridge domain module that owns the canonical field catalog, prompt generation, Markdown parsing, draft review status, and safe field application. Add a focused bridge panel to the existing workspace; the panel stores drafts inside the existing project record through the current local store and never writes unreviewed GPT output into formal fields.

**Tech Stack:** Next.js 15, React, TypeScript, Vitest, existing local-store persistence, Tailwind utility classes.

## Global Constraints

- Preserve the six existing steps and their current visible fields.
- External GPT output must map only to existing fields; no new visible research fields may be introduced.
- AI output is a draft until the user explicitly accepts or edits it.
- Unknown or unmapped content must produce an import warning and remain visible; it must not be silently discarded.
- Source metadata is evidence metadata, not a new visible research field.
- No model API, automatic web crawling, background monitoring, or automatic downstream module writes in this implementation.
- Follow test-first development: every new domain behavior and UI contract starts with a failing test.

---

## Task 1: Add the field-locked bridge domain model and prompt contract

**Files:**
- Create: `src/features/workbench/industry-insight-bridge.ts`
- Modify: `src/features/workbench/industry-insight.ts:1-140`
- Test: `tests/domain/industry-insight-bridge.test.ts`

**Interfaces:**
- Consumes: `IndustryInsightProject`, `IndustryStepKey`, `IndustryDimensionKey`, `IndustryEvidenceTag`, `IndustryStage`, and the current project field names.
- Produces: `IndustryInsightDraftField`, `IndustryInsightImportResult`, `INDUSTRY_INSIGHT_FIELD_CATALOG`, `buildIndustryInsightResearchPrompt(project)`, `parseIndustryInsightMarkdown(input)`, and `applyIndustryInsightDraft(project, draft)`.

- [ ] **Step 1: Write the failing domain tests**

Add tests that assert:

```ts
it("builds a prompt with only the current field catalog", () => {
  const project = createIndustryInsightProject({
    title: "白板贴行业判断",
    productName: "白板贴",
    decisionQuestion: "是否优先验证重复擦写场景？",
    expectedAction: "进入需求探索",
  });
  const prompt = buildIndustryInsightResearchPrompt(project);
  expect(prompt).toContain("purpose.decisionQuestion");
  expect(prompt).toContain("boundary.exclusions");
  expect(prompt).toContain("dimensions.scale.fact");
  expect(prompt).toContain("stage.nextInflection");
  expect(prompt).toContain("chainNodes[].participants");
  expect(prompt).toContain("conclusion.nextAction");
  expect(prompt).not.toContain("研究背景");
  expect(prompt).not.toContain("成功标准");
});

it("parses recognized fields and keeps unknown content as warnings", () => {
  const result = parseIndustryInsightMarkdown(`
## 研究目的
### 决策问题
是否优先验证重复擦写场景？
### 预期行动
进入需求探索。
## 额外结论
这是不能归位的内容。
`);
  expect(result.drafts).toEqual(expect.arrayContaining([
    expect.objectContaining({ fieldPath: "decisionQuestion", value: "是否优先验证重复擦写场景？", status: "draft" }),
    expect.objectContaining({ fieldPath: "expectedAction", value: "进入需求探索。", status: "draft" }),
  ]));
  expect(result.warnings.join(" ")).toContain("额外结论");
});

it("applies only an accepted draft to an existing formal field", () => {
  const project = createIndustryInsightProject({ title: "测试" });
  const draft = { id: "draft-1", fieldPath: "decisionQuestion", value: "新的决策问题", status: "accepted" as const, sourceRefs: [], importedAt: "2026-09-15T00:00:00.000Z" };
  expect(applyIndustryInsightDraft(project, draft).decisionQuestion).toBe("新的决策问题");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/domain/industry-insight-bridge.test.ts`

Expected: FAIL because the bridge module, catalog, prompt builder, parser, and apply helper do not exist.

- [ ] **Step 3: Implement the minimal bridge domain module**

Create a canonical catalog whose paths are exactly the current fields:

```ts
export type IndustryInsightDraftStatus = "draft" | "accepted" | "edited" | "needs_verification" | "rejected";

export type IndustryInsightDraftField = {
  id: string;
  fieldPath: string;
  value: string;
  status: IndustryInsightDraftStatus;
  sourceRefs: string[];
  importedAt: string;
  editedValue?: string;
};

export type IndustryInsightImportResult = {
  drafts: IndustryInsightDraftField[];
  warnings: string[];
};
```

The catalog must include only:

```ts
"decisionQuestion", "expectedAction",
"boundary.object", "boundary.scenarios", "boundary.region", "boundary.timeRange", "boundary.exclusions",
"dimensions.scale.fact", "dimensions.scale.evidence", "dimensions.scale.judgment", "dimensions.scale.tag",
"dimensions.trend.fact", "dimensions.trend.evidence", "dimensions.trend.judgment", "dimensions.trend.tag",
"dimensions.share_shift.fact", "dimensions.share_shift.evidence", "dimensions.share_shift.judgment", "dimensions.share_shift.tag",
"dimensions.substitution.fact", "dimensions.substitution.evidence", "dimensions.substitution.judgment", "dimensions.substitution.tag",
"stage.currentStage", "stage.basis", "stage.nextInflection", "stage.durationAssumption",
"chainNodes[].layer", "chainNodes[].role", "chainNodes[].participants", "chainNodes[].valueFlow",
"conclusion.opportunity", "conclusion.risks", "conclusion.unverifiedQuestions", "conclusion.nextAction"
```

`buildIndustryInsightResearchPrompt` must print these exact paths, the project context, source/date rules, fact-vs-inference rules, and a fixed Markdown template. It must explicitly say that unknown content goes into `conclusion.unverifiedQuestions` only when it is a verification question; otherwise the parser must warn.

`parseIndustryInsightMarkdown` must recognize the fixed headings and dimension names, return `draft` status for every recognized value, capture unrecognized headings in `warnings`, and never infer a missing field.

`applyIndustryInsightDraft` must update only a recognized accepted/edited draft. It must support nested boundary, dimensions, stage, chain node, and conclusion paths without mutating the original project. Chain drafts should create/update one deterministic node; source references remain on the draft record until evidence UI is added.

- [ ] **Step 4: Run the focused domain test to verify it passes**

Run: `npm test -- tests/domain/industry-insight-bridge.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the domain contract**

```bash
git add tests/domain/industry-insight-bridge.test.ts src/features/workbench/industry-insight-bridge.ts src/features/workbench/industry-insight.ts
git commit -m "feat: add field-locked industry insight bridge"
```

## Task 2: Persist AI drafts without changing formal field semantics

**Files:**
- Modify: `src/features/workbench/industry-insight.ts:87-143`
- Modify: `src/features/workbench/local-store.ts:490-810` only if type normalization requires it
- Test: `tests/domain/industry-insight-store.test.ts`

**Interfaces:**
- Consumes: `IndustryInsightDraftField` from Task 1 and the current `saveIndustryInsightProject` / `loadIndustryInsightProjects` functions.
- Produces: `aiDrafts: IndustryInsightDraftField[]` on `IndustryInsightProject`, initialized to `[]`, persisted through the existing local-store record, and preserved when loading older projects without the field.

- [ ] **Step 1: Write the failing persistence tests**

Add tests that assert a newly created project has `aiDrafts: []`, a project saved and loaded with one draft retains that draft, and formal fields remain unchanged while status is `draft`.

- [ ] **Step 2: Run tests to verify the persistence behavior fails**

Run: `npm test -- tests/domain/industry-insight-store.test.ts`

Expected: FAIL because `aiDrafts` is not yet initialized or preserved.

- [ ] **Step 3: Add the optional-compatible project field and persistence default**

Add `aiDrafts: IndustryInsightDraftField[]` to the project type and factory. When loading old records, use `project.aiDrafts ?? []` at the workspace boundary or in the existing local-store normalization path. Do not rename or remove any existing formal fields.

- [ ] **Step 4: Run the focused persistence tests**

Run: `npm test -- tests/domain/industry-insight-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the persistence change**

```bash
git add tests/domain/industry-insight-store.test.ts src/features/workbench/industry-insight.ts src/features/workbench/local-store.ts
git commit -m "feat: persist industry insight AI drafts"
```

## Task 3: Add task-package copy and Markdown import UI

**Files:**
- Create: `src/components/workbench/industry-insight/insight-bridge-panel.tsx`
- Modify: `src/components/workbench/industry-insight/insight-workspace.tsx:1-25`
- Test: `tests/ui/industry-insight-bridge.test.tsx`

**Interfaces:**
- Consumes: `buildIndustryInsightResearchPrompt`, `parseIndustryInsightMarkdown`, `applyIndustryInsightDraft`, `IndustryInsightDraftField`, and the existing workspace save callback.
- Produces: a bridge panel with two explicit actions: `复制外部 GPT 任务包` and `导入 AI 初稿`; import results appear as drafts and warnings before any formal field is changed.

- [ ] **Step 1: Write the failing UI contract test**

Read the bridge component/workspace source and assert the UI contains:

```ts
expect(bridge).toContain("复制外部 GPT 任务包");
expect(bridge).toContain("导入 AI 初稿");
expect(bridge).toContain("AI 初稿不会直接写入正式记录");
expect(bridge).toContain("识别失败内容");
expect(workspace).toContain("InsightBridgePanel");
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run: `npm test -- tests/ui/industry-insight-bridge.test.tsx`

Expected: FAIL because the bridge panel does not exist.

- [ ] **Step 3: Implement the bridge panel**

Create a focused client component that:

- shows a short explanation of the external GPT flow;
- renders a read-only task package preview;
- copies the generated package with `navigator.clipboard.writeText`, with a visible copied state;
- provides a textarea for pasted Markdown;
- parses on submit and displays recognized draft count plus warnings;
- saves drafts to `project.aiDrafts` only;
- does not call `applyIndustryInsightDraft` during import;
- keeps the panel independent from the six-step form components.

Render it once below the step navigator and above the current step content in `InsightWorkspace`. Keep the six step forms unchanged except for receiving the updated project and save callback.

- [ ] **Step 4: Run the UI test**

Run: `npm test -- tests/ui/industry-insight-bridge.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the bridge UI**

```bash
git add tests/ui/industry-insight-bridge.test.tsx src/components/workbench/industry-insight/insight-bridge-panel.tsx src/components/workbench/industry-insight/insight-workspace.tsx
git commit -m "feat: add external GPT task and import panel"
```

## Task 4: Add field-by-field review and safe application

**Files:**
- Modify: `src/components/workbench/industry-insight/insight-bridge-panel.tsx`
- Modify: `src/components/workbench/industry-insight/insight-workspace.tsx`
- Modify: `src/components/workbench/industry-insight/insight-report.tsx`
- Test: `tests/ui/industry-insight-bridge.test.tsx`
- Test: `tests/domain/industry-insight.test.ts`

**Interfaces:**
- Consumes: persisted `project.aiDrafts` and `applyIndustryInsightDraft`.
- Produces: review actions for each draft: `采用`, `修改后采用`, `待验证`, `暂不采用`; formal project fields change only after `accepted` or `edited`.

- [ ] **Step 1: Write failing review tests**

Add tests that assert:

- a draft card shows its field label and value;
- the card exposes all four review states;
- accepting a `decisionQuestion` draft updates `project.decisionQuestion`;
- marking a draft `needs_verification` does not update the formal field;
- the report source code includes a visible count/notice for unreviewed AI drafts.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/ui/industry-insight-bridge.test.tsx tests/domain/industry-insight.test.ts`

Expected: FAIL because no review controls or application path exists.

- [ ] **Step 3: Implement review actions**

For `采用`, apply the existing draft value and set status to `accepted`.

For `修改后采用`, show an editable textarea initialized from the AI value, apply the edited value, and set status to `edited`.

For `待验证` and `暂不采用`, update only draft status and preserve the original AI value. Save the project after each action. Display unrecognized import warnings next to the drafts and do not provide a misleading accept action for warnings.

Add a report notice such as `仍有 N 条 AI 初稿待确认` whenever draft status is `draft` or `needs_verification`. The report must continue to read formal fields only.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/ui/industry-insight-bridge.test.tsx tests/domain/industry-insight.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the review flow**

```bash
git add tests/ui/industry-insight-bridge.test.tsx tests/domain/industry-insight.test.ts src/components/workbench/industry-insight/insight-bridge-panel.tsx src/components/workbench/industry-insight/insight-workspace.tsx src/components/workbench/industry-insight/insight-report.tsx
git commit -m "feat: review and apply industry insight AI drafts"
```

## Task 5: End-to-end verification and browser smoke test

**Files:**
- Modify only files needed to fix failures from the preceding tasks.
- Test: `tests/domain/industry-insight-bridge.test.ts`
- Test: `tests/domain/industry-insight.test.ts`
- Test: `tests/domain/industry-insight-store.test.ts`
- Test: `tests/ui/industry-insight-bridge.test.tsx`
- Test: `tests/ui/industry-insight-workspace.test.tsx`
- Test: `tests/ui/industry-insight-report.test.tsx`

- [ ] **Step 1: Run the complete focused suite**

Run: `npm test -- tests/domain/industry-insight-bridge.test.ts tests/domain/industry-insight.test.ts tests/domain/industry-insight-store.test.ts tests/ui/industry-insight-bridge.test.tsx tests/ui/industry-insight-workspace.test.tsx tests/ui/industry-insight-report.test.tsx`

Expected: all listed tests pass.

- [ ] **Step 2: Run type checking**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: Run browser smoke test**

Open `/industry-insight`, enter an existing project, and verify:

1. The bridge panel shows the current project context.
2. Copying the task package produces text containing the exact field paths.
3. Pasting a valid sample imports drafts without changing the formal report.
4. An unknown heading remains visible as a warning.
5. Accepting one draft changes only its mapped formal field.
6. Refreshing the page preserves drafts and review status.
7. The report distinguishes confirmed content from pending AI drafts.

- [ ] **Step 4: Run the repository's broader relevant tests**

Run: `npm test -- tests/domain/industry-insight.test.ts tests/domain/industry-insight-store.test.ts tests/ui/industry-insight-home.test.tsx tests/ui/industry-insight-workspace.test.tsx tests/ui/industry-insight-report.test.tsx`

Expected: all relevant Industry Insight tests pass. Record unrelated pre-existing failures separately; do not alter unrelated modules to make this feature pass.

- [ ] **Step 5: Commit verification fixes only**

```bash
git add src/features/workbench/industry-insight.ts src/features/workbench/industry-insight-bridge.ts src/components/workbench/industry-insight tests/domain/industry-insight*.test.ts tests/ui/industry-insight*.test.tsx
git commit -m "test: verify industry insight external GPT bridge"
```

## Self-review checklist

- Every formal output path in the prompt exists in the current page or current data model.
- No prompt section creates a new visible field.
- Import never applies values automatically.
- Unknown content remains visible as a warning.
- `accepted` and `edited` are the only statuses allowed to update formal fields.
- Reports never use unreviewed AI drafts as conclusions.
- Existing six-step workflow and local persistence remain compatible with older records.
