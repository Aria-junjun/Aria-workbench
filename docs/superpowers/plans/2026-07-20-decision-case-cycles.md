# 问题档案与决策周期 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前按工具分散保存的应用记录升级为“一个问题档案、多个决策周期”，并将商业模式画布入口后移到周期详情中。

**Architecture:** 新增独立的决策档案领域模块，在现有 `knowledgeApplications` 数据之上兼容读取并逐步写入 `decisionCases`，避免破坏旧数据。商业知识首页只负责问题录入、本地工具匹配和档案列表；周期详情负责工具贡献、综合结论、画布和版本。

**Tech Stack:** Next.js 15、React 19、TypeScript、Zod、localStorage、Vitest。

## Global Constraints

- 一个问题档案可以包含多个决策周期。
- 工具分析属于决策周期，不单独成为应用记录。
- 商业模式画布属于可选综合工具，不是默认步骤。
- 首页不调用 AI；AI 只在周期详情中由用户明确触发。
- 一次智能动作最多调用一次 API，不自动重试。
- 不增加 Supabase、定时任务、新模型或新依赖。
- 旧 `knowledgeApplications` 必须兼容读取，不自动合并不确定的重复问题。
- 当前结论和下一步行动优先展示，工具过程与历史周期默认收起。

---

### Task 1: 问题档案与决策周期领域模型

**Files:**
- Create: `src/features/workbench/decision-cases.ts`
- Test: `tests/domain/decision-cases.test.ts`

**Interfaces:**
- Produces: `DecisionCaseSchema`、`DecisionCycleSchema`、`ToolContributionSchema`、`normalizeProblemKey(problem)`、`latestDecisionCycle(caseItem)`、`mergeActionSources(contributions)`。

- [ ] **Step 1: 写失败测试**

测试以下行为：

```ts
it("normalizes cosmetic differences in the same problem", () => {
  expect(normalizeProblemKey(" 是否进入新品？ ")).toBe(normalizeProblemKey("是否进入新品"));
});

it("keeps tool contributions separate while merging repeated actions", () => {
  const result = mergeActionSources([
    { toolId: "a", toolName: "市场信号", judgement: "需求待验证", actions: ["小批量测试"] },
    { toolId: "b", toolName: "竞争战略", judgement: "避免直接降价", actions: ["小批量测试"] }
  ]);
  expect(result).toEqual([{ action: "小批量测试", sourceToolIds: ["a", "b"] }]);
});
```

同时验证：一个档案可以包含多个周期、最新周期按 `cycleNumber` 选择、画布字段属于周期而非工具贡献。

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
npx vitest run tests/domain/decision-cases.test.ts --exclude ".worktrees/**"
```

Expected: FAIL，因为 `decision-cases.ts` 尚不存在。

- [ ] **Step 3: 实现最小领域模型**

核心类型：

```ts
type ToolContribution = {
  id: string;
  toolId: string;
  toolName: string;
  sourceBook?: string;
  judgement: string;
  actions: string[];
  acceptedActionIds?: string[];
  createdAt: string;
};

type DecisionCycle = {
  id: string;
  cycleNumber: number;
  title: string;
  rawInput: string;
  newInformation?: string;
  initialJudgement?: string;
  toolContributions: ToolContribution[];
  modelId?: "business-model-canvas";
  modelSections: DecisionModelSection[];
  conclusion?: string;
  nextActions: Array<{ action: string; sourceToolIds: string[] }>;
  outcome?: string;
  review?: string;
  status: "judging" | "pending_action" | "validating" | "completed" | "paused";
  version: number;
  createdAt: string;
  updatedAt: string;
};

