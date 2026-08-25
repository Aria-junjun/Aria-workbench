# Product Master Family Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将入仓产品主表改成紧凑的产品族汇总表，并让展开后的 SKU 行直接与主表共用列，横向呈现关键经营数据。

**Architecture:** 保留现有 `product-master/page.tsx` 的数据计算和展开状态，只替换主表列定义、产品族行和 SKU 展开行的 JSX 呈现。关注提示在页面内基于既有快照、入仓和供应方案结果计算，不新增数据来源或改变持久化结构。

**Tech Stack:** Next.js 15、React、TypeScript、Tailwind CSS、Vitest。

## Global Constraints

- 不修改现有产品族归类、SKU 主表、月度经营快照、实际入仓快照和供应商关联的数据结构。
- 不删除旧的内部编码、报价、供应商关联或历史月份数据。
- 实际库存、可售库存没有数据时显示“待采集”，不以入仓数量代替库存。
- 不新增财务利润核算口径；ERP 成本基准只作为产品与供应商决策参考。

---

### Task 1: 先固定产品族关注提示的展示规则

**Files:**
- Modify: `C:\Users\Administrator\Documents\店铺\Aria-workbench-main\src\features\workbench\product-master-presentation.ts`
- Test: `C:\Users\Administrator\Documents\店铺\Aria-workbench-main\tests\domain\product-master-presentation.test.ts`

**Interfaces:**
- Consumes: `comparison`, `metricSummary`, `inboundSummary`, `plan` 已有计算结果。
- Produces: 产品族行使用的短关注提示，不写入本地数据。

- [x] **Step 1: 写出关注提示的最小规则测试或确认现有测试可直接覆盖**

检查现有 UI 测试是否能渲染 `ProductMasterPage`。如果该测试只覆盖导入预览，新增纯函数 `getProductFamilyAttention` 时先为以下行为写测试：退货率存在时显示退货提示、上月实发下降时显示下降提示、供应方案待处理时显示供应覆盖提示、无异常时显示“当前无明显异常”。

- [x] **Step 2: 运行针对性测试并确认新测试因函数不存在而失败**

运行：`npm test -- tests/ui/product-master-inbound-import.test.tsx`

预期：新增规则测试在函数未实现时失败；已有导入测试仍可收集。

- [x] **Step 3: 实现最小关注提示函数**

在 `src/app/product-master/page.tsx` 中增加纯函数，最多返回两条短提示，优先级为：供应覆盖待补、退货率需复核、实发较上月下降、经营数据待补、当前无明显异常。函数只读取已有展示计算结果。

- [x] **Step 4: 运行针对性测试确认通过**

运行：`npm test -- tests/ui/product-master-inbound-import.test.tsx`

预期：新增提示规则和原有导入测试全部通过。

- [x] **Step 5: 提交**

```powershell
git add src/app/product-master/page.tsx tests/ui/product-master-inbound-import.test.tsx
git commit -m "feat: add product family attention summary"
```

### Task 2: 收窄主表并让 SKU 行共用主表列

**Files:**
- Modify: `C:\Users\Administrator\Documents\店铺\Aria-workbench-main\src\app\product-master\page.tsx`

**Interfaces:**
- Consumes: `inboundGroups`, `productSkus`, `comparison`, `metricSummary`, `inboundSummary`, `inboundSupplierSummary`, `plan`。
- Produces: 主表列“产品、SKU数、供应方案、经营状态、本月实发、较上月、实际入仓、库存/可售、退货率、ERP成本、关注提示”；展开行使用相同列顺序。

- [x] **Step 1: 删除主表中的完整内部编码列**

将主表表头从“产品、SKU数、内部编码、供应方案、经营状态、经营数据”改成紧凑的决策列；不删除 SKU 数据，只移除主表的堆叠展示。

- [x] **Step 2: 将产品族汇总行映射到关键列**

产品族行保留产品名称和展开按钮、SKU 数、供应方案、经营状态；经营数据拆到本月实发、较上月、实际入仓、库存/可售、退货率、ERP 成本基准、关注提示列中。库存和可售库存合并为一列，缺少数据时显示“待采集 / 待采集”。

- [x] **Step 3: 将展开的 SKU 明细改成同表同列的 `<tr>`**

展开时为每个 SKU 插入一行，使用与主表完全相同的列数量和顺序：产品/SKU、SKU 数、供应方案、经营状态、本月实发、较上月、实际入仓、退货率、ERP 成本、关注提示。SKU 行的第一列显示内部编码与规格，SKU 数列显示短横线，供应方案/经营状态沿用已有数据或显示“—”。

- [x] **Step 4: 保留产品族汇总与 SKU 明细的可读层级**

产品族行使用浅色背景和加粗；SKU 行使用更浅背景、缩进和较小字号。继续使用现有 `expandedFamilies` 状态和“＋/−”按钮，不新增交互入口。

- [x] **Step 5: 运行类型检查**

运行：`npx tsc --noEmit`

预期：无 TypeScript 错误。

- [x] **Step 6: 提交**

```powershell
git add src/app/product-master/page.tsx
git commit -m "feat: align product family and SKU rows"
```

### Task 3: 页面验证与回归检查

**Files:**
- Verify: `C:\Users\Administrator\Documents\店铺\Aria-workbench-main\src\app\product-master\page.tsx`
- Verify: `C:\Users\Administrator\Documents\店铺\Aria-workbench-main\tests\ui\product-master-inbound-import.test.tsx`

**Interfaces:**
- Consumes: Task 1 and Task 2 outputs.
- Produces: 可在本地查看的入仓产品主表。

- [x] **Step 1: 运行全量测试**

运行：`npm test`

预期：全部测试通过；允许存在项目既有的 Supabase 代理测试警告，但不得出现失败。

- [x] **Step 2: 运行生产构建**

运行：`npm run build`

预期：Next.js 生产构建成功。

- [x] **Step 3: 打开本地页面人工复核**

打开：`http://localhost:3000/product-master`；若 3000 被旧进程占用，使用当前可用端口。确认主表不再堆叠内部编码，展开产品族后 SKU 行直接与主表列对齐，经营数据可以横向比较。

- [ ] **Step 4: 确认工作区干净并提交验证结果**

运行：`git status --short` 和 `git log -3 --oneline`，确认没有未预期文件。
