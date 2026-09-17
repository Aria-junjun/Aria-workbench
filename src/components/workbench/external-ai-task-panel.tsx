"use client";

import { useState } from "react";
import { parseAiTaskDraft, type AiTaskDraft, type AiTaskPackage } from "@/features/workbench/ai-task-protocol";

export function ExternalAiTaskPanel({ task, onSaveDraft }: { task: AiTaskPackage; onSaveDraft?: (draft: AiTaskDraft) => void }) {
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<AiTaskDraft | null>(null);
  async function copyTask() {
    await navigator.clipboard?.writeText(task.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  function importDraft() {
    const next = parseAiTaskDraft(input, task);
    setDraft(next);
    onSaveDraft?.(next);
  }
  return <section className="rounded-2xl border border-line bg-surface p-5 shadow-card" aria-label="外部 GPT 任务包"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h2 className="font-display text-xl font-bold text-ink">外部 GPT 任务包</h2><p className="mt-1 text-sm leading-6 text-muted">复制任务包到外部 GPT，生成结果后再回到本页面审核。不会直接覆盖正式记录。</p></div><button type="button" onClick={() => void copyTask()} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white">{copied ? "已复制" : "复制任务包"}</button></div><textarea aria-label="外部 GPT 任务包内容" readOnly value={task.prompt} className="mt-4 min-h-56 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-xs leading-5 text-ink outline-none" /><div className="mt-5 border-t border-line pt-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-ink">导入 AI 初稿</h3><button type="button" onClick={importDraft} disabled={!input.trim()} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">导入识别</button></div><textarea aria-label="AI 初稿导入内容" value={input} onChange={(event) => setInput(event.target.value)} placeholder="把外部 GPT 按任务包生成的 Markdown 粘贴到这里" className="mt-3 min-h-40 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm leading-6 text-ink outline-none placeholder:text-muted-light" /><p className="mt-2 text-xs text-muted">只识别当前任务包声明的字段；未识别内容会保留在草稿提示中。</p>{draft && <div className="mt-3 rounded-xl border border-action/20 bg-action-soft/20 p-3 text-xs text-muted"><p>已识别 {Object.keys(draft.recognizedFields).length} 个字段，未识别 {draft.unrecognizedLines.length} 行。当前保存为 AI 初稿，需人工审核后才能进入正式记录。</p>{draft.unrecognizedLines.length > 0 && <p className="mt-2">未识别内容：{draft.unrecognizedLines.slice(0, 3).join(" / ")}</p>}</div>}</div></section>;
}
