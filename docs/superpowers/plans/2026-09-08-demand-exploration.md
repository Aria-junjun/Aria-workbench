# 需求探索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有工作台中新增独立的“需求探索”板块，让执行人按课件节奏完成 KANO 需求分析，并能追溯问题、矩阵、统计、公式和四象限结果。

**Architecture:** 新增一个独立的需求探索领域模块，不复用供应商绩效评分逻辑。KANO 矩阵映射、统计、SI/DSI 计算和四象限坐标全部放在纯函数中；Next 页面负责向导式呈现和单独环节入口；分析记录通过现有 local-store 保存，沿用工作台的本地优先和云端同步机制。HMW、竞品分析只显示未开放入口，不参与本期数据流。

**Tech Stack:** Next.js App Router、React、TypeScript、Tailwind CSS、Zod（若领域校验需要）、Vitest、现有 `local-store` 与 `workbench-store`。

## Global Constraints

- 第一版只实现课件已讲的提出需求、KANO 问题、对照矩阵、多人统计、BI/SI、四象限和结果记录。
- 允许跳过教学说明，但每个环节必须保留可重新打开的模型解释。
- 系统不得自动替执行人生成完整问题，只做结构校验、分类、计算和解释。
- `R`、`Q` 不进入 SI/DSI 分母，但必须在结果和数据质量提示中呈现。
- 无有效样本时显示 `N/A` 或“待收集回答”，不能生成虚假结论。
- 新数据结构独立于供应商绩效、ERP 和产品经营数据；关联产品或产品族为可选字段。
- 现有未提交改动属于用户工作，实施时只能修改本计划列出的相关文件。

---

### Task 1: 建立 KANO 领域模型和纯计算规则

**Files:**
- Create: `src/features/workbench/demand-exploration.ts`
- Test: `tests/domain/demand-exploration.test.ts`

**Interfaces:**
- Produces `KanoCategory = "A" | "O" | "M" | "I" | "R" | "Q"`。
- Produces `KanoAnswer = "like" | "must" | "neutral" | "accept" | "dislike"`。
- Produces `KanoDemandAnalysis`, `KanoResponse`, `KanoCounts`, `KanoScore` types。
- Produces `classifyKanoResponse(functional, dysfunctional): KanoCategory`。
- Produces `summarizeKanoResponses(responses): KanoCounts`。
- Produces `calculateKanoScores(counts): { denominator: number; si: number | null; dsi: number | null }`。
- Produces `calculateQuadrantPosition(score, meanSi, meanDsi)`。

- [ ] **Step 1: Write failing tests for the course matrix**

测试必须覆盖课件中的五级回答组合，并验证至少：

```ts
expect(classifyKanoResponse("like", "dislike")).toBe("A");
expect(classifyKanoResponse("must", "dislike")).toBe("O");
expect(classifyKanoResponse("dislike", "must")).toBe("R");
expect(classifyKanoResponse("neutral", "neutral")).toBe("I");
expect(classifyKanoResponse("like", "like")).toBe("Q");
```

另测统计、R/Q 排除分母、空样本返回 `null` 和四象限边界。

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run tests/domain/demand-exploration.test.ts`

Expected: FAIL because the domain module and functions do not exist。

- [ ] **Step 3: Implement the pure domain module**

用显式的 5×5 `Record<KanoAnswer, Record<KanoAnswer, KanoCategory>>` 映射实现分类；统计只接受合法回答；分母使用 `A + O + M + I`；当分母为 0 时 SI/DSI 为 `null`，不使用 0 代替缺失数据。

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run tests/domain/demand-exploration.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit the domain module**

```bash
git add src/features/workbench/demand-exploration.ts tests/domain/demand-exploration.test.ts
git commit -m "feat: add kano demand exploration rules"
```

### Task 2: 接入独立分析记录的本地持久化

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Modify: `src/features/workbench/workbench-store.ts` only if its snapshot type requires the new collection
- Test: `tests/domain/local-store.test.ts`

**Interfaces:**
- Extend `LocalWorkbenchData` with `demandExplorations: KanoDemandAnalysis[]`.
- Add `createDemandExploration(input): KanoDemandAnalysis`。
- Add `saveDemandExploration(analysis): void`。
- Add `updateDemandExploration(id, patch): void`。
- Add `loadDemandExplorations(): KanoDemandAnalysis[]`。

- [ ] **Step 1: Add failing persistence tests**

验证新集合在空数据、旧快照和保存/更新场景下都能被 normalize；验证已有供应商、货盘和产品数据不受影响。

- [ ] **Step 2: Run the focused persistence tests**

Run: `npx vitest run tests/domain/local-store.test.ts -t "demand exploration"`

Expected: FAIL until the collection and helpers exist。

- [ ] **Step 3: Implement the smallest compatible persistence extension**

使用现有 localStorage key 和 `saveLocalWorkbenchData` 保存路径，不新建第二套数据库；旧数据缺少该字段时归一化为空数组；保存分析记录时保留草稿状态和原始回答。

- [ ] **Step 4: Run regression tests**

Run: `npx vitest run tests/domain/local-store.test.ts tests/domain/demand-exploration.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit the persistence boundary**

