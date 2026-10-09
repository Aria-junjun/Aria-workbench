"use client";

import React, { useState } from "react";
import { applyAiTaskFieldDecision, createAiTaskDraftRevision, parseAiTaskDraft, type AiTaskDraft, type AiTaskFieldDecision, type AiTaskPackage } from "@/features/workbench/ai-task-protocol";

export function ExternalAiTaskPanel({ task, onSaveDraft, onReviewField, savedDrafts = [] }: { task: AiTaskPackage; onSaveDraft?: (draft: AiTaskDraft) => void; onReviewField?: (draft: AiTaskDraft, path: string, decision: AiTaskFieldDecision, value: string) => void; savedDrafts?: AiTaskDraft[] }) {
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<AiTaskDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(() => new Set(savedDrafts.filter((item) => Object.keys(item.recognizedFields).some((path) => !item.fieldDecisions?.[path]?.decision)).map((item) => item.id)));

  async function copyTask() {
    await navigator.clipboard?.writeText(task.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function importDraft() {
    const next = parseAiTaskDraft(input, task);
    setDraft(next);
    setSaved(false);
    setEditing(false);
    setEditedFields(next.recognizedFields);
  }

  function confirmDraft() {
    if (!draft) return;
    onSaveDraft?.(createAiTaskDraftRevision(draft, draft.recognizedFields));
    setSaved(true);
  }

  function saveEdits() {
    if (!draft) return;
    const next = createAiTaskDraftRevision(draft, editedFields);
    setDraft(next);
    onSaveDraft?.(next);
    setEditing(false);
    setSaved(false);
  }

  function reviewField(path: string, decision: AiTaskFieldDecision) {
    if (!draft) return;
    const value = editedFields[path] ?? draft.recognizedFields[path] ?? "";
    const next = applyAiTaskFieldDecision(draft, path, decision, value);
    setDraft(next);
    onSaveDraft?.(next);
    onReviewField?.(next, path, decision, value);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card" aria-label="外部 GPT 任务包">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <button type="button" aria-expanded={open} aria-controls="external-ai-task-panel-content" onClick={() => setOpen((current) => !current)} className="flex items-center gap-2 text-left">
            <h2 className="font-display text-xl font-bold text-ink">外部 GPT 任务包</h2>
            <span className="text-sm font-normal text-muted">{open ? "收起" : "展开 AI 辅助"}</span>
          </button>
          <p className="mt-1 text-sm leading-6 text-muted">复制任务包到外部 GPT，生成结果后再回到本页面审核。不会直接覆盖正式记录。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-paper-warm px-3 py-1 text-xs font-semibold text-muted">已保存 {savedDrafts.length} 条初稿</span>
          <button type="button" onClick={() => void copyTask()} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white">{copied ? "已复制" : "复制任务包"}</button>
        </div>
      </div>

      {open && <div id="external-ai-task-panel-content">
      <textarea aria-label="外部 GPT 任务包内容" readOnly value={task.prompt} className="mt-4 min-h-56 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm leading-6 text-ink outline-none" />

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-ink">导入 AI 初稿</h3>
          <button type="button" onClick={importDraft} disabled={!input.trim()} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">导入识别</button>
        </div>
        <textarea aria-label="AI 初稿导入内容" value={input} onChange={(event) => setInput(event.target.value)} placeholder="把外部 GPT 按任务包生成的 Markdown 粘贴到这里" className="mt-3 min-h-40 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm leading-6 text-ink outline-none placeholder:text-muted-light" />
        <p className="mt-2 text-xs text-muted">只识别当前任务包声明的字段；未识别内容会保留在草稿提示中。</p>

        {draft && (
          <div className="mt-3 space-y-3 rounded-xl border border-action/20 bg-action-soft/20 p-3 text-xs text-muted">
            <div className="flex items-center justify-between gap-3">
              <p>已识别 {Object.keys(draft.recognizedFields).length} 个字段，未识别 {draft.unrecognizedLines.length} 行。</p>
              <div className="flex gap-2">
                {!editing && <button type="button" onClick={() => { setEditedFields(draft.recognizedFields); setEditing(true); }} className="rounded-lg border border-line px-3 py-2 font-semibold text-action">修改</button>}
                {editing && <button type="button" onClick={saveEdits} className="rounded-lg border border-line px-3 py-2 font-semibold text-action">保存修改</button>}
                {onSaveDraft && <button type="button" onClick={confirmDraft} disabled={saved || editing || Object.keys(draft.recognizedFields).length === 0} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saved ? "已确认保存" : "确认保存 AI 初稿"}</button>}
              </div>
            </div>
            {Object.entries(draft.recognizedFields).map(([path, value]) => {
              const field = task.allowedFields.find((item) => item.path === path);
              const decision = draft.fieldDecisions?.[path]?.decision;
              return <div key={path} className="rounded-lg border border-line bg-paper p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-ink">{field?.label ?? path}</p><span className="text-[11px] text-muted">{decision === "adopted" ? "已写入正式字段" : decision === "edited" ? "修改后已写入" : decision === "needs_verification" ? "待验证" : decision === "excluded" ? "已排除" : "待审核"}</span></div>
                {editing
                  ? <textarea aria-label={`修改${field?.label ?? path}`} value={editedFields[path] ?? value} onChange={(event) => setEditedFields((current) => ({ ...current, [path]: event.target.value }))} className="mt-2 min-h-24 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-5 text-ink" />
                  : <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted">{value}</p>}
                {onSaveDraft && !editing && !decision && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => reviewField(path, "adopted")} className="rounded-lg bg-action px-2.5 py-1.5 font-semibold text-white">采用写入正式字段</button><button type="button" onClick={() => reviewField(path, "needs_verification")} className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-action">待验证</button><button type="button" onClick={() => reviewField(path, "excluded")} className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-muted">暂不采用</button></div>}
              </div>;
            })}
            {draft.unrecognizedLines.length > 0 && <p>未识别内容：{draft.unrecognizedLines.join(" / ")}</p>}
            <details className="rounded-lg border border-line bg-paper p-3">
              <summary className="cursor-pointer font-semibold text-ink">原始 AI 初稿</summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-muted">{draft.rawText}</pre>
            </details>
            <p>保存只保留 AI 初稿；逐字段点击“采用写入正式字段”后，才会进入本项目的正式研究结论。</p>
          </div>
        )}

        {savedDrafts.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <h4 className="font-semibold text-ink">历史 AI 初稿（{savedDrafts.length}）</h4>
            <div className="mt-2 space-y-2">
              {savedDrafts.map((item) => {
                return <details key={item.id} className="rounded-lg border border-line bg-paper p-3" open={expandedHistoryIds.has(item.id)} onToggle={(event) => { const isOpen = event.currentTarget.open; setExpandedHistoryIds((current) => { const next = new Set(current); if (isOpen) next.add(item.id); else next.delete(item.id); return next; }); }}>
                  <summary className="cursor-pointer list-none font-semibold text-ink">已保存 {Object.keys(item.recognizedFields).length} 个字段 · {new Date(item.importedAt).toLocaleString("zh-CN")}</summary>
                  <div className="mt-2 space-y-2">
                    {Object.entries(item.recognizedFields).map(([path, value]) => (
                      <div key={path}>
                        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-ink">{task.allowedFields.find((field) => field.path === path)?.label ?? path}</p><span className="text-[11px] text-muted">{item.fieldDecisions?.[path]?.decision === "adopted" || item.fieldDecisions?.[path]?.decision === "edited" ? "已写入正式字段" : item.fieldDecisions?.[path]?.decision === "excluded" ? "已排除" : item.fieldDecisions?.[path]?.decision === "needs_verification" ? "待验证" : "待审核"}</span></div>
                        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted">{value}</p>
                        {onSaveDraft && !item.fieldDecisions?.[path]?.decision && <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => onSaveDraft(applyAiTaskFieldDecision(item, path, "adopted"))} className="rounded-lg bg-action px-2.5 py-1.5 text-xs font-semibold text-white">采用写入正式字段</button><button type="button" onClick={() => onSaveDraft(applyAiTaskFieldDecision(item, path, "needs_verification"))} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-action">待验证</button><button type="button" onClick={() => onSaveDraft(applyAiTaskFieldDecision(item, path, "excluded"))} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted">暂不采用</button></div>}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 whitespace-pre-line text-xs text-muted">未识别内容：{item.unrecognizedLines.length > 0 ? item.unrecognizedLines.join("\n") : "无"}</p>
                  <div className="mt-3 rounded-lg border border-line bg-surface p-3">
                    <p className="font-semibold text-ink">原始 AI 初稿</p>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-muted">{item.rawText}</pre>
                  </div>
                </details>;
              })}
            </div>
          </div>
        )}
      </div>
      </div>}
    </section>
  );
}
