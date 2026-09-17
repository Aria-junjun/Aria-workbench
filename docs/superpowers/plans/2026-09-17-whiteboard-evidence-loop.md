# 静电白板贴证据闭环试点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不重构现有工作台的前提下，验证“静电白板贴”从行业洞察到机会产品验证中心的可追溯研究闭环。

**Architecture:** 保留行业洞察、需求探索、竞品分析和产品拆解各自的字段与项目结构；新增一个独立的证据引用模型，以内容快照连接来源和目标字段。三个外部 AI 页面继续共用现有任务包/解析/确认机制，引用只复制已确认内容，不自动覆盖来源或目标内容。

**Tech Stack:** Next.js App Router、React、TypeScript、现有 local-store/sync 数据层、Vitest、React Testing Library。

## Global Constraints

- 试点对象固定为“静电白板贴留痕问题”。
- AI 只负责整理、识别字段、发现缺口和提示冲突，不做最终商业化、采购、入仓或生命周期决策。
- 用户原始输入、AI 初稿、人工修改稿和确认稿必须分别可恢复。
- 引用记录必须保留来源模块、来源项目、来源字段、内容快照、引用时状态和引用时间。
- 引用是目标侧参考副本，不能静默覆盖目标内容，也不能反向修改来源。
- 未识别文本必须保留并可重新识别。
- 本计划不实现联网抓取、完整机会产品模型、入仓决策和产品生命周期页面。
- 不修改与本试点无关的供应商、报价和商品管理文件。

---

## 文件结构与职责

- Create: `src/features/workbench/evidence-references.ts` — 证据引用类型、状态和纯函数。
- Modify: `src/features/workbench/local-store.ts` — 保存和读取引用记录，保持现有工作台数据兼容。
- Modify: `src/features/workbench/ai-task-protocol.ts` — 为 AI 草稿补充可追溯状态和字段中文元数据所需的稳定接口。
- Modify: `src/components/workbench/external-ai-task-panel.tsx` — 统一导入、修改、确认、历史和未识别内容留痕。
- Modify: `src/components/workbench/industry-insight/insight-workspace.tsx` — 提供已确认行业字段作为上游引用源。
- Modify: `src/components/workbench/demand-exploration/document-workspace.tsx` — 增加引用入口并把引用内容作为参考副本保存。
- Modify: `src/components/workbench/competitor-analysis/analysis-workspace.tsx` — 增加引用入口并展示来源信息。
- Modify: `src/components/workbench/product-decomposition/decomposition-workspace.tsx` — 增加引用入口并展示来源信息。
- Create or Modify: `src/components/workbench/evidence-reference-picker.tsx` — 选择来源项目/字段并写入快照。
- Modify: `src/components/workbench/industry-insight/insight-report.tsx` — 展示行业洞察的事实、推断、待验证和引用来源。
- Modify: `src/components/workbench/competitor-analysis/report-preview.tsx` — 展示竞品分析的事实、推断、待验证、冲突和引用来源。
- Modify: `src/components/workbench/product-decomposition/decomposition-report.tsx` — 展示产品拆解的原因、方案、待验证和引用来源。
- Modify: `src/components/workbench/demand-exploration/document-workspace.tsx` — 在需求文档工作区展示需求证据、样本限制和引用来源，不新建独立报告组件。
- Test: `tests/domain/evidence-references.test.ts`、`tests/ui/evidence-reference-picker.test.tsx`、现有 AI/import/sync tests。

### Task 1: 固化 AI 初稿与原始资料的不可覆盖规则

**Files:**
- Modify: `src/features/workbench/ai-task-protocol.ts`
- Modify: `src/components/workbench/external-ai-task-panel.tsx`
- Modify: `src/components/workbench/demand-exploration/document-workspace.tsx`
- Modify: `src/components/workbench/competitor-analysis/analysis-workspace.tsx`
- Modify: `src/components/workbench/product-decomposition/decomposition-workspace.tsx`
- Test: `tests/domain/ai-task-protocol.test.ts`
- Test: `tests/ui/external-ai-task-panel.test.tsx`

**Interfaces:**
- 保持 `parseAiTaskDraft(text: string, task: AiTaskPackage): AiTaskDraft` 兼容现有调用。
- `AiTaskDraft` 继续保存 `rawText`、`recognizedFields`、`unrecognizedLines` 和 `importedAt`。
- 面板的保存回调只追加新的草稿/确认记录，不用当前识别结果覆盖原始项目字段。

