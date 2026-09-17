# Task 2 完整报告：最小证据引用领域模型

## 结论

Task 2 已完成。新增了证据引用类型与创建/可引用判断函数，并将引用集合接入工作台统一持久化规范化流程。

## 实现内容

- 新增 `src/features/workbench/evidence-references.ts`。
  - 导出 `EvidenceReferenceStatus` 的六种状态。
  - 导出四类 `EvidenceReferenceModule`。
  - 导出包含来源模块、项目、字段、快照、状态和引用时间的 `EvidenceReference`。
  - `createEvidenceReference` 使用现有随机 ID 工具生成 `id`，使用 ISO 时间生成 `referencedAt`，完整保留输入快照。
  - `canReferenceEvidence` 仅对 `confirmed` 返回 `true`。
- 修改 `src/features/workbench/local-store.ts`。
  - `LocalWorkbenchData` 增加可选 `evidenceReferences?: EvidenceReference[]`。
  - 统一 `normalizeWorkbenchData` 在读取旧 JSON 或缺失字段时返回空数组；已有引用数组则原样保留。
  - 未修改项目业务字段、AI 草稿语义或供应商/报价/产品管理文件。
- 新增 `tests/domain/evidence-references.test.ts`，覆盖状态规则、完整引用创建、旧数据兼容和保存重载。

## TDD 记录

1. 先写测试并运行 `npx vitest run tests/domain/evidence-references.test.ts`。
2. 测试按预期失败：领域模块尚不存在，未执行任何测试用例。
3. 完成最小实现后运行指定测试并通过。

## 验证结果

- `npx vitest run tests/domain/evidence-references.test.ts tests/domain/research-project-links.test.ts`
  - 2 个测试文件通过。
  - 6 个测试通过，0 失败。
- `npx tsc --noEmit`
  - 退出码 0，无类型错误。
- `git diff --check`
  - 通过；仅报告现有工作区文件的换行符转换提示，无空白错误。

## 自检与疑虑

- 变更范围仅包含本任务要求的领域文件、持久化文件、领域测试和本报告；未纳入工作区中其他未提交的供应商、报价或产品管理改动。
- 证据集合放在 `LocalWorkbenchData` 顶层，这是当前 brief/implementation plan 所描述的统一持久化数据边界；四类研究项目的既有业务结构未被扩展。
- 测试保存时会触发既有云端同步尝试，在 Node 测试环境产生 `Failed to parse URL from /api/supabase-proxy` 的告警，但本地保存/读取断言通过，且该告警不影响本任务验证。
