# 供应商绩效技术方案

## 1. 架构

继续采用现有 Next.js App Router、React、TypeScript、local-store/localStorage 和云端同步机制。领域规则放在 `src/features/workbench`，页面只负责展示、筛选、触发动作和导出。

## 2. 建议新增领域模块

- `supplier-performance-baseline.ts`：标准值、版本、生效期和工作日计算。
- `supplier-performance.ts`：交付、首次响应、问题解决、改善、质量指标计算。
- `supplier-performance-export.ts`：将原始事实、基准、公式和结果展开为 CSV/Excel 数据。

## 3. 数据流

```text
导入原始表格
→ 字段识别与质量检查
→ 标准化经营事实
→ 按产品族/供应商聚合
→ 读取有效基准值
→ 计算 KPI 与状态
→ 生成证据链和决策动作
→ 页面摘要 / 细则展开 / 文件导出
```

## 4. 数据结构要求

每个指标结果必须保存：`metricKey`、`period`、`rawValues`、`baseline`、`formula`、`value`、`status`、`evidenceIds`、`responsibility`、`calculatedAt`。`status` 至少包括 `measured`、`not_applicable`、`missing`、`unverifiable`。

基准值必须保存：`metricKey`、`value`、`unit`、`scope`、`source`、`effectiveFrom`、`effectiveTo`、`version`。

## 5. 缺失与冲突处理

- 表头无法识别：阻止导入并显示期望字段。
- 数值缺失：保留原始行，标记待补，不写入 0。
- 日期缺失：相关时效指标为无法判断。
- 供应商归属冲突：进入待确认，不自动归因。
- 同一事实重复导入：按来源、期间、业务键幂等替换，不重复累加。
- 云端暂时不可用：本地保存，显示未同步状态并允许稍后重试。
- 无问题记录：指标状态为 `not_applicable`，不写入 0，不进入总分分母。

## 6. 导出

导出分为“摘要导出”和“完整细则导出”。摘要用于管理汇报；完整细则必须保留原始字段和计算链，不能只导出最终分数。
