"use client";

import { useState } from "react";
import type { AiTaskPackage } from "@/features/workbench/ai-task-protocol";

export function ExternalAiTaskPanel({ task }: { task: AiTaskPackage }) {
  const [copied, setCopied] = useState(false);
  async function copyTask() {
    await navigator.clipboard?.writeText(task.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return <section className="rounded-2xl border border-line bg-surface p-5 shadow-card" aria-label="外部 GPT 任务包"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h2 className="font-display text-xl font-bold text-ink">外部 GPT 任务包</h2><p className="mt-1 text-sm leading-6 text-muted">复制任务包到外部 GPT，生成结果后再回到本页面审核。不会直接覆盖正式记录。</p></div><button type="button" onClick={() => void copyTask()} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white">{copied ? "已复制" : "复制任务包"}</button></div><textarea aria-label="外部 GPT 任务包内容" readOnly value={task.prompt} className="mt-4 min-h-56 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-xs leading-5 text-ink outline-none" /></section>;
}
