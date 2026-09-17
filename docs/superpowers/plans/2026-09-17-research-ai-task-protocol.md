# 研究模块 AI 任务协议与机会产品关联 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立统一的外部 GPT 任务协议，并为需求探索、竞品分析、产品拆解接入可审核的 AI 任务包，同时为机会产品关联预留接口。

**Architecture:** 新增纯领域层任务协议和三个模块任务包构建器；各模块 UI 只负责展示、复制和保存任务包，不直接写入正式字段。机会产品关联采用可选 ID 接口，第一阶段不迁移旧数据。

**Tech Stack:** Next.js、React、TypeScript、Vitest、本地存储。

## Global Constraints

- AI 只能生成草稿，人工采用后才能进入正式记录。
- 任何无法核验的内容必须标记为待验证，不得编造来源、样本或销售数据。
- 不修改入仓产品、品类项目和现有经营数据。
- 任务包字段必须使用中文可读名称，并且与模块实际字段一一对应。

---

### Task 1: 建立共用 AI 任务协议

**Files:**
- Create: `src/features/workbench/ai-task-protocol.ts`
- Test: `tests/domain/ai-task-protocol.test.ts`

**Interfaces:**
- Produces `AiTaskModule`, `AiTaskField`, `AiTaskPackage`。
- Produces `buildAiTaskPackage(input)`，生成稳定的中文 Markdown 任务包。

- [ ] **Step 1: Write the failing test**

测试应验证任务包包含模块、项目上下文、统一字段、来源规则和“不得编造”边界，并且不同字段路径不会重复。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/ai-task-protocol.test.ts`

Expected: FAIL because the protocol module does not exist.

- [ ] **Step 3: Write minimal implementation**

实现 `buildAiTaskPackage`，只拼接协议声明、上下文、允许字段和输出模板，不执行网络请求、不保存项目。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/domain/ai-task-protocol.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add tests/domain/ai-task-protocol.test.ts src/features/workbench/ai-task-protocol.ts
git commit -m "feat: add shared external AI task protocol"
```

### Task 2: 增加三个模块任务包构建器

**Files:**
- Create: `src/features/workbench/research-ai-task-packages.ts`
- Create: `src/components/workbench/external-ai-task-panel.tsx`
- Modify: `src/components/workbench/demand-exploration/document-workspace.tsx`
- Modify: `src/components/workbench/competitor-analysis/analysis-workspace.tsx`
- Modify: `src/components/workbench/product-decomposition/decomposition-workspace.tsx`
- Test: `tests/domain/research-ai-task-packages.test.ts`
- Test: `tests/ui/external-ai-task-panel.test.tsx`

**Interfaces:**
- Produces `buildDemandExplorationTaskPackage(input)`。
- Produces `buildCompetitorAnalysisTaskPackage(input)`。
- Produces `buildProductDecompositionTaskPackage(input)`。
- Each builder returns `AiTaskPackage` and declares module-specific allowed fields.

- [ ] **Step 1: Write the failing test**

分别断言三个任务包的中文模块名、专属输出字段、上下文内容和边界要求存在；同时断言没有把另一个模块的字段混入当前任务包。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/research-ai-task-packages.test.ts`

Expected: FAIL because the builders do not exist.

- [ ] **Step 3: Write minimal implementation**

使用共用协议构建器，分别读取当前模块的最小上下文；不读取或修改入仓产品，不生成结论性商业决策。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/domain/research-ai-task-packages.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add tests/domain/research-ai-task-packages.test.ts src/features/workbench/research-ai-task-packages.ts
git commit -m "feat: add research module AI task packages"
```

- [ ] **Step 6: Expose the task packages in the three workspaces**

Render `ExternalAiTaskPanel` with the corresponding builder output in each existing workspace. The panel only copies a read-only prompt and explicitly states that the result must be reviewed before formal records change; it does not implement AI result import yet.

### Task 3: 为研究项目预留可选机会产品关联

**Files:**
- Modify: `src/features/workbench/demand-confirmation.ts`
- Modify: `src/features/workbench/competitor-analysis.ts`
- Modify: `src/features/workbench/product-decomposition.ts`
- Test: `tests/domain/research-project-links.test.ts`

**Interfaces:**
- Adds optional `opportunityProductId?: string` to the three research project types.
- Adds `setOpportunityProductLink(project, opportunityProductId)` for each project domain or a shared typed helper where compatible.

- [ ] **Step 1: Write the failing test**

验证项目可以无关联创建、可以设置机会产品 ID、清除关联不会改变其他研究字段。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/research-project-links.test.ts`

Expected: FAIL because the optional field and helper do not exist。

- [ ] **Step 3: Write minimal implementation**

仅添加可选字段和不可变更新函数，不自动扫描旧项目，不写入产品表，不创建入仓产品。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/domain/research-project-links.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add tests/domain/research-project-links.test.ts src/features/workbench/demand-confirmation.ts src/features/workbench/competitor-analysis.ts src/features/workbench/product-decomposition.ts
git commit -m "feat: add optional opportunity product links"
```

### Task 4: 验证现有行业洞察不回归并完成类型检查

**Files:**
- Test: existing industry insight and research module tests

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/domain/ai-task-protocol.test.ts tests/domain/research-ai-task-packages.test.ts tests/domain/research-project-links.test.ts tests/domain/industry-insight.test.ts tests/domain/industry-insight-bridge.test.ts tests/ui/industry-insight-report.test.tsx tests/ui/competitor-analysis-workspace.test.tsx tests/ui/industry-insight-workspace.test.tsx`

Expected: all tests pass。

- [ ] **Step 2: Run type and diff checks**

Run: `npx tsc --noEmit; git diff --check`

Expected: exit code 0。

- [ ] **Step 3: Review scope**

确认没有修改入仓产品、品类项目、产品生命周期数据或现有项目内容；确认未纳入无关供应商改动。
