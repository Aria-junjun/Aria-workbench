# 需求确认文档 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将需求探索从单一 KANO 问卷升级为可承载多个功能板块、二级功能和需求项的需求确认文档工作台。

**Architecture:** 新增独立的需求确认文档领域模型，文档下维护功能板块、二级功能、需求项、探索问题、证据和 KANO 回答。旧 `KanoDemandAnalysis` 保留用于兼容历史记录，并转换为一个单需求文档；新界面以文档工作区为主，KANO、SI/DSI 和四象限均从需求项实时汇总。

**Tech Stack:** Next.js App Router、React、TypeScript、Tailwind CSS、Vitest、现有 local-store/workbench-store。

## Global Constraints

- 主页面不展示“跟着课程”“Step 1/6”“本期开放”等课程过程文案。
- 每个需求项拥有独立的探索问题、KANO 问题、回答、计数、SI、DSI 和状态。
- 新增回答只能更新当前需求项，不得覆盖其他需求项。
- KANO 只分析原子化需求项；宽泛需求必须提示拆分，不自动改写。
- 矩阵、四象限和结论都从需求项数据汇总，不维护第二套结果。
- 保留旧 `KanoDemandAnalysis` 的查看和迁移能力，不删除现有数据。
- 只修改本计划涉及的需求探索文件，保留现有供应商和产品板块的未提交改动。

---

### Task 1: 建立需求确认文档领域模型

**Files:**
- Create: `src/features/workbench/demand-confirmation.ts`
- Modify: `src/features/workbench/demand-exploration.ts`
- Test: `tests/domain/demand-confirmation.test.ts`

**Interfaces:**
- `DemandConfirmationDocument`：文档基本信息、`sections`、`demandItems`、状态和时间。
- `DemandSection`：`id`、`name`、`items`。
- `DemandItem`：`id`、`sectionId`、`subFeature`、`needStatement`、探索问题、证据、KANO 问题、回答、统计结果和状态。
- `DemandQuestion`：`id`、`text`、`kind: "exploration" | "functional" | "dysfunctional"`、`required`。
- `createDemandConfirmationDocument(input)`。
- `addDemandItem(document, input)`。
- `addDemandQuestion(document, demandItemId, input)`。
- `appendDemandResponse(document, demandItemId, response)`。
- `summarizeDemandDocument(document)`。

- [ ] **Step 1: Write failing domain tests**

测试必须覆盖：一个文档包含两个板块和三个需求项；需求项可以拥有多条探索问题；每个需求项独立保存 KANO 正反问题和回答；给需求项 A 添加回答不会改变需求项 B；汇总只包含有有效 SI/DSI 的需求项。

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run tests/domain/demand-confirmation.test.ts`

Expected: FAIL because the new domain types and functions do not exist。

- [ ] **Step 3: Implement minimal immutable domain helpers**

所有更新函数返回新文档，不在页面组件内拼接数据。需求项的 `responses`、`counts`、`si`、`dsi` 必须由当前需求项独立计算；文档汇总返回需求项数量、已完成数量、待补证据数量和可比较需求项。

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run tests/domain/demand-confirmation.test.ts tests/domain/demand-exploration.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit the domain model**

```bash
git add src/features/workbench/demand-confirmation.ts src/features/workbench/demand-exploration.ts tests/domain/demand-confirmation.test.ts
git commit -m "feat: add demand confirmation document model"
```

### Task 2: 持久化文档和兼容旧记录

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/domain/local-store.test.ts`

**Interfaces:**
- `LocalWorkbenchData.demandConfirmationDocuments: DemandConfirmationDocument[]`。
- `createDemandConfirmationDocumentRecord(input)`。
- `loadDemandConfirmationDocuments()`。
- `saveDemandConfirmationDocument(document)`。
- `updateDemandConfirmationDocument(id, patch)`。
- `migrateLegacyDemandExploration(analysis): DemandConfirmationDocument`。

- [ ] **Step 1: Write failing persistence tests**

