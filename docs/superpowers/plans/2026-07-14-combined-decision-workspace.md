# 组合决策工作区实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户从知识推荐结果中选择 1 至 3 个工具，在一个组合工作区完成诊断、行动选择、应用记录保存和待办生成。

**Architecture:** 用独立领域模块管理默认选择、最多 3 个限制和 URL 参数解析；知识首页负责推荐和选择，新的 `/knowledge/solve` 页面负责组合应用。沿用现有 `LocalKnowledgeApplication.toolIds`，新增可选行动来源字段以兼容旧数据。

**Tech Stack:** Next.js 15 App Router、React、TypeScript、localStorage、Vitest、内置浏览器验证。

## Global Constraints

- 默认选择相关度最高的 2 个工具，最多选择 3 个。
- 旧知识卡不进入组合工作区。
- 新记录同时保留 `selectedActions` 和结构化行动来源。
- 不调用 GPT，不自动合并或裁决不同策略。
- 所有界面文案使用中文。
- 保留已有本地数据和单工具应用记录。

---

### Task 1: 组合选择与 URL 状态领域逻辑

**Files:**
- Create: `src/features/workbench/knowledge-solve.ts`
- Create: `tests/domain/knowledge-solve.test.ts`

**Interfaces:**
- Produces: `defaultSelectedToolIds(toolIds: string[]): string[]`
- Produces: `toggleSelectedToolId(current: string[], toolId: string, limit?: number): { ids: string[]; limitReached: boolean }`
- Produces: `parseSelectedToolIds(value: string | null, validIds: string[]): string[]`
- Produces: `buildKnowledgeReturnHref(problem: string): string`

- [ ] **Step 1: Write failing selection tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildKnowledgeReturnHref,
  defaultSelectedToolIds,
  parseSelectedToolIds,
  toggleSelectedToolId
} from "@/features/workbench/knowledge-solve";

