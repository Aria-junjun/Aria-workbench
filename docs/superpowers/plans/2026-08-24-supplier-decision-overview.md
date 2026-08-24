# 供应商决策总览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将供应商首页从“评分展示”升级为基于实际供货、SKU覆盖和可追溯证据的供应商决策总览。

**Architecture:** 保留现有供应商档案和详情页作为事实与记录入口，在供应商列表页增加决策层汇总。决策层只消费现有的月度实际入仓、SKU主表、产品主表、沟通/异常记录和货盘关系，不复制聚水潭的采购、库存或财务流程。供应商综合分数降为有数据时的参考，不作为唯一结论。

**Tech Stack:** Next.js 15、React、TypeScript、Vitest、现有 local-store/workbench-store 数据模型。

## Global Constraints

- 聚水潭是交易与采购事实来源，工作台只做决策、协同和溯源。
- 手工采集按月度优先，不新增日常录入负担。
- 缺少证据时显示“未采集”，不自动补零、不自动生成优秀/淘汰结论。
- 产品退货率只能作为产品质量复核信号，多供应商场景下不得直接归因给单个供应商。
- 保留现有供应商档案、评分历史、沟通记录和货盘数据，不删除原数据。

### Task 1: 建立供应商决策行的纯函数

**Files:**
- Modify: `src/features/workbench/product-master.ts`
- Test: `tests/domain/product-master-inbound.test.ts`

**Interfaces:**
- Consumes: 当前月份 `monthlyInboundSnapshots`、产品族 SKU、供应商身份和已有经营快照。
- Produces: 每个产品族的实际供应商覆盖、供应商角色信号、可解释动作和证据说明。

- [ ] **Step 1: Write the failing test**

添加三个行为测试：单一供应商覆盖全部 SKU 返回“保持主供”；同一产品族存在多供应商返回“复核主供/备供”；缺少供应商归属返回“补充实际供应商”。测试同时断言覆盖数量和原因文本。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/domain/product-master-inbound.test.ts`

Expected: 新增决策函数不存在或断言失败，现有入仓汇总测试继续通过。

- [ ] **Step 3: Write minimal implementation**

实现 `buildProductSupplierDecisionRows`，输出 `maintain_primary`、`review_split`、`confirm_supplier`、`complete_coverage`、`review_quality` 五种决策。规则优先级为：供应商未确认 → 供应商分拆 → SKU覆盖不完整 → 退货率达到复核阈值 → 保持主供。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/domain/product-master-inbound.test.ts`

Expected: 所有该测试文件通过。

- [ ] **Step 5: Commit**

```bash
git add tests/domain/product-master-inbound.test.ts src/features/workbench/product-master.ts
git commit -m "feat: derive supplier decision signals"
```

### Task 2: 在供应商列表页增加决策总览

**Files:**
- Modify: `src/app/suppliers/page.tsx`
- Test: `tests/ui/supplier-decision-overview.test.tsx`

**Interfaces:**
- Consumes: Task 1 的决策行、现有供应商列表及其实际入仓关联。
- Produces: “供应商决策总览”和“供应商协同清单”，每一行显示证据来源和下一步动作。

- [ ] **Step 1: Write the failing test**

添加 UI 测试，验证页面出现“实际供货产品”“SKU覆盖”“主供/备供”“当前问题”“下一步动作”字段，并验证缺少分数时仍能显示事实和“未采集”，不把分数作为必填项。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/ui/supplier-decision-overview.test.tsx`

Expected: 页面当前没有决策总览字段，测试失败。

- [ ] **Step 3: Write minimal implementation**

在供应商列表页顶部加入三个汇总数字：需要复核、供应商分拆、待确认供应商；下方加入协同表格，显示供应商、实际供货产品、SKU覆盖、本月实际入仓、当前证据和建议动作。现有评分列改为“评分参考”，没有评分数据时显示“未采集”。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/ui/supplier-decision-overview.test.tsx`

Expected: 新增 UI 测试通过，原有供应商测试不受影响。

- [ ] **Step 5: Commit**

```bash
git add src/app/suppliers/page.tsx tests/ui/supplier-decision-overview.test.tsx
git commit -m "feat: add supplier decision overview"
```

### Task 3: 回归验证并同步

**Files:**
- Verify: `src/app/suppliers/page.tsx`, `src/features/workbench/product-master.ts`, existing supplier and product tests

- [ ] **Step 1: Run focused tests**

Run: `npm test -- --run tests/domain/product-master-inbound.test.ts tests/ui/supplier-decision-overview.test.tsx`

- [ ] **Step 2: Run full tests and type check**

Run: `npm test -- --run` and `npx tsc --noEmit`

Expected: 全部测试通过，类型检查无错误。

- [ ] **Step 3: Run production build**

停止本地开发服务器后运行 `npm run build`；构建完成后清理 `.next` 并重新启动开发服务器，避免开发缓存与生产构建冲突。

- [ ] **Step 4: Verify local routes**

验证 `/suppliers`、`/product-master`、`/offers` 返回 HTTP 200，并检查供应商列表能正常加载。

- [ ] **Step 5: Push to GitHub**

```bash
git push origin HEAD:main
```

确认工作区干净并记录提交哈希；Vercel 再由 `main` 分支自动部署。