验证旧快照缺少新集合时归一化为空数组；新文档保存/更新后能读取；旧 `KanoDemandAnalysis` 能转换成一个文档和一个需求项；备份和恢复保留新集合。

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/domain/local-store.test.ts -t "demand confirmation"`

Expected: FAIL because the new collection and helpers do not exist。

- [ ] **Step 3: Implement persistence and migration**

沿用现有 localStorage 和云端同步入口。读取时将新文档集合和旧分析记录合并为只读兼容视图；保存新文档时不修改供应商、产品和旧分析数据。

- [ ] **Step 4: Run focused persistence tests**

Run: `npx vitest run tests/domain/local-store.test.ts -t "demand confirmation" tests/domain/demand-confirmation.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit persistence changes**

```bash
git add src/features/workbench/local-store.ts tests/domain/local-store.test.ts
git commit -m "feat: persist demand confirmation documents"
```

### Task 3: 改造需求探索首页和文档工作区

**Files:**
- Modify: `src/components/workbench/demand-exploration/exploration-home.tsx`
- Modify: `src/app/demand-exploration/page.tsx`
- Create: `src/app/demand-exploration/[documentId]/page.tsx`
- Create: `src/components/workbench/demand-exploration/document-workspace.tsx`
- Test: `tests/ui/demand-confirmation-workspace.test.tsx`

**Interfaces:**
- 首页显示需求确认文档卡片和新建入口，不再显示课程阶段卡片。
- 文档工作区显示左侧目录：基本信息、需求结构、需求项、属性矩阵、四象限、确认结论。
- 需求项切换不会改变其他需求项数据。

- [ ] **Step 1: Write failing UI tests**

验证首页不包含“跟着课程”“Step 1/6”“本期开放”；文档详情显示“需求确认文档”“需求结构”“需求项分析”；同一文档可显示多个需求项摘要。

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/ui/demand-confirmation-workspace.test.tsx`

Expected: FAIL because the document workspace does not exist。

- [ ] **Step 3: Implement document home and workspace shell**

使用现有 AppShell 和样式体系；模型说明改为可展开说明，不作为主标题；在文档工作区中提供当前需求项上下文和“新增需求项”入口。

- [ ] **Step 4: Run UI test and type-check**

Run: `npx vitest run tests/ui/demand-confirmation-workspace.test.tsx && npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 5: Commit workspace shell**

```bash
git add src/components/workbench/demand-exploration/exploration-home.tsx src/app/demand-exploration/page.tsx src/app/demand-exploration/[documentId] src/components/workbench/demand-exploration/document-workspace.tsx tests/ui/demand-confirmation-workspace.test.tsx
git commit -m "feat: add demand confirmation workspace"
```

### Task 4: 实现需求结构、探索问题和需求项 KANO 联动

**Files:**
- Create: `src/components/workbench/demand-exploration/demand-structure-editor.tsx`
- Create: `src/components/workbench/demand-exploration/demand-item-editor.tsx`
- Modify: `src/components/workbench/demand-exploration/response-entry.tsx`
- Modify: `src/components/workbench/demand-exploration/kano-question-form.tsx`
- Test: `tests/ui/demand-confirmation-items.test.tsx`

**Interfaces:**
- `DemandStructureEditor` 新增板块、二级功能和需求项。
- `DemandItemEditor` 管理探索问题、证据、KANO 正反问题和当前状态。
- `ResponseEntry` 接收 `documentId` 与 `demandItemId`，只追加当前需求项的回答。

- [ ] **Step 1: Write failing UI tests**

验证：同一文档新增两个需求项；每个需求项可以新增多条探索问题；切换需求项后显示不同的回答数量；新增回答只影响当前需求项；宽泛需求显示拆分提示但不自动修改原文。

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/ui/demand-confirmation-items.test.tsx`

Expected: FAIL because the editors are not present。

- [ ] **Step 3: Implement linked editors**

将需求项 ID 作为所有探索问题、证据和回答的唯一关联键；问题设计页面不再读取全局 `analysisId` 的单条问题字段；新增回答按钮持续可用，批量粘贴解析后追加，不替换已有回答。

- [ ] **Step 4: Run item tests and domain regression tests**

Run: `npx vitest run tests/ui/demand-confirmation-items.test.tsx tests/domain/demand-confirmation.test.ts tests/domain/demand-exploration.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit linked item flow**

