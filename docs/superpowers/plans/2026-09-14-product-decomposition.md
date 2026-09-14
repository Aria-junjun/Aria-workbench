# 产品拆解模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工作台中新增一个独立、可关联产品但不依赖产品档案的“产品拆解”模块，覆盖定位、目标范围、原因拆解、方案优先级和行动计划五个阶段。

**Architecture:** 沿用现有 `features/workbench` 领域文件、`LocalWorkbenchData` 本地优先存储、`useWorkbenchData` 响应式快照和现有云端同步。领域计算与持久化函数独立于 React 页面；页面采用“项目台账 + 新建表单 + 五步工作区 + 结果报告”的结构。跨模块只存引用ID，不复制行业洞察、需求探索或竞品分析的内容。

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright-compatible existing UI test setup.

## Global Constraints

- 产品拆解五步的页面名称必须是“定位与中心问题、目标与范围、原因拆解、方案与优先级、行动计划”。
- 不得把白板贴写死为通用项目名称、字段名称或领域类型；白板贴只出现在灰色示例文案中。
- Kano分类只能由执行人确认，系统只保存、展示和排序，不自动给出唯一分类。
- 归档必须可恢复，不做不可逆删除。
- 不实现甘特图、干系人矩阵、任务依赖和项目排期；这些属于后续项目推进模块。
- 新集合缺失时必须按空数组兼容旧本地数据和旧云端快照。
- 修改前先写失败测试并观察失败；每个任务完成后运行对应测试和完整测试。
- 保留当前工作区已有的未提交修改，不重置、不覆盖、不清理无关文件。

---

### Task 1: 建立产品拆解领域模型和计算函数

**Files:**
- Create: `src/features/workbench/product-decomposition.ts`
- Create: `tests/domain/product-decomposition.test.ts`

**Interfaces:**
- Produces `ProductDecompositionProject`, `createProductDecompositionProject`, `updateProductDecompositionProject`, `addProductDecompositionScopeItem`, `addProductDecompositionCause`, `addProductDecompositionSolution`, `addProductDecompositionAction`, `getProductDecompositionCompleteness`, `buildProductDecompositionReport` for the storage and UI tasks.

- [ ] **Step 1: Write the failing domain test**

```ts
import { describe, expect, it } from "vitest";
import {
  addProductDecompositionCause,
  addProductDecompositionSolution,
  createProductDecompositionProject,
  getProductDecompositionCompleteness,
} from "@/features/workbench/product-decomposition";

describe("product decomposition domain", () => {
  it("creates an unlinked project with five draft steps", () => {
    const project = createProductDecompositionProject({
      title: "白板贴重复使用体验拆解",
      targetUsers: "家庭办公用户",
      scenario: "会议结束后擦除并继续使用",
      centralQuestion: "怎样降低擦除残留对下一次书写的影响？",
      decisionGoal: "判断优先改善的产品能力",
    });

    expect(project.linkedProductId).toBeUndefined();
    expect(Object.values(project.steps)).toEqual(["draft", "draft", "draft", "draft", "draft"]);
    expect(getProductDecompositionCompleteness(project).complete).toBe(false);
  });

  it("keeps cause and solution relations explicit", () => {
    const project = createProductDecompositionProject({ title: "测试拆解", centralQuestion: "测试问题" });
    const withCause = addProductDecompositionCause(project, {
      title: "擦除行为",
      parentId: undefined,
      level: "major",
      fact: "用户需要在会议后擦除内容",
      judgment: "擦除体验影响重复使用",
      evidence: "用户反馈记录",
    });
    const causeId = withCause.causeNodes[0].id;
    const withSolution = addProductDecompositionSolution(withCause, {
      causeNodeId: causeId,
      title: "补充擦除效果验证",
      description: "用真实书写和擦除结果验证残留程度",
      kano: "unclassified",
      priority: 1,
    });

    expect(withSolution.solutions[0].causeNodeId).toBe(causeId);
    expect(withSolution.solutions[0].kano).toBe("unclassified");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/domain/product-decomposition.test.ts`

