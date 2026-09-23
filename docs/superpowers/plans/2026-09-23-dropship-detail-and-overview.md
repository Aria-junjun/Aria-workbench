# 代发履约明细与管理总览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 1688 履约数据转换与归档回填，并将业务明细和管理总览拆成完整事实层与决策层。

**Architecture:** `dropship-performance-import.ts` 负责源数据标准化、名称建议和幂等导入；`dropship-decision-loop.ts` 负责正式记录聚合与管理决策；两个 React 工作台分别消费完整记录和决策摘要。现有本地存储结构继续使用，新增字段保持向后兼容。

**Tech Stack:** TypeScript、React、Next.js、Vitest、Testing Library、SheetJS。

## Global Constraints

- 空白值保持为空，真实零值保持为零。
- 相似供应商名称只能建议，必须人工确认后合并。
- 重复导入同一平台、周期和供应商时更新原记录，不产生重复记录。
- 不改采购主流程，不引入财务结算。

---

### Task 1: 标准化 Excel 百分比与时间值

**Files:**
- Modify: `src/features/workbench/dropship-performance-import.ts`
- Test: `tests/domain/dropship-performance-import.test.ts`

**Interfaces:**
- Produces: `parseDropshipWorkbook(sheets, meta)` 返回业务百分数和秒数，而不是 Excel 存储小数。

- [ ] **Step 1: 写失败测试**

增加源值 `1`、`0.143`、`0.0177141203703703`，断言分别得到 `100`、`14.3`、`1530`，同时断言空白仍为 `undefined`、零仍为 `0`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run tests/domain/dropship-performance-import.test.ts`
Expected: 百分比或时长断言失败。

- [ ] **Step 3: 最小实现**

新增字段级转换：

```ts
const percentage = (value: unknown) => {
  const parsed = number(value);
  return parsed == null ? undefined : Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
};
const seconds = (value: unknown) => {
  const parsed = number(value);
  return parsed == null ? undefined : parsed > 0 && parsed < 1 ? parsed * 86400 : parsed;
};
```

仅在百分比列和平均退款时长列使用对应转换。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run tests/domain/dropship-performance-import.test.ts`
Expected: PASS。

### Task 2: 别名确认与完整字段回填

**Files:**
- Modify: `src/features/workbench/dropship-performance-import.ts`
- Modify: `src/features/workbench/local-store.ts`
- Modify: `src/components/workbench/dropship-performance-import-dialog.tsx`
- Test: `tests/domain/dropship-performance-import.test.ts`
- Test: `tests/ui/dropship-performance-import.test.tsx`

**Interfaces:**
- Produces: `supplierAliases?: Array<{ sourceName: string; supplierId: string; platform: string }>`。
- Produces: `applyDropshipImport(data, preview, decisions)` 将同一供应商的 merchant 与 afterSales 合并，并以非空源字段回填正式记录。

- [ ] **Step 1: 写失败测试**

构造“江苏新丰之星膜材料有限公司”和“新丰之星装饰材料”两行，人工决策映射至同一供应商；断言只生成一条周期记录，且同时包含 merchant 和 afterSales 字段。再次导入断言记录数不变，人工已有非空字段不被空源覆盖。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run tests/domain/dropship-performance-import.test.ts tests/ui/dropship-performance-import.test.tsx`
Expected: 合并、别名保存或幂等回填断言失败。

- [ ] **Step 3: 最小实现**

在预览中允许售后来源单独选择正式供应商；应用导入时先按最终 `supplierId` 聚合来源，再调用一次 `importedRecord`。新增别名映射并在后续预览中作为建议使用。字段合并规则为“新来源非空则更新，否则保留旧值”。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run tests/domain/dropship-performance-import.test.ts tests/ui/dropship-performance-import.test.tsx`
Expected: PASS。

### Task 3: 完整业务明细展示

**Files:**
- Modify: `src/components/workbench/supplier-record-fields.ts`
- Modify: `src/components/workbench/supplier-business-ledger.tsx`
- Test: `tests/ui/supplier-business.test.tsx`

**Interfaces:**
- Consumes: `SupplierBusinessRecord.fields` 的完整代发字段。
- Produces: 列表核心摘要与详情完整字段分组。

- [ ] **Step 1: 写失败测试**

渲染包含零值、空值和完整字段的记录；断言详情包含交付、售后、灯塔和来源分组，零值显示 `0%`，空值显示“未采集”。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run tests/ui/supplier-business.test.tsx`
Expected: 完整字段或空零区分断言失败。

- [ ] **Step 3: 最小实现**

扩充字段配置：`paymentToSignChangeHours`、`afterSalesCount`、`afterSalesRate`、`rejectedAfterSalesCount`、`rejectedAfterSalesRate`、`averageRefundSeconds`、`lighthouseAfterSales`、`lighthouseQuality`、`lighthouseScore`、`dataSource`、`sourceEvidence`。统一格式化函数以 `value === '' || value == null` 判断缺失，不使用真假值判断。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run tests/ui/supplier-business.test.tsx`
Expected: PASS。

### Task 4: 管理决策总览

**Files:**
- Modify: `src/features/workbench/dropship-period-performance.ts`
- Modify: `src/features/workbench/dropship-decision-loop.ts`
- Modify: `src/components/workbench/supplier-lifecycle-workspace.tsx`
- Test: `tests/domain/dropship-decision-loop.test.ts`
- Test: `tests/ui/supplier-lifecycle.test.tsx`

**Interfaces:**
- Produces: 决策摘要包含有效样本数、缺失数据数、别名待确认数、风险原因、建议动作和趋势状态。

- [ ] **Step 1: 写失败测试**

断言空百分比不按零参与加权或触发风险；只有一个周期显示“暂无趋势”；风险项显示建议动作和明细入口。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run tests/domain/dropship-decision-loop.test.ts tests/ui/supplier-lifecycle.test.tsx`
Expected: 缺失值排除、趋势或建议动作断言失败。

- [ ] **Step 3: 最小实现**

指标解析使用 `number | undefined`；聚合时只对存在的指标加权。总览保留规模、关键比率、风险、趋势和行动，完整原始字段只通过“查看业务明细”进入。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run tests/domain/dropship-decision-loop.test.ts tests/ui/supplier-lifecycle.test.tsx`
Expected: PASS。

### Task 5: 综合回归与真实页面验证

**Files:**
- Verify: `src/features/workbench/dropship-performance-import.ts`
- Verify: `src/components/workbench/supplier-business-ledger.tsx`
- Verify: `src/components/workbench/supplier-lifecycle-workspace.tsx`

- [ ] **Step 1: 运行相关测试与类型检查**

Run: `npm test -- --run tests/domain/dropship-performance-import.test.ts tests/domain/dropship-period-performance.test.ts tests/domain/dropship-decision-loop.test.ts tests/domain/local-store.test.ts tests/ui/dropship-performance-import.test.tsx tests/ui/supplier-business.test.tsx tests/ui/supplier-lifecycle.test.tsx`

Run: `npx tsc --noEmit`

Run: `git diff --check`

Expected: 全部退出码为 0；仅允许工作区既有 CRLF 提示。

- [ ] **Step 2: 浏览器验证**

重新导入 `C:\Users\Administrator\Desktop\代发供应商履约表.xlsx`，人工确认“新丰之星装饰材料”关联江苏新丰；验证业务详情完整字段与管理总览决策字段。不得自动处理其他待建档供应商。
