"use client";

import { useState } from "react";
import type { IndustryInsightProject } from "@/features/workbench/industry-insight";
import { applyIndustryInsightDraft, buildIndustryInsightResearchPrompt, getIndustryInsightDraftStatusDisplay, getIndustryInsightFieldDisplay, parseIndustryInsightMarkdown, type IndustryInsightDraftField, type IndustryInsightDraftStatus, type IndustryInsightImportResult } from "@/features/workbench/industry-insight-bridge";

export function InsightBridgePanel({ project, onSave }: { project: IndustryInsightProject; onSave: (next: IndustryInsightProject) => void }) {
  const [prompt, setPrompt] = useState(() => buildIndustryInsightResearchPrompt(project));
  const [input, setInput] = useState("");
  const [result, setResult] = useState<IndustryInsightImportResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedValue, setEditedValue] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const refreshPrompt = () => setPrompt(buildIndustryInsightResearchPrompt(project));
  const copyPrompt = async () => {
    const nextPrompt = buildIndustryInsightResearchPrompt(project);
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
  const review = (draft: IndustryInsightDraftField, status: IndustryInsightDraftStatus) => {
    const nextDraft = { ...draft, status, ...(status === "edited" ? { editedValue } : {}) };
    const nextProject = { ...project, aiDrafts: project.aiDrafts.map((item) => item.id === draft.id ? nextDraft : item) };
    onSave(status === "accepted" || status === "edited" ? applyIndustryInsightDraft(nextProject, nextDraft) : nextProject);
    if (status === "accepted" || status === "edited" || status === "rejected") {
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(draft.id);
        return next;
      });
    }
    setEditingId(null);
    setEditedValue("");
  };
  const toggleExpanded = (draftId: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(draftId)) next.delete(draftId);
    else next.add(draftId);
    return next;
  });

  return <section className="rounded-2xl border border-line bg-surface p-5 shadow-card" aria-label="外部 GPT 桥接">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-action">External GPT Bridge</p>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">外部 GPT 研究桥接</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">先复制字段任务包到外部 GPT，再把结构化 Markdown 结果粘贴回来。AI 初稿不会直接写入正式记录。</p>
      </div>
      <span className="rounded-full bg-paper-warm px-3 py-1 text-xs font-semibold text-muted">已保存 {project.aiDrafts.length} 条 AI 初稿</span>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-paper p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-ink">1. 外部 GPT 任务包</h3>
          <button type="button" onClick={copyPrompt} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white">{copied ? "已复制" : "复制外部 GPT 任务包"}</button>
        </div>
        <textarea aria-label="外部 GPT 任务包" value={prompt} onChange={(event) => setPrompt(event.target.value)} onFocus={refreshPrompt} className="mt-3 min-h-64 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-xs leading-5 text-ink outline-none focus:border-action" />
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
      {result.drafts.length > 0 && <div className="mt-3 space-y-2">{result.drafts.map((draft) => <DraftCard key={draft.id} draft={project.aiDrafts.find((item) => item.id === draft.id) ?? draft} expanded={expandedIds.has(draft.id)} onToggle={() => toggleExpanded(draft.id)} editingId={editingId} editedValue={editedValue} onStartEdit={(item) => { setEditingId(item.id); setEditedValue(item.value); }} onEdit={setEditedValue} onReview={review} />)}</div>}
    </div>}
    {project.aiDrafts.length > 0 && !result && <div className="mt-5 space-y-2">{project.aiDrafts.map((draft) => <DraftCard key={draft.id} draft={draft} expanded={expandedIds.has(draft.id)} onToggle={() => toggleExpanded(draft.id)} editingId={editingId} editedValue={editedValue} onStartEdit={(item) => { setEditingId(item.id); setEditedValue(item.value); }} onEdit={setEditedValue} onReview={review} />)}</div>}
  </section>;
}

function DraftCard({ draft, expanded, onToggle, editingId, editedValue, onStartEdit, onEdit, onReview }: { draft: IndustryInsightDraftField; expanded: boolean; onToggle: () => void; editingId: string | null; editedValue: string; onStartEdit: (draft: IndustryInsightDraftField) => void; onEdit: (value: string) => void; onReview: (draft: IndustryInsightDraftField, status: IndustryInsightDraftStatus) => void }) {
  const completed = draft.status === "accepted" || draft.status === "edited" || draft.status === "rejected";
  const collapsed = completed && !expanded;
  return <div className="rounded-lg border border-line bg-surface p-3"><button type="button" aria-expanded={!collapsed} onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-2 text-left"><span className="text-xs font-semibold text-ink">{getIndustryInsightFieldDisplay(draft.fieldPath)}</span><span className="flex items-center gap-2"><span className="rounded-full bg-paper-warm px-2 py-1 text-[11px] font-semibold text-muted">{getIndustryInsightDraftStatusDisplay(draft.status)}</span><span className="text-xs text-muted">{collapsed ? "展开" : "收起"}</span></span></button>{!collapsed && <><div className="mt-2"><p className="text-xs text-muted">已采用或暂不采用的内容默认收起，点击上方即可展开。</p>{editingId === draft.id ? <textarea value={editedValue} onChange={(event) => onEdit(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" /> : <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{draft.value}</p>}</div><div className="mt-3 flex flex-wrap gap-2 text-xs"><button type="button" onClick={() => onReview(draft, "accepted")} className="rounded-lg bg-action px-2.5 py-1.5 font-semibold text-white">采用</button><button type="button" onClick={() => editingId === draft.id ? onReview(draft, "edited") : onStartEdit(draft)} className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-action">修改后采用</button><button type="button" onClick={() => onReview(draft, "needs_verification")} className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-muted">待验证</button><button type="button" onClick={() => onReview(draft, "rejected")} className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-muted">暂不采用</button></div></>}</div>;
}