Expected: FAIL because `@/features/workbench/product-decomposition` does not exist.

- [ ] **Step 3: Implement the minimal domain model**

Create the following exported types and functions:

```ts
export type ProductDecompositionStatus = "draft" | "in_progress" | "completed" | "archived";
export type ProductDecompositionStepKey = "positioning" | "scope" | "causes" | "solutions" | "actions";
export type ProductDecompositionStepStatus = "draft" | "in_progress" | "completed";
export type ProductDecompositionKano = "must_be" | "performance" | "attractive" | "indifferent" | "unclassified";
export type ProductDecompositionActionStatus = "not_started" | "in_progress" | "completed" | "paused";

export type ProductDecompositionProject = {
  id: string;
  title: string;
  linkedProductId?: string;
  targetUsers: string;
  scenario: string;
  centralQuestion: string;
  decisionGoal: string;
  status: ProductDecompositionStatus;
  currentStep: ProductDecompositionStepKey;
  steps: Record<ProductDecompositionStepKey, ProductDecompositionStepStatus>;
  positioning: { productValue: string; userNeed: string; decisionScope: string };
  scopeItems: Array<{ id: string; title: string; problem: string; inScope: boolean; judgment: string; evidence: string }>;
  causeNodes: Array<{ id: string; parentId?: string; level: "major" | "minor" | "terminal"; title: string; fact: string; judgment: string; evidence: string; gap: string; solutionDirection: string }>;
  solutions: Array<{ id: string; causeNodeId?: string; title: string; description: string; userProblem: string; evidence: string; kano: ProductDecompositionKano; priority: number; status: "candidate" | "selected" | "deferred" }>;
  actionItems: Array<{ id: string; solutionId?: string; title: string; deliverable: string; prerequisite: string; owner: string; status: ProductDecompositionActionStatus; note: string }>;
  sourceIndustryInsightIds: string[];
  sourceDemandItemIds: string[];
  sourceCompetitorEvidenceIds: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};
```

`createProductDecompositionProject` must trim inputs, create empty arrays, set all steps to `draft`, set `currentStep` to `positioning`, and set timestamps. The add functions must append a generated ID, preserve the existing project ID, and update `updatedAt`. `getProductDecompositionCompleteness` must return `{ complete, missing, filled, total }` using the required project title, central question, positioning content, one scope item, one cause node, one solution and one action. `buildProductDecompositionReport` must return sections for positioning, scope, causes, solutions, actions, evidence gaps and source references; empty sections must say `尚未形成记录` rather than inventing conclusions.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- tests/domain/product-decomposition.test.ts`

Expected: PASS with both domain behaviors passing.

- [ ] **Step 5: Commit the domain unit**

```bash
git add src/features/workbench/product-decomposition.ts tests/domain/product-decomposition.test.ts
git commit -m "feat: add product decomposition domain model"
```

### Task 2: Add local persistence, normalization, and product references

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Create: `tests/domain/product-decomposition-storage.test.ts`

**Interfaces:**
- Consumes `ProductDecompositionProject` and domain helpers from Task 1.
- Produces `loadProductDecompositionProjects`, `saveProductDecompositionProject`, `updateProductDecompositionProjectRecord`, and `archiveProductDecompositionProject`.

- [ ] **Step 1: Write the failing storage test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createProductDecompositionProject } from "@/features/workbench/product-decomposition";
import { loadLocalWorkbenchData, loadProductDecompositionProjects, saveProductDecompositionProject } from "@/features/workbench/local-store";

describe("product decomposition persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("loads a missing collection as an empty list and saves a project without changing legacy collections", () => {
    const before = loadLocalWorkbenchData();
    const project = createProductDecompositionProject({ title: "本地保存测试", centralQuestion: "测试问题" });
    saveProductDecompositionProject(project);
    const after = loadLocalWorkbenchData();

    expect(loadProductDecompositionProjects()).toHaveLength(1);
    expect(after.products).toEqual(before.products);
    expect(after.productDecompositionProjects?.[0].id).toBe(project.id);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/domain/product-decomposition-storage.test.ts`

