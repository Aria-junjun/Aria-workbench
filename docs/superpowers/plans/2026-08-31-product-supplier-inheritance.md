# 产品族供应关系继承与编码切换 Implementation Plan

> **For agentic workers:** This plan is executed inline in the current task. Cloud sync is intentionally excluded until explicit confirmation.

**Goal:** 让经营编码默认继承产品族已确认的主供/备供关系，并提供单一入口切换关系，避免逐 SKU 重复确认。

**Architecture:** 继续使用现有 `productSupplierAssignments` 作为唯一关系来源。产品主表按统计月份读取产品族有效关系，显示主供和备供；经营编码层只调用同一保存函数新增或替换产品族关系，不创建 SKU 级关系。SKU 级关系仅保留为明确例外。

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, 现有 local-store/localStorage 数据层。

## Global Constraints

- 只修改本地工作区，不推送云端。
- 不改变销售 SKU 编码和入仓按经营编码归并规则。
- 供应商关系变更必须保留生效月份、变更原因和关系依据。
- 未确认或冲突关系仍需要提示，已确认关系不重复提示。

### Task 1: 关系读取与页面继承

**Files:**
- Modify: `src/features/workbench/relationship-rules.ts`
- Modify: `src/app/product-master/page.tsx`
- Test: `tests/domain/relationship-rules.test.ts`
- Test: `tests/ui/product-master-relationship-status.test.ts`

- [ ] 先增加“主供优先、备供可见”的关系读取测试。
- [ ] 运行定向测试确认新断言失败。
- [ ] 增加读取全部有效产品族关系的最小实现，并让页面统一使用它。
- [ ] 运行定向测试确认通过。

### Task 2: 编码层切换入口

**Files:**
- Create: `src/components/workbench/operating-product-supplier-editor.tsx`
- Modify: `src/app/product-master/page.tsx`
- Test: `tests/ui/product-master-relationship-status.test.ts`

- [ ] 先增加页面契约测试，要求存在“调整供应关系”、角色选择和依据字段。
- [ ] 运行测试确认失败。
- [ ] 实现最小编辑器：供应商下拉、主供/备供选择、生效月份、原因/依据必填，保存到产品族关系。
- [ ] 运行定向测试和类型检查。

### Task 3: 回归验证

- [ ] 运行完整 Vitest。
- [ ] 运行 TypeScript 检查。
- [ ] 检查本地页面 HTTP 可访问。
- [ ] 本地提交变更，不执行 `git push`。
