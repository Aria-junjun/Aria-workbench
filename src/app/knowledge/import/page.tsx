"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookCoverEditor } from "@/features/workbench/book-cover-editor";
import { parseBookPackage, type ParsedBookPackage } from "@/features/workbench/knowledge-library";
import { saveBookPackage } from "@/features/workbench/local-store";

const prompt = `你是我的商业知识整理助手。

我会提供一本书的目录、读书笔记、重点摘录或截图。请不要逐章复述，请整理成可以被个人工作台调用的“书籍包”。

要求：
1. 只提取5至12个最重要且不重复的决策工具。
2. 只保留能解决明确问题、能够触发判断并导向行动的内容。
3. 相似观点必须合并，不要编造原资料没有的内容。
4. 每个工具最多3个诊断问题和3个行动建议。
5. 严格按以下格式输出，不增加前言。

【书籍】
书名：
作者：
主题：
主要解决的问题：
全书框架概览：
适合我的业务场景：

【决策工具】
工具名称：
解决的问题：
触发信号：
诊断问题：
行动建议：
不适用情况：
来源章节：
关联标签：

根据实际数量重复【决策工具】模块。`;

export default function ImportKnowledgeBookPage() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedBookPackage>();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function parse() {
    try {
      setParsed(parseBookPackage(rawText));
      setError("");
    } catch (parseError) {
      setParsed(undefined);
      setError(parseError instanceof Error ? parseError.message : "无法解析书籍包。");
    }
  }

  function updateTool(index: number, patch: Partial<ParsedBookPackage["tools"][number]>) {
    if (!parsed) return;
    setParsed({ ...parsed, tools: parsed.tools.map((tool, itemIndex) => itemIndex === index ? { ...tool, ...patch } : tool) });
  }

  function removeTool(index: number) {
    if (!parsed) return;
    setParsed({ ...parsed, tools: parsed.tools.filter((_, itemIndex) => itemIndex !== index) });
  }

  function mergeTool(index: number) {
    if (!parsed || index < 1) return;
    const previous = parsed.tools[index - 1];
    const current = parsed.tools[index];
    const unique = (values: string[]) => Array.from(new Set(values));
    const merged = {
      ...previous,
      problem: [previous.problem, current.problem].filter(Boolean).join("；"),
      triggers: unique([...previous.triggers, ...current.triggers]),
      diagnosticQuestions: unique([...previous.diagnosticQuestions, ...current.diagnosticQuestions]),
      actions: unique([...previous.actions, ...current.actions]),
      limitations: unique([...previous.limitations, ...current.limitations]),
      tags: unique([...previous.tags, ...current.tags])
    };
    setParsed({ ...parsed, tools: parsed.tools.map((tool, itemIndex) => itemIndex === index - 1 ? merged : tool).filter((_, itemIndex) => itemIndex !== index) });
  }

  function save() {
    if (!parsed || parsed.tools.length === 0) return;
    const result = saveBookPackage(parsed);
    router.push(`/knowledge/books/${result.book.id}`);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="max-w-4xl space-y-5">
      <Link className="text-sm text-action" href="/knowledge">返回商业知识</Link>
      <div>
        <h1 className="text-2xl font-semibold">导入一本书</h1>
        <p className="mt-1 text-sm text-slate-600">在ChatGPT Plus生成一次书籍包，完整粘贴后批量入库。</p>
      </div>

      <section className="border-y border-line bg-white px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">第一步：整理书籍</h2>
            <p className="mt-1 text-sm text-slate-600">把书籍目录、笔记或重点截图交给ChatGPT Plus，再使用标准提示词。</p>
          </div>
          <button className="shrink-0 rounded-md border border-line px-3 py-2 text-sm" onClick={copyPrompt} type="button">{copied ? "已复制" : "复制提示词"}</button>
        </div>
      </section>

      <section className="border-y border-line bg-white px-4 py-4">
        <h2 className="font-medium">第二步：粘贴书籍包</h2>
        <textarea className="mt-3 min-h-64 w-full rounded-md border border-line px-3 py-2 text-sm" onChange={(event) => setRawText(event.target.value)} placeholder="从【书籍】开始，粘贴完整结果……" value={rawText} />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-3 flex justify-end"><button className="rounded-md bg-action px-4 py-2 text-sm text-white disabled:opacity-50" disabled={!rawText.trim()} onClick={parse} type="button">生成导入预览</button></div>
      </section>

      {parsed ? (
        <section className="space-y-4">
          <div className="border-y border-line bg-white px-4 py-4">
            <h2 className="font-medium">第三步：检查书籍信息</h2>
            <div className="mt-3 grid gap-5 sm:grid-cols-[auto_1fr]">
              <BookCoverEditor
                title={parsed.book.title}
                value={parsed.book.coverImage}
                onChange={(coverImage) => setParsed({ ...parsed, book: { ...parsed.book, coverImage } })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="书名" value={parsed.book.title} onChange={(title) => setParsed({ ...parsed, book: { ...parsed.book, title } })} />
                <Field label="作者" value={parsed.book.author || ""} onChange={(author) => setParsed({ ...parsed, book: { ...parsed.book, author } })} />
                <Field label="主要解决的问题" multiline value={parsed.book.purpose || ""} onChange={(purpose) => setParsed({ ...parsed, book: { ...parsed.book, purpose } })} />
                <Field label="全书框架概览" multiline value={parsed.book.framework || ""} onChange={(framework) => setParsed({ ...parsed, book: { ...parsed.book, framework } })} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {parsed.tools.map((tool, index) => (
              <article className="rounded-md border border-line bg-white p-4" key={`${tool.name}-${index}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">决策工具 {index + 1}</span>
                  <div className="flex gap-2">
                    {index > 0 ? <button className="text-sm text-slate-600" onClick={() => mergeTool(index)} type="button">合并到上一项</button> : null}
                    <button className="text-sm text-red-600" onClick={() => removeTool(index)} type="button">删除</button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="工具名称" value={tool.name} onChange={(name) => updateTool(index, { name })} />
                  <Field label="解决的问题" value={tool.problem || ""} onChange={(problem) => updateTool(index, { problem })} />
                  <ListField label="触发信号" values={tool.triggers} onChange={(triggers) => updateTool(index, { triggers })} />
                  <ListField label="诊断问题" values={tool.diagnosticQuestions} onChange={(diagnosticQuestions) => updateTool(index, { diagnosticQuestions })} />
                  <ListField label="行动建议" values={tool.actions} onChange={(actions) => updateTool(index, { actions })} />
                  <ListField label="不适用情况" values={tool.limitations} onChange={(limitations) => updateTool(index, { limitations })} />
                </div>
              </article>
            ))}
          </div>
          <div className="flex justify-end"><button className="rounded-md bg-action px-4 py-2 text-sm text-white disabled:opacity-50" disabled={parsed.tools.length === 0} onClick={save} type="button">确认整本入库</button></div>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value, multiline = false, onChange }: { label: string; value: string; multiline?: boolean; onChange: (value: string) => void }) {
  const className = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm";
  return <label className="text-xs text-slate-500">{label}{multiline ? <textarea className={className} onChange={(event) => onChange(event.target.value)} rows={3} value={value} /> : <input className={className} onChange={(event) => onChange(event.target.value)} value={value} />}</label>;
}

function ListField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <Field label={`${label}（每行一个）`} multiline value={values.join("\n")} onChange={(value) => onChange(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))} />;
}