Expected: FAIL because the collection and persistence functions do not exist.

- [ ] **Step 3: Add the optional collection and normalization**

Add `productDecompositionProjects?: ProductDecompositionProject[]` to `LocalWorkbenchData`. Add `productDecompositionProjects: []` to `emptyData()`. In `normalizeWorkbenchData`, normalize with `Array.isArray(data.productDecompositionProjects) ? data.productDecompositionProjects : []`. Add the four persistence functions beside the existing industry insight persistence functions; each write must call `saveLocalWorkbenchData` so the existing snapshot and sync behavior remains active.

- [ ] **Step 4: Run storage and legacy compatibility tests**

Run: `npm test -- tests/domain/product-decomposition-storage.test.ts tests/ui/cloud-parity-contract.test.ts`

Expected: PASS, with the new collection defaulting to an empty array and existing cloud parity contracts unchanged.

- [ ] **Step 5: Commit persistence**

```bash
git add src/features/workbench/local-store.ts tests/domain/product-decomposition-storage.test.ts
git commit -m "feat: persist product decomposition projects"
```

### Task 3: Add navigation, project ledger, and intake form

**Files:**
- Modify: `src/components/app-shell.tsx`
- Create: `src/app/product-decomposition/page.tsx`
- Create: `src/app/product-decomposition/new/page.tsx`
- Create: `src/components/workbench/product-decomposition/decomposition-home.tsx`
- Create: `src/components/workbench/product-decomposition/decomposition-intake-form.tsx`
- Create: `tests/ui/product-decomposition-home.test.tsx`

**Interfaces:**
- Consumes storage functions from Task 2 and the existing `useWorkbenchData` pattern.
- Produces links to `/product-decomposition/new` and `/product-decomposition/[projectId]`.

- [ ] **Step 1: Write the failing UI tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecompositionHome } from "@/components/workbench/product-decomposition/decomposition-home";

