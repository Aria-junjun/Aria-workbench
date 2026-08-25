# 待办截止日期与工作台内提醒 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为待办增加标准截止日期和工作台内到期提醒，同时兼容旧的自然语言时间。

**Architecture:** 在 `LocalTask` 上增加可选 `dueDate` 字段；将日期状态计算放在待办页面使用的纯函数中；新建、编辑表单使用原生 `input type="date"`，展示层按本地日期实时计算状态，不把计算结果写入持久化数据。

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Tailwind CSS.

## Global Constraints

- 不删除或重写已有 `dueText` 数据。
- 不引入通知服务、第三方日历或新的依赖。
- 逾期统计只针对未完成待办。
- 日期计算使用本地日期，标准格式为 `YYYY-MM-DD`。

---

### Task 1: 日期状态纯函数

**Files:**
- Create: `C:/Users/Administrator/Documents/店铺/Aria-workbench-main/src/features/workbench/task-due.ts`
- Test: `C:/Users/Administrator/Documents/店铺/Aria-workbench-main/tests/domain/task-due.test.ts`

**Interfaces:**
- `getTaskDueState(task: Pick<LocalTask, "dueDate" | "status">, today?: Date): TaskDueState`
- `TaskDueState = "none" | "normal" | "due_today" | "due_soon" | "overdue"`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { getTaskDueState } from "@/features/workbench/task-due";

const today = new Date(2026, 7, 25, 12);

describe("getTaskDueState", () => {
  it("classifies overdue, today, soon, normal and empty dates", () => {
    expect(getTaskDueState({ status: "open", dueDate: "2026-08-24" }, today)).toBe("overdue");
    expect(getTaskDueState({ status: "open", dueDate: "2026-08-25" }, today)).toBe("due_today");
    expect(getTaskDueState({ status: "open", dueDate: "2026-08-27" }, today)).toBe("due_soon");
    expect(getTaskDueState({ status: "open", dueDate: "2026-09-01" }, today)).toBe("normal");
    expect(getTaskDueState({ status: "open" }, today)).toBe("none");
  });

  it("does not remind for completed tasks", () => {
    expect(getTaskDueState({ status: "done", dueDate: "2026-08-20" }, today)).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/task-due.test.ts`
Expected: FAIL because `task-due.ts` and `getTaskDueState` do not exist.

- [ ] **Step 3: Write minimal implementation**

Implement local-date normalization and compare calendar-day differences. Return `none` for completed or missing dates, `overdue` for negative differences, `due_today` for zero, `due_soon` for 1–3, and `normal` otherwise.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/domain/task-due.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/features/workbench/task-due.ts tests/domain/task-due.test.ts; git commit -m "feat: add task due date state calculation"`

### Task 2: 持久化字段与新建/编辑表单

**Files:**
- Modify: `C:/Users/Administrator/Documents/店铺/Aria-workbench-main/src/features/workbench/local-store.ts:161-178`
- Modify: `C:/Users/Administrator/Documents/店铺/Aria-workbench-main/src/app/tasks/page.tsx:50-225`
- Test: `C:/Users/Administrator/Documents/店铺/Aria-workbench-main/tests/ui/tasks-page.test.tsx`

**Interfaces:**
- Add `dueDate?: string` to `LocalTask`.
- New and edit drafts carry `dueDate: string`.

- [ ] **Step 1: Write the failing test**

Add UI assertions that the create and edit forms render a date input, and that a saved task retains `dueDate` when the page state is updated.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/tasks-page.test.tsx`
Expected: FAIL because the forms currently render text inputs with the “截止时间” placeholder.

- [ ] **Step 3: Write minimal implementation**

Add `dueDate` to `LocalTask`, create draft, edit draft, reset paths, new task construction, and edit form. Use `<input type="date">`; keep `dueText` read-only compatibility for old records and use `dueDate || dueText` for display fallback.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/tasks-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/features/workbench/local-store.ts src/app/tasks/page.tsx tests/ui/tasks-page.test.tsx; git commit -m "feat: add selectable task due dates"`

### Task 3: 工作台内提醒摘要与卡片状态

**Files:**
- Modify: `C:/Users/Administrator/Documents/店铺/Aria-workbench-main/src/app/tasks/page.tsx`
- Modify: `C:/Users/Administrator/Documents/店铺/Aria-workbench-main/src/components/app-shell.tsx` only if the existing task badge needs the computed counts.
- Test: `C:/Users/Administrator/Documents/店铺/Aria-workbench-main/tests/ui/tasks-page.test.tsx`

**Interfaces:**
- Consume `getTaskDueState` from Task 1.
- Add page-local counts for `overdue` and `due_soon` among open tasks.

- [ ] **Step 1: Write the failing test**

Add tests that an overdue open task renders “已逾期”, a task due within three days renders “即将到期”, and a completed overdue task does not increase the summary counts.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/tasks-page.test.tsx`
Expected: FAIL because no due-state labels or counts exist.

- [ ] **Step 3: Write minimal implementation**

Compute states at render time with `new Date()`, add a compact summary beside the page heading, and render state labels next to each task date. Add click filters only if the existing filter model can support them without changing persisted data; otherwise keep the summary informational and let the existing search show the task list.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/tasks-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run regression verification**

Run: `npm test; npx tsc --noEmit; npm run build`
Expected: all tests pass, TypeScript exits 0, and production build completes.

- [ ] **Step 6: Commit**

Run: `git add src/app/tasks/page.tsx src/components/app-shell.tsx tests/ui/tasks-page.test.tsx; git commit -m "feat: show task due reminders in workbench"`