type DecisionCase = {
  id: string;
  title: string;
  normalizedProblemKey: string;
  objective?: string;
  cycles: DecisionCycle[];
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 4: 运行测试并确认通过**

Run:

```bash
npx vitest run tests/domain/decision-cases.test.ts --exclude ".worktrees/**"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/features/workbench/decision-cases.ts tests/domain/decision-cases.test.ts
git commit -m "feat: add decision case domain"
```

---

### Task 2: 兼容存储与旧记录迁移

**Files:**
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/domain/local-store.test.ts`

**Interfaces:**
- Consumes: `DecisionCase`、`DecisionCycle`。
- Produces: `loadDecisionCases()`、`createDecisionCase(input)`、`addDecisionCycle(caseId, input)`、`updateDecisionCycleVersion(caseId, cycleId, patch)`、`migrateKnowledgeApplicationsToCases(data)`。

- [ ] **Step 1: 写失败测试**

覆盖：

```ts
it("migrates clearly identical old applications into one case with separate cycles", () => {
  // 两条仅标点和空格不同的问题，迁移为一个档案、两个周期。
});

it("does not merge uncertain old applications", () => {
  // 两个语义可能相近但文本不同的问题，保留为两个档案。
});

it("adds a new cycle without changing the previous cycle", () => {
  // 周期2引用档案，但周期1内容保持不变。
});

it("creates a new version inside the current cycle", () => {
  // 编辑当前周期后版本加1，不创建新的决策周期。
});
```

- [ ] **Step 2: 运行测试并确认新断言失败**

Run:

```bash
npx vitest run tests/domain/local-store.test.ts --exclude ".worktrees/**"
```

Expected: FAIL，因为新存储函数尚未实现。

- [ ] **Step 3: 扩展数据结构**

在 `LocalWorkbenchData` 增加可选兼容字段：

```ts
decisionCases: DecisionCase[];
```

`emptyData()` 返回空数组；`normalizeWorkbenchData()` 对缺失字段补空数组。

迁移只在 `decisionCases` 为空且存在旧记录时生成兼容视图。不得删除或重写原 `knowledgeApplications`。

- [ ] **Step 4: 实现保守迁移**

只使用 `normalizeProblemKey()` 完全一致的记录自动合并。迁移映射：

- `problem` -> 档案标题和周期原始输入；
- `diagnosis` -> 周期初步判断；
- `selectedActionSources` -> 工具贡献；
- `selectedActions` -> 周期行动；
- `modelSections` -> 周期综合模型；
- `createdAt` -> 周期时间。

不满足完全一致的记录分别建档。

- [ ] **Step 5: 运行测试并确认通过**

Run:

```bash
npx vitest run tests/domain/local-store.test.ts --exclude ".worktrees/**"
```

Expected: PASS，旧测试不回归。

- [ ] **Step 6: 提交**

```bash
git add src/features/workbench/local-store.ts tests/domain/local-store.test.ts
git commit -m "feat: store decision cases and cycles"
```

---

### Task 3: 首页改为问题入口与问题档案列表

**Files:**
- Modify: `src/app/knowledge/page.tsx`
- Test: `tests/ui/decision-workspace.test.tsx`

**Interfaces:**
- Consumes: `loadDecisionCases()`、`createDecisionCase(input)`、`latestDecisionCycle(caseItem)`。
- Produces: 首页“解决问题 / 我的书架 / 问题档案”三个视图。

- [ ] **Step 1: 写失败的源码级 UI 测试**

验证：

```ts
expect(source).toContain("问题档案");
expect(source).toContain("直接保存为问题草稿");
expect(source).toContain("查找本地知识");
expect(source).not.toContain('fetch("/api/knowledge/analyze"');
expect(source).not.toContain(">需要分析<");
expect(source).toContain("/knowledge/cases/");
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
npx vitest run tests/ui/decision-workspace.test.tsx --exclude ".worktrees/**"
```

Expected: FAIL，当前首页仍有前置分析入口。

- [ ] **Step 3: 修改首页**

- 删除首页 `requestAnalysis()`、分析草稿状态和 `DecisionAnalysisEditor`。
- 保留本地知识工具匹配。
- “直接保存为问题草稿”调用 `createDecisionCase()`，创建周期1但不调用 API。
- “应用记录”更名为“问题档案”。
- 档案卡只显示标题、状态、最新结论、最新行动、周期数量和更新时间。
- 档案卡链接 `/knowledge/cases/[caseId]`。

- [ ] **Step 4: 运行测试并确认通过**

Run:

```bash
npx vitest run tests/ui/decision-workspace.test.tsx --exclude ".worktrees/**"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/app/knowledge/page.tsx tests/ui/decision-workspace.test.tsx
git commit -m "feat: show decision cases in knowledge hub"
```

---

### Task 4: 问题档案详情与工具贡献

**Files:**
- Create: `src/app/knowledge/cases/[caseId]/page.tsx`
- Create: `src/components/workbench/decision-cycle-editor.tsx`
- Modify: `src/app/knowledge/solve/page.tsx`
- Modify: `src/app/knowledge/tools/[toolId]/page.tsx`
- Test: `tests/ui/decision-case-detail.test.tsx`

**Interfaces:**
- Consumes: `createDecisionCase()`、`addDecisionCycle()`、`updateDecisionCycleVersion()`、`mergeActionSources()`。
- Produces: 同一周期内的多工具贡献和综合行动。

- [ ] **Step 1: 写失败测试**

验证详情源码具有：

- 当前结论优先展示；
- 工具名称和来源；
- 工具判断、工具行动、采纳状态；
- “增加分析工具”；
- “新建决策周期”；
- 历史周期默认折叠；
- 保存工具结果时写入当前周期，而不是创建独立应用记录。

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
npx vitest run tests/ui/decision-case-detail.test.tsx --exclude ".worktrees/**"
```

Expected: FAIL，因为详情页尚不存在。

- [ ] **Step 3: 实现档案详情**

页面顺序：

1. 当前状态；
2. 最新结论；
3. 下一步行动；
4. 当前周期；
5. 工具贡献（默认折叠）；
6. 历史周期（默认折叠）。

编辑周期使用 `updateDecisionCycleVersion()`，不覆盖历史版本。

- [ ] **Step 4: 修改工具保存路径**

`solve/page.tsx` 和 `tools/[toolId]/page.tsx` 接收可选 `caseId`、`cycleId` 查询参数。存在参数时，把分析作为 `ToolContribution` 写入对应周期；不存在时，创建问题档案和周期1。

- [ ] **Step 5: 运行测试并确认通过**

Run:

```bash
npx vitest run tests/ui/decision-case-detail.test.tsx tests/domain/local-store.test.ts --exclude ".worktrees/**"
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/app/knowledge/cases/[caseId]/page.tsx src/components/workbench/decision-cycle-editor.tsx src/app/knowledge/solve/page.tsx src/app/knowledge/tools/[toolId]/page.tsx tests/ui/decision-case-detail.test.tsx
git commit -m "feat: add decision cycle workspace"
```

---

### Task 5: 将商业画布后移到周期综合分析

**Files:**
- Modify: `src/features/workbench/decision-analysis-ai.ts`
- Modify: `src/app/api/knowledge/analyze/route.ts`
- Modify: `src/components/workbench/decision-analysis-editor.tsx`
- Modify: `src/app/knowledge/cases/[caseId]/page.tsx`
- Test: `tests/domain/decision-analysis-ai.test.ts`
- Test: `tests/ui/decision-case-detail.test.tsx`

**Interfaces:**
- Consumes: 当前周期的 `rawInput`、`initialJudgement`、`toolContributions`、`nextActions` 和可选上一周期摘要。
- Produces: `analyzeDecisionCycle(input)`，返回综合摘要、待确认问题和商业模式画布字段。

- [ ] **Step 1: 写失败测试**

提示词测试必须确认：

```ts
expect(prompt).toContain("综合当前周期全部工具分析");
expect(prompt).toContain("不得把上一周期结论当作当前事实");
expect(prompt).toContain("不得推测补全");
expect(prompt).not.toContain("判断是否推荐商业模式画布");
```

UI 测试确认“使用商业模式画布”只存在于周期详情。

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
npx vitest run tests/domain/decision-analysis-ai.test.ts tests/ui/decision-case-detail.test.tsx --exclude ".worktrees/**"
```

Expected: FAIL，当前接口仍从原始问题开始判断模型。

- [ ] **Step 3: 修改 API 输入**

请求结构：

```ts
{
  caseId: string;
  cycleId: string;
  rawInput: string;
  initialJudgement?: string;
  toolContributions: ToolContribution[];
  currentActions: Array<{ action: string; sourceToolIds: string[] }>;
  previousCycleSummary?: string;
}
```

API 只在用户点击“使用商业模式画布”时调用一次。返回固定九模块，不再承担是否推荐模型的判断。

- [ ] **Step 4: 修改周期详情交互**

- 点击“使用商业模式画布”后请求一次 API；
- 返回结果进入可编辑画布；
- 空字段显示浅灰提示但保存空值；
- 保存后写入当前周期的新版本；
- 重新打开直接读取本地结果，不重复请求。

- [ ] **Step 5: 运行测试并确认通过**

Run:

```bash
npx vitest run tests/domain/decision-analysis-ai.test.ts tests/ui/decision-case-detail.test.tsx --exclude ".worktrees/**"
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/features/workbench/decision-analysis-ai.ts src/app/api/knowledge/analyze/route.ts src/components/workbench/decision-analysis-editor.tsx src/app/knowledge/cases/[caseId]/page.tsx tests/domain/decision-analysis-ai.test.ts tests/ui/decision-case-detail.test.tsx
git commit -m "feat: synthesize decision cycles with canvas"
```

---

### Task 6: 新周期、复盘与旧详情兼容跳转

**Files:**
- Modify: `src/app/knowledge/cases/[caseId]/page.tsx`
- Modify: `src/app/knowledge/applications/[applicationId]/page.tsx`
- Test: `tests/ui/decision-case-detail.test.tsx`

**Interfaces:**
- Consumes: `addDecisionCycle()`、兼容迁移映射。
- Produces: 新周期创建、复盘记录和旧链接跳转。

- [ ] **Step 1: 写失败测试**

验证：

- 新周期展示上一周期结论、行动结果和未解决问题；
- 历史信息默认只读；
- 只有用户选择引用的内容进入新周期；
- 复盘保存执行结果和判断修正；
- 旧 `/knowledge/applications/[applicationId]` 能找到迁移后的档案并跳转。

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
npx vitest run tests/ui/decision-case-detail.test.tsx --exclude ".worktrees/**"
```

Expected: FAIL，新周期和兼容跳转尚未完成。

- [ ] **Step 3: 实现新周期和复盘**

“新建决策周期”表单只要求：

- 本周期名称；
- 新增或变化的信息；
- 可选引用上一周期的结论、行动结果、待确认问题。

复盘字段保存到当前周期的 `outcome` 和 `review`。

- [ ] **Step 4: 实现旧链接兼容**

旧详情页读取旧应用记录，查找迁移后对应档案，使用 `router.replace("/knowledge/cases/" + caseId)`；找不到时继续展示旧只读内容，不报错。

- [ ] **Step 5: 运行测试并确认通过**

Run:

```bash
npx vitest run tests/ui/decision-case-detail.test.tsx --exclude ".worktrees/**"
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/app/knowledge/cases/[caseId]/page.tsx src/app/knowledge/applications/[applicationId]/page.tsx tests/ui/decision-case-detail.test.tsx
git commit -m "feat: add decision cycles and review"
```

---

### Task 7: 完整验证

**Files:**
- Verify only; fix only failures caused by Tasks 1-6.

- [ ] **Step 1: 运行完整测试**

```bash
npx vitest run --exclude ".worktrees/**"
```

Expected: 全部通过。

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

Expected: exit 0。

- [ ] **Step 3: 生产构建**

```bash
npm run build
```

Expected: 编译成功，包含 `/knowledge/cases/[caseId]` 和 `/api/knowledge/analyze`。

- [ ] **Step 4: 浏览器验证**

在 `http://127.0.0.1:3000/knowledge` 验证：

1. 首页无前置 AI 按钮；
2. 本地匹配不调用 API；
3. 两个工具结果进入同一周期；
4. 工具行动保留来源；
5. 画布综合当前周期；
6. 新建周期能查看上一周期；
7. 当前结论优先显示；
8. 旧应用记录可访问。

浏览器验证不得点击真实 AI 调用，除非用户已配置 API 并明确要求付费联调。

- [ ] **Step 5: 提交验证修复**

仅当验证产生必要修复时：

```bash
git add <exact-fixed-files>
git commit -m "fix: verify decision case workflow"
```
