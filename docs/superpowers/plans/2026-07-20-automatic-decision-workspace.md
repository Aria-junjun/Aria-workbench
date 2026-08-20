# Automatic Decision Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an opt-in decision analysis flow where ordinary records cost zero API calls, while “需要分析” performs one bounded AI call and optionally maps the user’s words into a confirmed business model canvas.

**Architecture:** Add a small domain module that owns model definitions and validates AI output, a single API route that performs at most one OpenAI request, and backward-compatible application storage with versions. Extend the existing commercial knowledge page instead of adding a table library. The first model is a configurable business model canvas and is never enabled by default.

**Tech Stack:** Next.js 15, React, TypeScript, Zod, OpenAI SDK, localStorage, Vitest.

## Global Constraints

- Direct save must not call any API.
- AI is called only after the user clicks “需要分析”.
- One request returns both the model recommendation and the organized draft.
- A result may recommend zero models; business model canvas is optional.
- Recommend at most one model in phase one and ask at most three material questions.
- Keep the raw input and previous versions.
- Do not add other models, Supabase, scheduled jobs, background calls, or new dependencies.

---

### Task 1: Decision analysis contract and business canvas definition

**Files:**
- Create: `src/features/workbench/decision-analysis.ts`
- Test: `tests/domain/decision-analysis.test.ts`

**Interfaces:**
- Produces: `DecisionAnalysisSchema`, `DecisionAnalysis`, `DecisionModelDefinition`, `BUSINESS_MODEL_CANVAS`, `normalizeDecisionAnalysis(value)`.

- [ ] Write failing tests proving that analysis can return no model, model IDs are restricted, questions are capped at three, and the canvas exposes nine sections with Chinese placeholder examples.
- [ ] Run `npx vitest run tests/domain/decision-analysis.test.ts --exclude ".worktrees/**"` and verify failure because the module does not exist.
- [ ] Implement the Zod contract:

```ts
type DecisionAnalysis = {
  summary: string;
  initialJudgement?: string;
  recommendedModelId?: "business-model-canvas";
  recommendationReason?: string;
  modelSections: Array<{ key: string; label: string; value: string; placeholder: string }>;
  openQuestions: string[];
  nextActions: string[];
};
```

- [ ] Define the nine business model canvas sections and static light-gray guidance; normalization drops unknown sections and caps questions at three.
- [ ] Run the targeted test and commit only Task 1 files.

### Task 2: Backward-compatible application records and versions

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/domain/local-store.test.ts`

**Interfaces:**
- Consumes: `DecisionAnalysis`.
- Produces: extended `LocalKnowledgeApplication`, `savePlainKnowledgeApplication(input)`, `saveAnalyzedKnowledgeApplication(input)`, `saveKnowledgeApplicationVersion(applicationId, patch)`, `applicationVersions(applicationId)`.

- [ ] Write failing tests proving plain save stores raw text with `analysisStatus: "not_requested"`, analyzed save preserves raw text and structured sections, and editing creates version 2 without deleting version 1.
- [ ] Run the local-store tests and confirm the new assertions fail.
- [ ] Add optional fields so old records still load:

```ts
rawInput?: string;
analysisStatus?: "not_requested" | "analyzed";
modelId?: "business-model-canvas";
modelSections?: Array<{ key: string; label: string; value: string; placeholder: string }>;
openQuestions?: string[];
version?: number;
rootApplicationId?: string;
updatedAt?: string;
```

- [ ] Implement plain save, analyzed save and immutable version creation. Existing `saveKnowledgeApplication` remains compatible.
- [ ] Run local-store tests and commit only Task 2 files.

### Task 3: One-call opt-in analysis API

**Files:**
- Create: `src/features/workbench/decision-analysis-ai.ts`
- Create: `src/app/api/knowledge/analyze/route.ts`
- Test: `tests/domain/decision-analysis-ai.test.ts`

**Interfaces:**
- Consumes: raw user text and `DecisionAnalysisSchema`.
- Produces: `analyzeDecisionInput(rawInput): Promise<DecisionAnalysis>`.

- [ ] Write failing tests around a pure prompt builder: it must say that models are optional, reject canvas use for simple follow-ups/records, restrict output length, preserve user wording, and cap questions at three.
- [ ] Implement one `chat.completions.create` call using `OPENAI_EXTRACTION_MODEL` or `gpt-4.1-mini`, temperature `0.1`, and JSON output.
- [ ] Return HTTP `503` with a short Chinese message when `OPENAI_API_KEY` is absent; do not fabricate a local AI result.
- [ ] Validate and normalize the response. Never retry automatically.
- [ ] Run targeted tests and commit only Task 3 files.

### Task 4: Zero-cost record path, opt-in analysis draft, and history detail

**Files:**
- Modify: `src/app/knowledge/page.tsx`
- Create: `src/components/workbench/decision-analysis-editor.tsx`
- Create: `src/app/knowledge/applications/[applicationId]/page.tsx`
- Test: `tests/ui/decision-workspace.test.tsx`

**Interfaces:**
- Consumes: Task 1 analysis contract, Task 2 storage functions, Task 3 API.
- Produces: user-facing ordinary-save and analyzed-save flows.

- [ ] Write source-level UI tests proving there are separate “直接保存” and “需要分析” controls, fetch is only referenced by the analysis handler, model sections are editable, and history records link to details.
- [ ] Modify “解决问题” so the same input offers:
  - `直接保存`: local save only, no fetch.
  - `需要分析`: one POST to `/api/knowledge/analyze`.
- [ ] Show the returned draft in an editor. If no model is recommended, display summary, judgement, questions and actions only. If canvas is recommended, show it as an unselected option and require explicit confirmation before displaying the nine editable modules.
- [ ] Render empty section guidance as light-gray placeholders; never save placeholder text as user content.
- [ ] Save analyzed results locally and add an application detail page that shows the latest version, previous versions, raw input and editable structured content.
- [ ] Update the application history list to show summary, model or “未使用模型”, next action, update time and a detail link.
- [ ] Run `npx vitest run --exclude ".worktrees/**"`, `npx tsc --noEmit`, and `npm run build`.
- [ ] Start the local server and verify direct save, opt-in analysis error without a key, canvas confirmation, save, reopen and version history in the in-app browser.
- [ ] Commit only Task 4 files after verification.