describe("product decomposition home", () => {
  it("shows the independent module and empty-state action", () => {
    render(<DecompositionHome />);
    expect(screen.getByRole("heading", { name: "产品拆解" })).toBeInTheDocument();
    expect(screen.getByText("还没有产品拆解项目。先明确一个产品问题。" )).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新建产品拆解" })).toHaveAttribute("href", "/product-decomposition/new");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/ui/product-decomposition-home.test.tsx`

Expected: FAIL because the route and component do not exist.

- [ ] **Step 3: Implement the ledger and intake page**

Follow the existing `industry-insight` ledger pattern. The table columns must be `项目、关联产品、中心问题、完成阶段、方案数、行动项、状态、操作`. The home page must separate active and archived projects, use “归档/恢复” actions, and never display a destructive delete action. The intake form must use placeholders and short hints; the whiteboard example may appear only as gray helper text. On submit, create a project, save it, and route to `/product-decomposition/[id]`.

Add the navigation item `产品拆解` after `竞品分析` in the product lifecycle group.

- [ ] **Step 4: Run the focused UI test**

Run: `npm test -- tests/ui/product-decomposition-home.test.tsx`

Expected: PASS with the module title, empty state, and new-project link rendered.

- [ ] **Step 5: Commit the module entry**

```bash
git add src/components/app-shell.tsx src/app/product-decomposition src/components/workbench/product-decomposition/decomposition-home.tsx src/components/workbench/product-decomposition/decomposition-intake-form.tsx tests/ui/product-decomposition-home.test.tsx
git commit -m "feat: add product decomposition project ledger"
```

### Task 4: Build the five-step workspace with editable structured inputs

**Files:**
- Create: `src/app/product-decomposition/[projectId]/page.tsx`
- Create: `src/components/workbench/product-decomposition/decomposition-workspace.tsx`
- Create: `src/components/workbench/product-decomposition/step-navigation.tsx`
- Create: `src/components/workbench/product-decomposition/positioning-step.tsx`
- Create: `src/components/workbench/product-decomposition/scope-step.tsx`
- Create: `src/components/workbench/product-decomposition/causes-step.tsx`
- Create: `src/components/workbench/product-decomposition/solutions-step.tsx`
- Create: `src/components/workbench/product-decomposition/actions-step.tsx`
- Create: `tests/ui/product-decomposition-workspace.test.tsx`

**Interfaces:**
- Consumes the domain mutation functions from Task 1 and persistence functions from Task 2.
- Produces an editable project state and links to the report view.

- [ ] **Step 1: Write the failing workspace test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createProductDecompositionProject } from "@/features/workbench/product-decomposition";
import { DecompositionWorkspace } from "@/components/workbench/product-decomposition/decomposition-workspace";

describe("product decomposition workspace", () => {
  it("uses the five non-overlapping workflow labels", () => {
    const project = createProductDecompositionProject({ title: "测试拆解", centralQuestion: "测试问题" });
    render(<DecompositionWorkspace project={project} />);
    expect(screen.getByText("定位与中心问题")).toBeInTheDocument();
    expect(screen.getByText("目标与范围")).toBeInTheDocument();
    expect(screen.getByText("原因拆解")).toBeInTheDocument();
    expect(screen.getByText("方案与优先级")).toBeInTheDocument();
    expect(screen.getByText("行动计划")).toBeInTheDocument();
    expect(screen.queryByText("战略层")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/ui/product-decomposition-workspace.test.tsx`

Expected: FAIL because the workspace component does not exist.

- [ ] **Step 3: Implement workspace state and each step**

Use a left step navigation and a single main content panel, matching the existing analysis workspaces. Each step must save independently through `saveProductDecompositionProject`. The cause step must support adding/editing major, minor and terminal nodes with `parentId`; after every save, show a compact structured list and a read-only fishbone preview. The solution step must offer the five Kano values and numeric priority; it must display the explanation “分类由执行人确认，系统不替代判断”. The action step must support the four statuses but must not ask for dates, dependencies or milestones.

Every input must include a gray placeholder and a short example below the field. Examples should use generic “产品/用户/场景” language, with whiteboard content only as optional case text.

- [ ] **Step 4: Run focused workspace tests**

Run: `npm test -- tests/ui/product-decomposition-workspace.test.tsx tests/domain/product-decomposition.test.ts`

Expected: PASS, including editable step labels, save interactions, cause-to-solution relation and Kano preservation.

- [ ] **Step 5: Commit the workspace**

```bash
git add src/app/product-decomposition/[projectId] src/components/workbench/product-decomposition tests/ui/product-decomposition-workspace.test.tsx
git commit -m "feat: add product decomposition workspace"
```

### Task 5: Add report view, source references, and cloud-safe regression coverage

**Files:**
- Create: `src/components/workbench/product-decomposition/decomposition-report.tsx`
- Create: `src/app/product-decomposition/[projectId]/report/page.tsx`
- Modify: `src/features/workbench/product-decomposition.ts`
- Create: `tests/ui/product-decomposition-report.test.tsx`
- Modify: `tests/ui/cloud-parity-contract.test.ts`

**Interfaces:**
- Consumes `buildProductDecompositionReport` and the project’s source reference arrays.
- Produces a read-only report with explicit fact/judgment/solution/action sections and missing-data notices.

- [ ] **Step 1: Write the failing report test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createProductDecompositionProject, addProductDecompositionCause, addProductDecompositionSolution } from "@/features/workbench/product-decomposition";
import { DecompositionReport } from "@/components/workbench/product-decomposition/decomposition-report";

describe("product decomposition report", () => {
  it("distinguishes evidence, judgment, solution and action", () => {
    const base = createProductDecompositionProject({ title: "测试拆解", centralQuestion: "测试问题" });
    const withCause = addProductDecompositionCause(base, { title: "擦除行为", level: "major", fact: "事实", judgment: "判断", evidence: "证据" });
    const project = addProductDecompositionSolution(withCause, { causeNodeId: withCause.causeNodes[0].id, title: "验证方案", description: "方案描述", kano: "unclassified", priority: 1 });
    render(<DecompositionReport project={project} />);
    expect(screen.getByRole("heading", { name: "产品拆解结果" })).toBeInTheDocument();
    expect(screen.getByText("事实与依据")).toBeInTheDocument();
    expect(screen.getByText("当前判断")).toBeInTheDocument();
    expect(screen.getByText("方案与优先级")).toBeInTheDocument();
    expect(screen.getByText("行动计划")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/ui/product-decomposition-report.test.tsx`

Expected: FAIL because the report component and route do not exist.

- [ ] **Step 3: Implement the report**

Render the report from the pure domain report builder. Show linked product when present, otherwise show `未关联产品`. Show source reference counts and links/labels for industry insight, demand items and competitor evidence without copying their content. Empty sections must display `尚未形成记录` plus the next action needed. Provide a link back to the workspace and a print-friendly layout, but do not generate a file download in this phase.

- [ ] **Step 4: Verify cloud-safe normalization and report behavior**

Run: `npm test -- tests/ui/product-decomposition-report.test.tsx tests/ui/cloud-parity-contract.test.ts tests/domain/product-decomposition-storage.test.ts`

Expected: PASS; missing `productDecompositionProjects` in a cloud snapshot must normalize to `[]`, and saving the new collection must not remove legacy data.

- [ ] **Step 5: Commit the report**

```bash
git add src/features/workbench/product-decomposition.ts src/components/workbench/product-decomposition/decomposition-report.tsx src/app/product-decomposition/[projectId]/report/page.tsx tests/ui/product-decomposition-report.test.tsx tests/ui/cloud-parity-contract.test.ts
git commit -m "feat: add product decomposition report"
```

### Task 6: Full verification and visual smoke test

**Files:**
- Modify only if verification exposes a regression: affected implementation or test files from Tasks 1-5.

- [ ] **Step 1: Run the complete automated test suite**

Run: `npm test`

Expected: exit code 0 with no failed tests.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: exit code 0 and Next.js generates routes for `/product-decomposition`, `/product-decomposition/new`, `/product-decomposition/[projectId]`, and `/product-decomposition/[projectId]/report`.

- [ ] **Step 3: Run the local visual smoke test**

Open `/product-decomposition`, create an unlinked sample project, save each step, add one cause, one solution and one action, reload the page, open the report, and confirm the project remains editable and the report distinguishes the four content types. Also open `/demand-exploration`, `/competitor-analysis` and `/industry-insight` to confirm their entry pages still load.

- [ ] **Step 4: Check the final diff and preserve unrelated changes**

Run: `git status --short; git diff --stat HEAD~5..HEAD`

Expected: only product decomposition commits contain the new module files; pre-existing supplier changes remain untouched.

- [ ] **Step 5: Commit any verification-only fixes**

```bash
git add src/features/workbench/product-decomposition.ts src/features/workbench/local-store.ts src/components/workbench/product-decomposition src/app/product-decomposition src/components/app-shell.tsx tests/domain/product-decomposition.test.ts tests/domain/product-decomposition-storage.test.ts tests/ui/product-decomposition-home.test.tsx tests/ui/product-decomposition-workspace.test.tsx tests/ui/product-decomposition-report.test.tsx tests/ui/cloud-parity-contract.test.ts
git commit -m "test: verify product decomposition workflow"
```