```bash
git add src/components/workbench/demand-exploration/demand-structure-editor.tsx src/components/workbench/demand-exploration/demand-item-editor.tsx src/components/workbench/demand-exploration/response-entry.tsx src/components/workbench/demand-exploration/kano-question-form.tsx tests/ui/demand-confirmation-items.test.tsx
git commit -m "feat: link demand items questions and responses"
```

### Task 5: 汇总需求属性矩阵、四象限和确认文档结论

**Files:**
- Create: `src/components/workbench/demand-exploration/demand-attribute-matrix.tsx`
- Modify: `src/components/workbench/demand-exploration/kano-quadrant.tsx`
- Modify: `src/components/workbench/demand-exploration/analysis-result.tsx`
- Create: `src/components/workbench/demand-exploration/document-conclusion.tsx`
- Test: `tests/ui/demand-confirmation-summary.test.tsx`

**Interfaces:**
- `DemandAttributeMatrix` 从文档需求项生成截图对应的功能板块/二级功能/KANO 属性表。
- `KanoQuadrant` 接收当前文档的需求项集合，而不是读取全局分析记录。
- `DocumentConclusion` 输出产品背景、需求明细、优先级、证据限制和待验证项。

- [ ] **Step 1: Write failing summary tests**

验证：多个需求项按功能板块汇总；单个需求项不能生成比较图；两个有效需求项显示两个点；结论页同时显示需求项明细、SI/DSI、证据限制和下一步。

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/ui/demand-confirmation-summary.test.tsx`

Expected: FAIL because the summary components do not consume document-level data。

- [ ] **Step 3: Implement document-level summaries**

矩阵只读需求项结果；四象限使用当前文档的有效需求项和平均线；结论页显示“事实、模型结果、限制、建议动作”四层，不自动写入产品主表。

- [ ] **Step 4: Run summary tests and type-check**

Run: `npx vitest run tests/ui/demand-confirmation-summary.test.tsx tests/ui/demand-exploration-*.test.tsx && npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 5: Commit summaries**

```bash
git add src/components/workbench/demand-exploration/demand-attribute-matrix.tsx src/components/workbench/demand-exploration/kano-quadrant.tsx src/components/workbench/demand-exploration/analysis-result.tsx src/components/workbench/demand-exploration/document-conclusion.tsx tests/ui/demand-confirmation-summary.test.tsx
git commit -m "feat: summarize demand confirmation document"
```

### Task 6: 兼容旧页面、完整验证和本地验收

**Files:**
- Modify only files required by failing demand-confirmation verification.
- Test: all demand-confirmation and demand-exploration tests.

- [ ] **Step 1: Run focused full test set**

Run: `npx vitest run tests/domain/demand-confirmation.test.ts tests/domain/demand-exploration.test.ts tests/domain/local-store.test.ts tests/ui/demand-confirmation-*.test.tsx tests/ui/demand-exploration-*.test.tsx`

Expected: all selected tests pass。

- [ ] **Step 2: Run type and whitespace checks**

Run: `npx tsc --noEmit; git diff --check`

Expected: no TypeScript or whitespace errors。

- [ ] **Step 3: Manually verify the user journey**

Open `/demand-exploration`, create a document, add two function sections and at least three demand items, add multiple exploration questions to one item, set KANO questions for two items, add responses to each separately, inspect the matrix, quadrant and final conclusion.

- [ ] **Step 4: Verify preservation and empty states**

Check old single-analysis records remain visible, zero-answer items show pending evidence, one valid demand item does not draw a fake quadrant, and invalid pasted rows remain visible for correction。

- [ ] **Step 5: Commit final fixes**

```bash
git add src/app/demand-exploration src/components/workbench/demand-exploration src/features/workbench/demand-confirmation.ts src/features/workbench/demand-exploration.ts src/features/workbench/local-store.ts tests/domain/demand-confirmation.test.ts tests/ui/demand-confirmation-*.test.tsx
git commit -m "test: verify demand confirmation workflow"
```