```bash
git add src/features/workbench/local-store.ts src/features/workbench/workbench-store.ts tests/domain/local-store.test.ts
git commit -m "feat: persist demand exploration analyses"
```

### Task 3: 新增“需求探索”导航和分析首页

**Files:**
- Modify: `src/components/app-shell.tsx`
- Create: `src/app/demand-exploration/page.tsx`
- Create: `src/components/workbench/demand-exploration/exploration-home.tsx`
- Test: `tests/ui/demand-exploration-navigation.test.tsx`

**Interfaces:**
- Route: `/demand-exploration`。
- Home page reads `loadDemandExplorations()` and renders saved analysis cards。
- Home page exposes independent entries: 提出需求、KANO问题、KANO对照表、多人统计、BI/SI计算、四象限。

- [ ] **Step 1: Write failing navigation/UI tests**

验证侧边栏有“需求探索”入口、进入 `/demand-exploration` 可见板块标题、HMW/竞品入口标记为“后续开放”、空状态可创建第一条分析记录。

- [ ] **Step 2: Run the focused UI tests**

Run: `npx vitest run tests/ui/demand-exploration-navigation.test.tsx`

Expected: FAIL because the route and navigation item do not exist。

- [ ] **Step 3: Implement the route and independent tool cards**

沿用现有 AppShell、页面间距、卡片和按钮样式；首页不把各环节塞成一个长表格；每张卡片显示“独立进入”和“关联分析记录”两个入口；教学说明采用可展开面板，默认不阻塞操作。

- [ ] **Step 4: Run UI tests and type-check**

Run: `npx vitest run tests/ui/demand-exploration-navigation.test.tsx && npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 5: Commit the navigation and home page**

```bash
git add src/components/app-shell.tsx src/app/demand-exploration/page.tsx src/components/workbench/demand-exploration/exploration-home.tsx tests/ui/demand-exploration-navigation.test.tsx
git commit -m "feat: add demand exploration workspace"
```

### Task 4: 实现提出需求和 KANO 问题设计页面

**Files:**
- Create: `src/app/demand-exploration/new/page.tsx`
- Create: `src/app/demand-exploration/[analysisId]/questions/page.tsx`
- Create: `src/components/workbench/demand-exploration/demand-intake-form.tsx`
- Create: `src/components/workbench/demand-exploration/kano-question-form.tsx`
- Create: `src/components/workbench/demand-exploration/learning-panel.tsx`
- Test: `tests/ui/demand-exploration-questions.test.tsx`

**Interfaces:**
- Form creates a draft through `createDemandExploration` and routes to the questions page。
- Question page edits `feature`, `functionalQuestion`, `dysfunctionalQuestion`。
- Validation returns field-level messages without generating replacement questions。

- [ ] **Step 1: Write failing tests for required fields and skip behavior**

验证：可以跳过教学；产品、用户、场景、问题和目标可保存草稿；缺少正向/反向问题时不能进入正式统计；问题包含多个特性时出现提示但不自动改写。

- [ ] **Step 2: Run the focused tests**

Run: `npx vitest run tests/ui/demand-exploration-questions.test.tsx`

Expected: FAIL until pages/components exist。

- [ ] **Step 3: Implement the two forms and reusable learning panel**

学习面板只解释：KANO判断对象、正反问题、五类属性和“不要直接写解决方案”；允许关闭/跳过，并在页面顶部保留重新打开入口。

- [ ] **Step 4: Run UI tests and type-check**

Run: `npx vitest run tests/ui/demand-exploration-questions.test.tsx && npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 5: Commit the guided input pages**

```bash
git add src/app/demand-exploration/new src/app/demand-exploration/[analysisId]/questions src/components/workbench/demand-exploration tests/ui/demand-exploration-questions.test.tsx
git commit -m "feat: add guided kano question design"
```

### Task 5: 实现对照矩阵、多人统计和公式过程

**Files:**
- Create: `src/app/demand-exploration/[analysisId]/matrix/page.tsx`
- Create: `src/app/demand-exploration/[analysisId]/responses/page.tsx`
- Create: `src/app/demand-exploration/[analysisId]/calculation/page.tsx`
- Create: `src/components/workbench/demand-exploration/kano-matrix.tsx`
- Create: `src/components/workbench/demand-exploration/response-entry.tsx`
- Create: `src/components/workbench/demand-exploration/calculation-breakdown.tsx`
- Test: `tests/ui/demand-exploration-calculation.test.tsx`

**Interfaces:**
- Matrix consumes `classifyKanoResponse` and displays the 5×5 course matrix。
- Response entry emits `KanoResponse[]` and preserves invalid rows as `Q`/待修正。
- Calculation breakdown consumes `KanoCounts` and `KanoScore` and renders substituted formulas。

