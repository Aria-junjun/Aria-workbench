# 供应商月度成本联动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让产品板块导入的月度结算/入仓数据自动联动到供应商—产品族—SKU成本核验，供应商页面不再重复填写基准价、结算价和采购数量。

**Architecture:** 产品导入保存 SKU 映射、月份、数量、结算单价和金额；供应商详情根据已确认供应关系与货盘报价动态生成当前月度产品族汇总和 SKU 明细。供应商责任增量成本仍作为独立的月度事件，不与基础采购数据混淆。

**Tech Stack:** Next.js + React + TypeScript + Vitest + 本地工作台存储。

## Global Constraints

- 不把不同产品族或不同供应商的数量合并成一个总量。
- 无法匹配基准报价或结算单价时显示“待复核/N/A”，不补零、不猜测。
- 本轮只改本地代码和本地数据，不同步云端。

### Task 1: 扩展导入事实并生成成本核验明细

**Files:**
- Modify: `src/components/workbench/supplier-inbound-import-preview.tsx`
- Modify: `src/features/workbench/local-store.ts`
- Create: `src/features/workbench/supplier-monthly-cost.ts`
- Test: `tests/domain/supplier-monthly-cost.test.ts`

- [ ] 先增加失败测试：导入行带结算价和数量时，按 SKU 与货盘报价生成产品族成本核验；缺少价格时不生成可评分结果。
- [ ] 保存导入行的结算单价、结算金额。
- [ ] 实现供应商—月份—产品族汇总和 SKU 明细，基准价按入仓数量加权。
- [ ] 运行领域测试确认通过。

### Task 2: 重做供应商详情成本区域

**Files:**
- Modify: `src/app/suppliers/[supplierId]/page.tsx`
- Test: `tests/ui/supplier-evidence-display.test.tsx`

- [ ] 删除基准价、结算价、采购数量手工输入。
- [ ] 当前月份自动展示累计数据和增量成本事件。
- [ ] 历史月份按月份→产品族→SKU展示核验结果。
- [ ] 增量成本仅允许作为有证据的事件录入。

### Task 3: 验证

- [ ] 运行相关 Vitest 测试。
- [ ] 运行 `npx tsc --noEmit`。
- [ ] 用本地浏览器刷新供应商详情页，确认无运行时错误且月份、产品族、SKU数据可见。
- [ ] 运行 `git diff --check`，不提交云端。
