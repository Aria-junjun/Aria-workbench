# 供应商能力网络 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立供应商能力档案，并将其接入供应商详情和产品机会查询。

**Architecture:** 延续现有 Next.js 客户端、local store 和 Supabase 同步模式。先新增可追溯的供应商能力对象，再通过领域函数提供产品族/工艺/材料/设备匹配，最后接入详情页和产品机会页；不改变现有供应关系和经营快照口径。

**Tech Stack:** Next.js App Router 15, React 19, TypeScript 5, Tailwind CSS, Supabase, Zod, Vitest, Testing Library.

## Global Constraints

- 供应商能力必须保留来源和有效期。
- 货盘、规格对应、供应关系、能力记录必须保持独立。
- 没有证据时不自动评分、不自动晋级、不自动替换主供。
- 本地保存、云端同步、刷新重载后数据必须一致。
- 不新增库存、采购执行或财务模块。

### Task 1: 领域对象和存储

**Files:**
- Modify: `src/features/workbench/types.ts`
- Modify: `src/features/workbench/schemas.ts`
- Modify: `src/features/workbench/local-store.ts`
- Test: `tests/domain/supplier-capability.test.ts`

- [ ] 先写供应商能力新增、失效、按供应商查询和按产品族查询的失败测试。
- [ ] 运行 `npx vitest run tests/domain/supplier-capability.test.ts`，确认失败。
- [ ] 新增 `SupplierCapability` 类型和校验 schema，字段包括 supplierId、productFamilyKey、processNames、materialNames、equipmentNames、supportsSampling、supportsCustomization、moq、leadTime、sourceRecordIds、status、effectiveFrom、effectiveTo。
- [ ] 在 local store 增加保存、更新、失效和备份恢复逻辑，采用现有同步入口。
- [ ] 重新运行该测试，确认通过。
- [ ] 提交 `feat: add supplier capability storage`。

### Task 2: 能力匹配领域服务

**Files:**
- Create: `src/features/workbench/supplier-capability.ts`
- Test: `tests/domain/supplier-capability-matching.test.ts`

- [ ] 先写精确匹配产品族、工艺、材料、设备的测试，以及缺少任一条件时标记为待验证的测试。
- [ ] 运行测试确认失败。
- [ ] 实现 `findSupplierCapabilityMatches(input)`，返回匹配供应商、匹配维度、证据完整度和 `verified | needs_review` 状态。
- [ ] 明确禁止仅凭名称相似度返回 verified。
- [ ] 运行测试确认通过并提交 `feat: match suppliers by capability`。

### Task 3: 供应商详情能力区域

**Files:**
- Modify: `src/app/suppliers/[supplierId]/page.tsx`
- Create: `src/components/workbench/supplier-capability-editor.tsx`
- Test: `tests/ui/supplier-capability-editor.test.tsx`

- [ ] 先写详情页展示能力、编辑能力、标记失效和保存后刷新仍存在的 UI 测试。
- [ ] 运行测试确认失败。
- [ ] 增加“供应商能力”区域，使用统一的右上角编辑/保存约定；能力记录按产品族分组展示。
- [ ] 增加来源和有效期显示；没有来源的人工记录显示“人工确认”。
- [ ] 运行 UI 测试、类型检查并提交 `feat: add supplier capability editor`。

### Task 4: 产品机会反查

**Files:**
- Modify: `src/app/products/[productId]/page.tsx`
- Modify: `src/features/workbench/product-brief.ts`
- Test: `tests/ui/product-opportunity-supplier-match.test.tsx`

- [ ] 先写从产品机会的工艺、材料和设备查询供应商的失败测试。
- [ ] 运行测试确认失败。
- [ ] 增加匹配结果区域，区分已合作、备用、候选和待验证，不自动创建供应关系。
- [ ] 提供“加入打样候选”动作并保留产品机会与供应商关联来源。
- [ ] 运行测试确认通过并提交 `feat: link product opportunities to supplier capabilities`。

### Task 5: 回归与云端一致性

**Files:**
- Modify: `tests/e2e/save-load-pipeline.test.ts`
- Modify: `tests/ui/cloud-parity-contract.test.ts`

- [ ] 增加本地保存、重新加载、备份恢复和云端同步契约测试。
- [ ] 运行 `npm test -- --run`、`npx tsc --noEmit`、`git diff --check`。
- [ ] 通过后再同步云端并记录部署结果。
- [ ] 提交 `test: verify supplier capability closure`。

