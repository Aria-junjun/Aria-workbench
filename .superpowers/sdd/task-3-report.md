# Task 3 实施报告：统一证据引用选择器

## 范围与交付

- 新增 `src/components/workbench/evidence-reference-picker.tsx`，接受目标模块/项目、当前引用、带模块/项目/字段/状态元数据的来源项目。
- 选择器只展示 `confirmed` 字段；`ai-draft`、`original`、`edited`、`inference`、`to-verify` 均由 `canReferenceEvidence` 拦截。
- 通过单向规则限制来源：行业洞察 → 需求探索/竞品分析；需求探索/竞品分析 → 产品拆解。行业洞察使用只读来源模式，不接收回写。
- 新引用记录目标模块与项目，并保存独立 `snapshot`。目标侧可直接编辑该副本，始终显示“引用自：模块 / 项目 / 字段”；不会修改目标业务字段，也不会自动写回来源。
- 已接入行业洞察、需求探索、竞品分析、产品拆解四个工作区；引用集合持久化至本地工作台数据。

## TDD 记录

1. 先新增 `tests/ui/evidence-reference-picker.test.tsx`。
2. 首次运行失败，原因是选择器模块不存在（预期 RED）。
3. 实现最小选择器后，修正 JSX 运行时导入和受控组件测试装配，再运行通过（GREEN）。

## 验证结果

- `npx vitest run tests/ui/evidence-reference-picker.test.tsx tests/ui/external-ai-task-panel.test.tsx`
  - 2 个测试文件、3 个测试通过。
  - `external-ai-task-panel` 测试打印了既有的本地同步重试提示（测试环境中 `/api/supabase-proxy` 无 URL），不影响通过结果。
- `npx tsc --noEmit`
  - 退出码 0，无类型错误。
- `git diff --check`
  - 无空白错误。

## 自检

- 未修改供应商、货盘或产品管理文件；提交仅包含 Task 3 文件和本报告。
- 每条选择器候选同时受来源状态和模块方向约束；目标项目现有引用仅按自身 `targetModule` 与 `targetProjectId` 显示。
- 目标侧编辑只替换该引用记录的 `snapshot`，不会覆盖工作区表单字段，也不触发来源项目保存。

## 已知限制

现有行业、需求、竞品、拆解领域对象没有原生的“字段确认状态”。因此本实现只把已持久化且状态为 `confirmed` 的 `EvidenceReference` 记录转成来源候选；不会把“项目已完成”“事实标签”或 AI 草稿推断为已确认。若需从原始业务字段直接引用，后续必须先在这些领域模型中增加明确的人工确认状态与发布动作。
