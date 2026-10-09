"use client";

import { useState } from "react";
import type { IndustryInsightProject } from "@/features/workbench/industry-insight";
import { buildIndustryInsightResearchPrompt, parseIndustryInsightMarkdown, type IndustryInsightImportResult } from "@/features/workbench/industry-insight-bridge";

export function InsightBridgePanel({ project, onSave, referencedEvidence = "" }: { project: IndustryInsightProject; onSave: (next: IndustryInsightProject) => void; referencedEvidence?: string }) {
  const [prompt, setPrompt] = useState(() => buildIndustryInsightResearchPrompt(project, referencedEvidence));
  const [input, setInput] = useState("");
  const [result, setResult] = useState<IndustryInsightImportResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const refreshPrompt = () => setPrompt(buildIndustryInsightResearchPrompt(project, referencedEvidence));
  const copyPrompt = async () => {
    const nextPrompt = buildIndustryInsightResearchPrompt(project, referencedEvidence);
    setPrompt(nextPrompt);
    await navigator.clipboard?.writeText(nextPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const importDraft = () => {
    const next = parseIndustryInsightMarkdown(input);
    setResult(next);
    if (next.drafts.length === 0) return;
    const drafts = next.drafts.map((draft) => ({ ...draft, status: "draft" as const }));
    const merged = { ...project, aiDrafts: [...project.aiDrafts, ...drafts] };
    onSave(merged);
  };
  return <section className="rounded-2xl border border-line bg-surface p-5 shadow-card" aria-label="外部 GPT 桥接">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-action">External GPT Bridge</p>
        <button type="button" aria-expanded={open} aria-controls="industry-insight-ai-bridge-content" onClick={() => setOpen((current) => !current)} className="mt-1 flex items-center gap-2 text-left">
          <h2 className="font-display text-xl font-bold text-ink">外部 GPT 研究桥接</h2>
          <span className="text-sm font-normal text-muted">{open ? "收起" : "展开 AI 辅助"}</span>
        </button>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">先复制字段任务包到外部 GPT，再把结构化 Markdown 结果粘贴回来。AI 初稿不会直接写入正式记录。</p>
      </div>
      <span className="rounded-full bg-paper-warm px-3 py-1 text-xs font-semibold text-muted">已保存 {project.aiDrafts.length} 条 AI 初稿</span>
    </div>

    {open && <div id="industry-insight-ai-bridge-content">
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-paper p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-ink">1. 外部 GPT 任务包</h3>
          <button type="button" onClick={copyPrompt} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white">{copied ? "已复制" : "复制外部 GPT 任务包"}</button>
        </div>
        <textarea aria-label="外部 GPT 任务包" value={prompt} onChange={(event) => setPrompt(event.target.value)} onFocus={refreshPrompt} className="mt-3 min-h-64 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-ink outline-none focus:border-action" />
        <p className="mt-2 text-xs leading-5 text-muted">任务包只允许使用当前六个板块的字段；找不到资料时要求外部 GPT 明确写“未找到”。</p>
      </div>

      <div className="rounded-xl border border-line bg-paper p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-ink">2. 导入 AI 初稿</h3>
          <button type="button" onClick={importDraft} disabled={!input.trim()} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">导入 AI 初稿</button>
        </div>
        <textarea aria-label="AI 初稿导入内容" value={input} onChange={(event) => setInput(event.target.value)} placeholder="把外部 GPT 按任务包生成的 Markdown 粘贴到这里" className="mt-3 min-h-64 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-ink outline-none placeholder:text-muted-light focus:border-action" />
        <p className="mt-2 text-xs leading-5 text-muted">导入只保存为 draft；需要你逐条审核后，才可以进入正式字段。</p>
      </div>
    </div>

    {result && <div className="mt-5 rounded-xl border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-ink">导入结果</h3>
        <span className="rounded-full bg-action-soft px-2 py-1 text-xs font-semibold text-action">识别到 {result.drafts.length} 条草稿</span>
        <span className="rounded-full bg-paper-warm px-2 py-1 text-xs font-semibold text-muted">{result.warnings.length} 条警告</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">当前仅保存 AI 初稿，不会覆盖决策问题、行业边界、四维分析等正式记录。</p>
      {result.warnings.length > 0 && <div className="mt-3 rounded-lg border border-dashed border-warning bg-warning/5 p-3">
        <p className="text-sm font-semibold text-ink">识别失败内容</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted">{result.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
      </div>}
      {result.drafts.length > 0 && <p className="mt-3 rounded-lg bg-action-soft px-3 py-2 text-xs leading-5 text-muted">已导入的字段审核明细已收进下方“证据审核与引用”，请在那里统一采用、修改或暂不采用。</p>}
    </div>}
    </div>}
  </section>;
}