- [ ] **Step 1: 写失败测试**：增加断言，导入含未识别字段的 Markdown 后，`rawText` 和 `unrecognizedLines` 均保留；点击确认后项目原字段未被未确认草稿覆盖，且历史草稿数量增加。
- [ ] **Step 2: 运行测试确认失败**：运行 `npx vitest run tests/domain/ai-task-protocol.test.ts tests/ui/external-ai-task-panel.test.tsx`，预期新增断言在实现前失败。
- [ ] **Step 3: 最小实现**：把面板的“导入识别”“修改保存”“确认保存”明确分成三个状态；确认只通过已有 `onSaveDraft` 追加记录，原始项目字段只在用户明确保存正式模块时更新。
- [ ] **Step 4: 运行测试确认通过**：重复运行同一命令，预期所有相关测试通过。
- [ ] **Step 5: 提交**：`git add` 上述文件并提交 `fix: preserve research source and draft history`。

### Task 2: 建立最小证据引用领域模型

**Files:**
- Create: `src/features/workbench/evidence-references.ts`
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/domain/evidence-references.test.ts`

**Interfaces:**

```ts
export type EvidenceReferenceStatus = "original" | "ai-draft" | "edited" | "confirmed" | "inference" | "to-verify";
export type EvidenceReferenceModule = "industry-insight" | "demand-exploration" | "competitor-analysis" | "product-decomposition";
export type EvidenceReference = {
  id: string;
  sourceModule: EvidenceReferenceModule;
  sourceProjectId: string;
  sourceProjectTitle: string;
  sourceFieldPath: string;
  sourceFieldLabel: string;
  snapshot: string;
  status: EvidenceReferenceStatus;
  referencedAt: string;
};
export function createEvidenceReference(input: Omit<EvidenceReference, "id" | "referencedAt">): EvidenceReference;
export function canReferenceEvidence(status: EvidenceReferenceStatus): boolean;
```

- [ ] **Step 1: 写失败测试**：验证 `canReferenceEvidence` 只允许 `confirmed`、`original` 和用户明确保留的 `edited` 内容；拒绝 `ai-draft`；验证创建引用生成 id、时间和完整快照。
- [ ] **Step 2: 运行测试确认失败**：运行 `npx vitest run tests/domain/evidence-references.test.ts`，预期失败。
- [ ] **Step 3: 最小实现**：创建纯函数和类型；在现有工作台顶层数据结构中增加可选 `evidenceReferences?: EvidenceReference[]`，读取旧 JSON 时缺省为空数组，保存时只追加/更新引用数组。
- [ ] **Step 4: 运行测试确认通过**：运行 `npx vitest run tests/domain/evidence-references.test.ts tests/domain/research-project-links.test.ts`，预期通过且旧项目链接测试不受影响。
- [ ] **Step 5: 提交**：提交 `feat: add traceable evidence references`。

### Task 3: 增加统一的引用选择器

**Files:**
- Create: `src/components/workbench/evidence-reference-picker.tsx`
- Modify: `src/components/workbench/industry-insight/insight-workspace.tsx`
- Modify: `src/components/workbench/demand-exploration/document-workspace.tsx`
- Modify: `src/components/workbench/competitor-analysis/analysis-workspace.tsx`
- Modify: `src/components/workbench/product-decomposition/decomposition-workspace.tsx`
- Test: `tests/ui/evidence-reference-picker.test.tsx`

**Interfaces:**

```ts
type EvidenceReferencePickerProps = {
  targetModule: EvidenceReferenceModule;
  targetProjectId: string;
  references: EvidenceReference[];
  sources: Array<{ module: EvidenceReferenceModule; projectId: string; projectTitle: string; fields: Array<{ path: string; label: string; value: string; status: EvidenceReferenceStatus }> }>;
  onAdd: (reference: EvidenceReference) => void;
};
```

- [ ] **Step 1: 写失败测试**：验证只展示可引用的已确认字段；选择字段后显示中文模块、项目、字段和内容快照；不可引用 AI 初稿；添加后目标内容仍是可编辑副本。
- [ ] **Step 2: 运行测试确认失败**：运行 `npx vitest run tests/ui/evidence-reference-picker.test.tsx`，预期失败。
- [ ] **Step 3: 最小实现**：使用模块、项目、字段三级选择；默认只加载当前试点项目和上游方向允许的来源；添加时调用 `createEvidenceReference`，不直接改写目标字段。
- [ ] **Step 4: 接入三个下游页面**：在需求探索、竞品分析、产品拆解工作区增加“引用已有资料”区域；显示“引用自：模块 / 项目 / 字段”，允许用户将快照复制到当前字段后再编辑。
- [ ] **Step 5: 接入行业洞察来源**：行业洞察只提供已确认字段作为来源，不增加反向引用和循环引用。
- [ ] **Step 6: 运行测试确认通过**：运行 `npx vitest run tests/ui/evidence-reference-picker.test.tsx tests/ui/external-ai-task-panel.test.tsx`，预期通过。
- [ ] **Step 7: 提交**：提交 `feat: add cross-module evidence reference picker`。

### Task 4: 在报告和验证中心展示证据状态与冲突

**Files:**
- Create: `src/features/workbench/evidence-conflicts.ts`
- Modify: `src/components/workbench/industry-insight/insight-report.tsx`
- Modify: `src/components/workbench/competitor-analysis/report-preview.tsx`
- Modify: `src/components/workbench/product-decomposition/decomposition-report.tsx`
- Modify: `src/components/workbench/demand-exploration/document-workspace.tsx`
- Modify: `src/features/workbench/research-project-links.ts` — 仅扩展现有项目关联辅助函数，不创建新的机会产品实体。
- Test: `tests/domain/evidence-conflicts.test.ts`

**Interfaces:**

```ts
export type EvidenceConflict = {
  fieldPath: string;
  fieldLabel: string;
  references: EvidenceReference[];
  reason: "value-mismatch" | "fact-mismatch" | "judgment-mismatch";
};
export function findEvidenceConflicts(references: EvidenceReference[]): EvidenceConflict[];
```

- [ ] **Step 1: 写失败测试**：用同一字段的两个不同快照验证能识别冲突，并保留双方来源；相同快照不产生冲突；没有来源的内容不自动升级为事实。
- [ ] **Step 2: 运行测试确认失败**：运行 `npx vitest run tests/domain/evidence-conflicts.test.ts`，预期失败。
- [ ] **Step 3: 最小实现**：按目标字段聚合引用快照，只做差异提示；不自动选优、不删除冲突项。
- [ ] **Step 4: 修改四个现有展示位置**：在 `insight-report.tsx`、`report-preview.tsx`、`decomposition-report.tsx` 和需求工作区增加“事实 / 推断 / 待验证 / 信息缺口 / 来源板块”标识；冲突以并列来源展示，并提供“转为待验证”操作；不创建新的机会产品实体。
- [ ] **Step 5: 运行测试确认通过**：运行 `npx vitest run tests/domain/evidence-conflicts.test.ts tests/domain/ai-task-protocol.test.ts`，预期通过。
- [ ] **Step 6: 提交**：提交 `feat: surface evidence status and conflicts`。

### Task 5: 试点验收与正式报告输出

**Files:**
- Modify: `src/components/workbench/industry-insight/insight-report.tsx`
- Modify: `src/components/workbench/industry-insight/insight-report.tsx`
- Modify: `src/components/workbench/competitor-analysis/report-preview.tsx`
- Modify: `src/components/workbench/product-decomposition/decomposition-report.tsx`
- Modify: `src/components/workbench/demand-exploration/document-workspace.tsx`
- Test: existing report and save/load tests plus a new end-to-end test under `tests/e2e/whiteboard-evidence-loop.test.ts`
- Create: `docs/superpowers/reports/2026-09-17-whiteboard-evidence-loop-validation.md`

- [ ] **Step 1: 写端到端失败测试**：建立静电白板贴四类研究项目，确认行业洞察字段可被下游引用；确认引用显示来源；确认 AI 初稿不允许引用；确认来源更新不会静默覆盖目标；确认未识别内容和历史初稿仍可恢复。
- [ ] **Step 2: 运行测试确认失败**：运行 `npx vitest run tests/e2e/whiteboard-evidence-loop.test.ts`，预期失败。
- [ ] **Step 3: 补齐最小集成**：修复跨工作区的保存/加载、来源快照和报告展示问题，只修改影响试点的代码路径。
- [ ] **Step 4: 生成正式报告**：报告固定包含研究对象与边界、行业事实、用户证据、竞品与替代方案、产品原因与方案假设、证据冲突与缺口、当前阶段、下一步验证动作和尚未做出的决策。
- [ ] **Step 5: 运行完整验证**：运行 `npm test`、`npx tsc --noEmit`、`git diff --check`，并在本地服务中手工检查四个研究页面的导入/确认/引用/报告流程。
- [ ] **Step 6: 提交**：提交 `test: validate whiteboard evidence loop`，并在报告中记录五项验收指标的结果。

## 验收后的决策门槛

只有当以下五项至少满足四项，才进入下一阶段：

1. 重复填写明显减少；
2. 结论可以追溯到具体来源字段；
3. 信息缺口能转为下一步行动；
4. 冲突没有被自动掩盖；
5. 正式报告可以被用户复核并支持下一步研究。

若数据恢复、引用追溯或冲突处理任一项失败，暂停扩展，不进入生命周期和自动联网阶段。