describe("knowledge solve selection", () => {
  it("selects the first two recommendations by default", () => {
    expect(defaultSelectedToolIds(["a", "b", "c"])).toEqual(["a", "b"]);
  });

  it("prevents selecting more than three tools", () => {
    expect(toggleSelectedToolId(["a", "b", "c"], "d")).toEqual({ ids: ["a", "b", "c"], limitReached: true });
  });

  it("removes invalid and duplicate URL ids", () => {
    expect(parseSelectedToolIds("a,missing,a,b", ["a", "b"])).toEqual(["a", "b"]);
  });

  it("preserves the problem in the return URL", () => {
    expect(buildKnowledgeReturnHref("是否降价？")).toBe("/knowledge?problem=%E6%98%AF%E5%90%A6%E9%99%8D%E4%BB%B7%EF%BC%9F");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- tests/domain/knowledge-solve.test.ts`

Expected: FAIL because `knowledge-solve.ts` does not exist.

- [ ] **Step 3: Implement the selection helpers**

```ts
const DEFAULT_SELECTION_COUNT = 2;
const MAX_SELECTION_COUNT = 3;

export function defaultSelectedToolIds(toolIds: string[]) {
  return toolIds.slice(0, DEFAULT_SELECTION_COUNT);
}

export function toggleSelectedToolId(current: string[], toolId: string, limit = MAX_SELECTION_COUNT) {
  if (current.includes(toolId)) return { ids: current.filter((id) => id !== toolId), limitReached: false };
  if (current.length >= limit) return { ids: current, limitReached: true };
  return { ids: [...current, toolId], limitReached: false };
}

export function parseSelectedToolIds(value: string | null, validIds: string[]) {
  const valid = new Set(validIds);
  return [...new Set((value || "").split(",").filter((id) => valid.has(id)))].slice(0, MAX_SELECTION_COUNT);
}

export function buildKnowledgeReturnHref(problem: string) {
  return `/knowledge?problem=${encodeURIComponent(problem.trim())}`;
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd test -- tests/domain/knowledge-solve.test.ts`

Expected: 4 tests pass.

---

### Task 2: 组合应用记录与待办来源

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Modify: `tests/domain/local-store.test.ts`

**Interfaces:**
- Produces type: `LocalKnowledgeActionSource = { toolId: string; toolName: string; action: string }`
- Extends: `LocalKnowledgeApplication.selectedActionSources?: LocalKnowledgeActionSource[]`
- Extends: `saveKnowledgeApplication(input)` with optional `selectedActionSources`
- Produces: `createTaskFromKnowledgeAction(toolId: string, action: string)` with existing source-aware title behavior.

- [ ] **Step 1: Write failing persistence tests**

```ts
it("saves one application with multiple tools and action sources", () => {
  saveLocalWorkbenchData(sampleData());
  const application = saveKnowledgeApplication({
    problem: "是否降价",
    toolIds: ["tool-1", "tool-2"],
    diagnosis: "先判断差异价值",
    selectedActions: ["验证价格敏感度"],
    selectedActionSources: [
      { toolId: "tool-1", toolName: "竞争战略", action: "验证价格敏感度" }
    ]
  });

  expect(application.toolIds).toEqual(["tool-1", "tool-2"]);
  expect(application.selectedActionSources).toHaveLength(1);
});

it("normalizes old applications without action sources", () => {
  const data = sampleData();
  data.knowledgeApplications.push({
    id: "old",
    problem: "旧问题",
    toolIds: ["tool-1"],
    selectedActions: ["旧行动"],
    status: "open",
    createdAt: "2026-07-01T00:00:00.000Z"
  });
  saveLocalWorkbenchData(data);
  expect(loadLocalWorkbenchData().knowledgeApplications[0].selectedActionSources).toEqual([]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- tests/domain/local-store.test.ts`

Expected: FAIL because action sources are not persisted or normalized.

- [ ] **Step 3: Implement backward-compatible storage**

Add the new type and optional field, pass it through `saveKnowledgeApplication`, and normalize missing values with:

```ts
selectedActionSources: Array.isArray(application.selectedActionSources)
  ? application.selectedActionSources
  : []
```

Keep `selectedActions` unchanged for existing history rendering.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd test -- tests/domain/local-store.test.ts`

Expected: all local-store tests pass.

---

### Task 3: 推荐结果多选与返回恢复

**Files:**
- Modify: `src/app/knowledge/page.tsx`
- Modify: `src/app/knowledge/tools/[toolId]/page.tsx`
- Test: `tests/domain/knowledge-solve.test.ts`

**Interfaces:**
- Consumes: Task 1 selection helpers.
- Produces route: `/knowledge/solve?problem=<encoded>&toolIds=<comma-separated>`.

- [ ] **Step 1: Add a failing query builder test**

Extend `knowledge-solve.ts` with planned interface:

```ts
export function buildCombinedSolveHref(problem: string, toolIds: string[]): string;
```

Test:

```ts
expect(buildCombinedSolveHref("是否降价？", ["a", "b"]))
  .toBe("/knowledge/solve?problem=%E6%98%AF%E5%90%A6%E9%99%8D%E4%BB%B7%EF%BC%9F&toolIds=a%2Cb");
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm.cmd test -- tests/domain/knowledge-solve.test.ts`

Expected: FAIL because `buildCombinedSolveHref` is missing.

- [ ] **Step 3: Implement query restoration and result selection**

In `KnowledgePage`:

- Read `problem` with `useSearchParams`.
- On initial data load, restore the problem, run `matchDecisionTools`, and select the first two non-legacy results.
- Add `selectedToolIds` and `selectionMessage` state.
- Add a checkbox to each non-legacy result card.
- Show “已选择 N/3”、“清空选择”和“组合使用已选工具”。
- Disable combination when no tools are selected.
- Preserve the existing single-tool detail link.

In the single-tool page, replace the book-only return target with:

```tsx
<Link href={problem ? buildKnowledgeReturnHref(problem) : book ? `/knowledge/books/${book.id}` : "/knowledge"}>
  {problem ? "返回推荐结果" : `返回${book?.title || "商业知识"}`}
</Link>
```

- [ ] **Step 4: Run domain tests and type check**

Run: `npm.cmd test -- tests/domain/knowledge-solve.test.ts && npx.cmd tsc --noEmit`

Expected: tests and type check pass.

---

### Task 4: 组合决策工作区

**Files:**
- Create: `src/app/knowledge/solve/page.tsx`
- Modify: `src/app/knowledge/page.tsx`
- Modify: `src/app/knowledge/tools/[toolId]/page.tsx`
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/domain/local-store.test.ts`

**Interfaces:**
- Consumes: `parseSelectedToolIds`, `buildKnowledgeReturnHref`, `saveKnowledgeApplication`, `createTaskFromKnowledgeAction`.
- Saves: one application with all valid tool IDs and selected action sources.

- [ ] **Step 1: Add failing duplicate-action persistence test**

```ts
it("keeps action sources while deduplicating legacy selected action text", () => {
  const application = saveKnowledgeApplication({
    problem: "是否降价",
    toolIds: ["tool-1", "tool-2"],
    selectedActions: ["验证需求", "验证需求"],
    selectedActionSources: [
      { toolId: "tool-1", toolName: "工具一", action: "验证需求" },
      { toolId: "tool-2", toolName: "工具二", action: "验证需求" }
    ]
  });
  expect(application.selectedActions).toEqual(["验证需求"]);
  expect(application.selectedActionSources).toHaveLength(2);
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm.cmd test -- tests/domain/local-store.test.ts`

Expected: FAIL because selected action text is not deduplicated.

- [ ] **Step 3: Implement the combination page**

The client page must:

- Read `problem` and `toolIds` from the URL.
- Load local data, ignore invalid IDs, and preserve URL order.
- Redirect to the restored recommendation page when no valid tools remain.
- Render each tool as an unframed full-width section with its matching framework fields.
- Render action checkboxes with tool name visible.
- Keep one `diagnosis` textarea labelled “综合判断”.
- Save one application with all tool IDs and structured action sources.
- Generate one task per selected action source using its tool ID.
- Provide “返回重新选择”、“仅保存应用记录”和“保存并生成待办”.

- [ ] **Step 4: Implement action text deduplication**

Inside `saveKnowledgeApplication`:

```ts
selectedActions: [...new Set(input.selectedActions.map((item) => item.trim()).filter(Boolean))]
```

Do not deduplicate `selectedActionSources`; two tools may recommend the same action for different reasons.

- [ ] **Step 5: Run focused tests and type check**

Run: `npm.cmd test -- tests/domain/knowledge-solve.test.ts tests/domain/local-store.test.ts && npx.cmd tsc --noEmit`

Expected: all focused tests and type check pass.

---

### Task 5: Full verification and browser acceptance

**Files:**
- Verify all modified files.

**Interfaces:**
- Validates the end-to-end behavior defined in the design spec.

- [ ] **Step 1: Run all automated tests**

Run: `npm.cmd test`

Expected: all test files and tests pass.

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`

Expected: Next.js build, lint, type checking, and static generation complete with exit code 0.

- [ ] **Step 3: Restart the development server and verify HTTP**

Restart the local server after the production build clears or replaces `.next`, then request `http://127.0.0.1:3000/knowledge`.

Expected: HTTP 200.

- [ ] **Step 4: Verify the browser workflow**

Use a real question and confirm:

1. The top two tools are selected by default.
2. A fourth selection is blocked with a Chinese message.
3. Opening one tool and returning restores the question and recommendations.
4. Combining two tools displays both frameworks separately.
5. Saving creates one application record linked to both tools.
6. Selected actions generate source-aware tasks.
7. Desktop and narrow viewport layouts contain no overlapping text.

- [ ] **Step 5: Review the final diff**

Run: `git diff --check` and inspect only files in this plan. Do not revert unrelated existing worktree changes.
