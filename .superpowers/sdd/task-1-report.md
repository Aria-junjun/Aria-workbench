# Task 1 实施报告

## 结论

Task 1 已完成。外部 AI 结果继续作为独立初稿处理：导入识别、修改保存、确认保存彼此分离；确认保存仅通过回调追加新的 `aiDrafts` 记录，不写入需求、竞品分析或产品拆解的正式字段。

## 需求核对

- `parseAiTaskDraft(text, task)` 的签名保持不变。
- `AiTaskDraft` 的 `rawText`、`recognizedFields`、`unrecognizedLines`、`importedAt` 字段保持不变。
- 面板保留导入识别、修改/保存修改、确认保存三个状态阶段。
- 识别结果通过各工作区的 `aiDrafts: [...existing, draft]` 追加保存，不覆盖原始项目字段。
- 未知 Markdown 字段继续进入 `unrecognizedLines`，原文继续保存在 `rawText`；面板现在提供“原始 AI 初稿”展开查看，并完整展示未识别内容，不再只显示前三行。
- 确认保存后历史记录数量由工作区追加逻辑增加，正式研究字段保持不变。
- 未修改供应商、报价或产品管理相关文件。

## TDD 记录

1. 在 `tests/ui/external-ai-task-panel.test.tsx` 增加 `draft.rawText` 和“原始 AI 初稿”契约断言。
2. 先运行指定测试，得到预期失败：面板源码不包含 `draft.rawText`。
3. 在 `src/components/workbench/external-ai-task-panel.tsx` 增加原始文本展开区，并将未识别内容从前三行改为完整展示。
4. 重新运行指定测试，全部通过。

## 验证结果

- 命令：`npx vitest run tests/domain/ai-task-protocol.test.ts tests/ui/external-ai-task-panel.test.tsx`
- 结果：2 个测试文件通过，5 个测试通过，0 失败。
- 命令：`npx tsc --noEmit`
- 结果：退出码 0，无类型错误。
- 工作区已有与本 Task 无关的未提交改动，提交时仅选择本 Task 文件。

## 自检与疑虑

- 自检确认没有把 AI 初稿字段合并到任何正式业务字段，也没有改变协议字段名或解析函数签名。
- Vitest 输出包含 Vite CJS API 弃用提示；该提示来自现有测试工具链，不影响测试结果，本 Task 未修改依赖配置。
- 当前 UI 测试仍以源码契约为主，未新增浏览器交互测试；需求规定的验证命令仅要求该测试文件，类型检查和指定测试均已通过。

## 复核修复记录

独立复核指出两项缺口，已完成修复：

1. `saveEdits()` 现在先创建复制了 `recognizedFields` 的编辑稿，再调用明确的 `onSaveDraft(next)` 保存回调。因此编辑稿会追加为可恢复历史记录；确认保存仍再次调用回调追加确认记录，任何路径都不合并正式研究字段。
2. `tests/ui/external-ai-task-panel.test.tsx` 已改为驱动实际 `ExternalAiTaskPanel` 组件函数返回的 React 元素树，调用真实的输入变更、导入、修改、保存修改和确认处理器，并断言回调参数、历史数量、原始内容和未识别内容。测试不再读取源码或依赖源码字符串断言。

本次复核修复验证：

- `npx vitest run tests/domain/ai-task-protocol.test.ts tests/ui/external-ai-task-panel.test.tsx`：2 个测试文件通过，5 个测试通过，0 失败。
- `npx tsc --noEmit`：退出码 0，无类型错误。

## 第二轮复核处理结果

第二轮复核要求使用现有 RTL `render` 入口驱动真实组件，并补充可恢复历史与不同记录 ID。已完成业务代码方向修复：编辑保存和确认保存分别通过 `createAiTaskDraftRevision()` 生成新的稳定持久化 ID，三个工作区仍只追加 `aiDrafts`，不写入正式字段。

但本轮无法形成可提交的通过结果，状态为 BLOCKED。项目未安装 `jsdom`、`happy-dom` 或其他 DOM 实现；当前 Vitest 环境为 `node`。使用 RTL `render` 加测试内 DOM shim 后，React 受控 textarea 的真实事件无法稳定触发组件状态更新，且 shim 类型不满足 RTL `fireEvent` 的 DOM 类型要求。

阻塞证据：

- `npx vitest run tests/domain/ai-task-protocol.test.ts tests/ui/external-ai-task-panel.test.tsx`：协议测试 4 个通过，UI 测试失败，导入后未出现“原始 AI 初稿”。
- `npx tsc --noEmit`：测试 shim 的 `TestElement` 不满足 RTL `fireEvent` 所需的 `Element` 类型，退出码非 0。

因此本轮没有创建新提交；工作区中的未提交修复不应被视为已验收代码。解除阻塞需要允许在 Task 1 范围之外补充 DOM 测试依赖，或提供项目现成的 DOM 测试环境后重新运行真实 RTL 交互测试。

## 最终解阻记录

已解除第二轮复核的测试环境阻塞。

- 在开发依赖中加入 `jsdom`，并只通过 `tests/ui/external-ai-task-panel.test.tsx` 的 `@vitest-environment jsdom` 注释启用它；其余测试继续使用现有 `node` 环境。
- 删除测试内手写 DOM shim，改用 `@testing-library/react` 的真实 `render` 与 `fireEvent` 驱动输入、导入、修改、保存修改和确认保存。
- 用例现在将保存回调的结果序列化后卸载并重新渲染面板，验证两条历史记录可恢复、ID 不同，且两条记录都保留原文与未识别内容；正式字段快照保持不变。
- 验证：`npx vitest run tests/domain/ai-task-protocol.test.ts tests/ui/external-ai-task-panel.test.tsx` 通过（2 个文件、5 个测试、0 失败）；`npx tsc --noEmit` 通过（退出码 0）。

## 第三轮复核修复记录

- 历史 AI 初稿不再只显示已识别字段；每条已保存记录会完整显示未识别内容和原始 AI 初稿。重新读取 `savedDrafts` 后，这两项仍直接显示在历史卡片中。
- `tests/ui/external-ai-task-panel.test.tsx` 增加真实 localStorage 保存/重新读取回归：分别调用需求确认、竞品分析、产品拆解的保存和读取 API，确认每个重载对象保留 AI 初稿的 `rawText`、`unrecognizedLines` 与识别字段，并把移除 `aiDrafts` 后的完整正式字段快照与保存前逐一比对。
- 验证：`npx vitest run tests/domain/ai-task-protocol.test.ts tests/ui/external-ai-task-panel.test.tsx` 通过（2 个文件、6 个测试、0 失败）；`npx tsc --noEmit` 通过（退出码 0）。测试环境对本地保存后的云端异步同步尝试会输出 URL 不可解析告警；本用例断言的 localStorage 保存/加载链路已完成，不依赖该代理请求。
