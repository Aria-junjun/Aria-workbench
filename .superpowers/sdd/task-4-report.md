# Task 4 Report — 证据状态与冲突

## 交付

- 新增纯函数 `findEvidenceConflicts`：在同一目标模块、项目和字段路径内识别非空且不同的快照，保留所有引用来源，不自动选优或删除。
- 新增 `markEvidenceConflictToVerify`：只把冲突引用副本状态改为 `to-verify`，保留快照和来源。
- 行业洞察、竞品分析、产品拆解和需求探索均接入证据状态面板，明确显示事实、推断、待验证、信息缺口和来源板块；冲突来源并列展示并可转为待验证。
- 未修改供应商、报价、产品管理，未创建新的机会产品实体。

## TDD 记录

- 领域测试先因 `evidence-conflicts` 模块不存在而失败，最小实现后通过。
- 展示测试先因状态组件不存在而失败；实现后发现项目 JSX 测试运行时需显式导入 React，补齐后通过。

## 验证

- `npx vitest run tests/domain/evidence-conflicts.test.ts tests/domain/ai-task-protocol.test.ts tests/ui/evidence-conflict-status.test.tsx`：3 个测试文件、8 个断言通过。
- `npx tsc --noEmit`：通过。
- `git diff --check`：通过；仅输出工作区既有文件的 CRLF 提示，无空白错误。

## 已知边界

现有 `EvidenceReference` 没有单独的 `targetFieldPath`。冲突分组因此使用现有可追溯键：`targetModule + targetProjectId + sourceFieldPath`。若后续允许把引用直接绑定到目标业务字段，应先扩展数据模型并补充迁移与测试，不能在本任务中猜测映射关系。
