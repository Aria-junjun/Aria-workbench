# Product Cost Reference Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让产品调研输出包含可追溯的市场参考价、分规格参考硬成本，以及有明确降本或去弊端目标的可执行优化方案。

**Architecture:** 不新增前台字段。提示词负责要求 GPT 联网检索并输出精简决策字段；现有原始文档继续保存检索依据。解析器沿用 `optimizationOptions`，只扩展优化表列的映射。

**Tech Stack:** TypeScript、Vitest、Markdown 表格解析。

## Global Constraints

- 不得将市场参考价冒充供应商确认价。
- 来源和日期保留在原始文档，不新增前台展示。
- 优化建议必须包含明确对象、具体方案、成本方向、效果依据、可实现性、风险和验证方法。
- 不增加数据库、API 或新页面。

### Task 1: 收紧调研提示词

**Files:**
- Modify: `src/features/workbench/product-research-prompt.ts`
- Test: `tests/domain/product-research-prompt.test.ts`

- [ ] 新增提示词契约测试，验证市场参考价、分规格成本和优化约束。
- [ ] 修改提示词，区分市场参考、估算和供应商确认价格。
- [ ] 保持输出章节数量不变。

### Task 2: 解析可执行优化方案

**Files:**
- Modify: `src/features/workbench/product-research-parser.ts`
- Test: `tests/domain/product-research-parser.test.ts`

- [ ] 增加新优化表头解析测试。
- [ ] 将效果依据、可实现性、风险和验证方法合并到现有说明字段。
- [ ] 运行产品调研相关测试与类型检查。