- [ ] **Step 1: Write failing tests for matrix, response counts and formula rendering**

验证：点击/选择一组正反回答能显示对应分类；批量回答统计正确；R/Q 在结果中可见但分母不包含；空样本显示“待收集回答”；页面显示公式代入而非只显示最终数值。

- [ ] **Step 2: Run focused tests**

Run: `npx vitest run tests/ui/demand-exploration-calculation.test.tsx`

Expected: FAIL until the pages and components exist。

- [ ] **Step 3: Implement the matrix and response entry**

矩阵提供学习模式的单元格解释；多人录入先支持逐条填写和粘贴制表符文本，解析失败的行保留并显示错误，不丢弃原始内容；不在本期引入复杂文件解析依赖。

- [ ] **Step 4: Implement calculation breakdown**

显示 A/O/M/I/R/Q 数量、有效分母、SI/DSI 公式、代入值、结果、样本量和数据质量提醒。

- [ ] **Step 5: Run tests and type-check**

Run: `npx vitest run tests/ui/demand-exploration-calculation.test.tsx tests/domain/demand-exploration.test.ts && npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 6: Commit the matrix and calculation pages**

```bash
git add src/app/demand-exploration/[analysisId]/matrix src/app/demand-exploration/[analysisId]/responses src/app/demand-exploration/[analysisId]/calculation src/components/workbench/demand-exploration tests/ui/demand-exploration-calculation.test.tsx
git commit -m "feat: add kano matrix responses and calculation"
```

### Task 6: 实现多需求四象限和结果页

**Files:**
- Create: `src/app/demand-exploration/[analysisId]/quadrant/page.tsx`
- Create: `src/app/demand-exploration/[analysisId]/result/page.tsx`
- Create: `src/components/workbench/demand-exploration/kano-quadrant.tsx`
- Create: `src/components/workbench/demand-exploration/analysis-result.tsx`
- Test: `tests/ui/demand-exploration-result.test.tsx`

**Interfaces:**
- Quadrant consumes multiple scored demand items and renders each point with a detail view。
- Result page renders model result、计算依据和可信度限制三层信息。
- Result page never updates product master status automatically。

- [ ] **Step 1: Write failing tests for quadrant and result evidence**

验证：单个需求提示需要更多需求才能比较；两个及以上需求显示点、平均线和明细；结果页展示分类、公式、样本量、R/Q提示和限制条件。

- [ ] **Step 2: Run focused tests**

Run: `npx vitest run tests/ui/demand-exploration-result.test.tsx`

Expected: FAIL until the pages/components exist。

- [ ] **Step 3: Implement quadrant and result views**

用 CSS/SVG 或现有图表依赖实现可读的四象限，不引入不必要的图表库；点位可点击回看对应需求和计算依据；结果支持保存为已完成分析记录。

- [ ] **Step 4: Run full relevant tests**

Run: `npx vitest run tests/domain/demand-exploration.test.ts tests/domain/local-store.test.ts tests/ui/demand-exploration-navigation.test.tsx tests/ui/demand-exploration-questions.test.tsx tests/ui/demand-exploration-calculation.test.tsx tests/ui/demand-exploration-result.test.tsx && npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 5: Commit the result views**

```bash
git add src/app/demand-exploration/[analysisId]/quadrant src/app/demand-exploration/[analysisId]/result src/components/workbench/demand-exploration tests/ui/demand-exploration-result.test.tsx
git commit -m "feat: add kano quadrant and explainable result"
```

### Task 7: 最终验证和产品内联验收

**Files:**
- Modify only files required by failing verification; do not refactor supplier or product-master modules。
- Test: all existing relevant domain/UI tests plus the new demand exploration tests。

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`

Expected: all existing and new tests pass。

- [ ] **Step 2: Run type and diff checks**

Run: `npx tsc --noEmit` and `git diff --check`

Expected: no TypeScript errors and no whitespace errors。

- [ ] **Step 3: Manually verify the user journey in the local app**

Open `/demand-exploration`, create a draft, skip the learning panel, write a feature and two questions, inspect a matrix cell, add responses, inspect the formula substitution, and verify the result does not change product or supplier data.

- [ ] **Step 4: Verify empty and invalid states**

Check missing questions, zero responses, invalid pasted rows, R/Q-heavy samples, and a single-demand quadrant state. Each state must show an explicit explanation rather than a fake score。

- [ ] **Step 5: Commit final verification fixes if needed**

```bash
git add src/app/demand-exploration src/components/workbench/demand-exploration src/features/workbench/demand-exploration.ts src/features/workbench/local-store.ts src/components/app-shell.tsx tests/domain/demand-exploration.test.ts tests/ui/demand-exploration-*.test.tsx
git commit -m "test: verify demand exploration workflow"
```

