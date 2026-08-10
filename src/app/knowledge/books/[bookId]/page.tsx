"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookCoverEditor } from "@/features/workbench/book-cover-editor";
import { auditKnowledgeBookImport, type AuditedListField, type KnowledgeBookAudit, type KnowledgeToolAudit } from "@/features/workbench/knowledge-library";
import { deleteKnowledgeBook, loadLocalWorkbenchData, repairKnowledgeBookFromRawText, updateLocalItem } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";

const auditedFields: Array<{ key: AuditedListField; label: string }> = [
  { key: "triggers", label: "触发信号" },
  { key: "diagnosticQuestions", label: "诊断问题" },
  { key: "actions", label: "行动建议" },
  { key: "limitations", label: "不适用情况" },
  { key: "tags", label: "标签" }
];

export default function KnowledgeBookPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = Array.isArray(params.bookId) ? params.bookId[0] : params.bookId;
  const [audit, setAudit] = useState<KnowledgeBookAudit>();
  const [auditError, setAuditError] = useState("");
  const [repairMessage, setRepairMessage] = useState("");

  const data = useWorkbenchData();

  const book = data.knowledgeBooks.find((item) => item.id === bookId);
  const tools = data.decisionTools.filter((tool) => tool.bookId === bookId);

  if (!book) return <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-600">没有找到这本书。</div>;

  function removeBook() {
    if (!book) return;
    if (!window.confirm(`确认删除《${book.title}》及其全部决策工具吗？应用记录会保留。`)) return;
    deleteKnowledgeBook(book.id);
    router.push("/knowledge");
  }

  function updateCover(coverImage: string | undefined) {
    if (!book) return;
    updateLocalItem("knowledgeBooks", book.id, { coverImage });
  }

  function inspectImport() {
    if (!book?.rawText?.trim()) {
      setAudit(undefined);
      setAuditError("这本书没有保存原始书籍包，无法检查解析差异。");
      return;
    }
    try {
      setAudit(auditKnowledgeBookImport(book.rawText, tools));
      setAuditError("");
      setRepairMessage("");
    } catch (error) {
      setAudit(undefined);
      setAuditError(error instanceof Error ? error.message : "无法解析原始书籍包。");
    }
  }

  function applyRepair() {
    if (!book || audit?.status !== "recoverable") return;
    const result = repairKnowledgeBookFromRawText(book.id);
    const nextData = loadLocalWorkbenchData();
    const nextTools = nextData.decisionTools.filter((tool) => tool.bookId === book.id);
    setAudit(auditKnowledgeBookImport(book.rawText || "", nextTools));
    setRepairMessage(`已补充 ${result.updatedTools} 个现有工具，并新增 ${result.addedTools} 个工具。未覆盖人工修改。`);
  }

  return (
    <div className="space-y-5">
      <Link className="text-sm text-action" href="/knowledge">返回我的书架</Link>
      <header className="flex flex-col gap-5 border-b border-line pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row">
          <BookCoverEditor title={book.title} value={book.coverImage} onChange={updateCover} />
          <div>
            <h1 className="text-2xl font-semibold">{book.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{book.author || "未记录作者"}</p>
            {book.purpose ? <p className="mt-4 max-w-3xl text-sm text-slate-700">{book.purpose}</p> : null}
          </div>
        </div>
        <button className="shrink-0 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700" onClick={removeBook} type="button">删除书籍</button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Info label="核心框架" value={book.framework} />
        <Info label="适用业务场景" value={book.businessScenarios.join("、")} />
      </section>

      <section className="border-y border-line bg-white px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">导入完整性</h2>
            <p className="mt-1 text-sm text-slate-600">比较原始书籍包与当前入库结果，只恢复可以确认的解析遗漏。</p>
          </div>
          <button className="rounded-md border border-line px-3 py-2 text-sm" onClick={inspectImport} type="button">检查导入完整性</button>
        </div>
        {auditError ? <p className="mt-3 text-sm text-red-600">{auditError}</p> : null}
        {repairMessage ? <p className="mt-3 text-sm text-action">{repairMessage}</p> : null}
        {audit ? <AuditResult audit={audit} onRepair={applyRepair} /> : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">决策工具</h2>
          <span className="text-sm text-slate-500">{tools.length}个</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {tools.map((tool) => (
            <Link className="rounded-md border border-line bg-white p-4 hover:border-action" href={`/knowledge/tools/${tool.id}`} key={tool.id}>
              <h3 className="font-medium">{tool.name}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{tool.problem || "待补充解决的问题"}</p>
              <div className="mt-3 text-xs text-slate-500">{tool.sourceChapter || "未记录来源章节"}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return <div className="border-y border-line bg-white px-4 py-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-sm">{value || "未记录"}</div></div>;
}

function AuditResult({ audit, onRepair }: { audit: KnowledgeBookAudit; onRepair: () => void }) {
  const statusText = audit.status === "recoverable"
    ? `发现 ${audit.recoverableItemCount} 项可恢复内容${audit.cleanupItemCount > 0 ? `，另有 ${audit.cleanupItemCount} 项编号重复需清理` : ""}，其中 ${audit.newToolCount} 个为新工具。`
    : audit.status === "source_insufficient"
      ? "没有发现解析遗漏，但原始书籍包中的部分工具信息不足。"
      : "当前入库结果与原始书籍包一致，没有发现解析遗漏。";

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700">
        <div>{statusText}</div>
        <div className="mt-1 text-xs text-slate-500">当前 {audit.currentToolCount} 个工具 · 原始包重新解析 {audit.parsedToolCount} 个工具</div>
      </div>

      {audit.sourceInsufficientToolNames.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          以下工具在原始书籍包中仍少于 2 个诊断问题或 2 个行动建议，无法通过重新解析补足：{audit.sourceInsufficientToolNames.join("、")}。需要回到原始资料重新整理。
        </div>
      ) : null}

      <div className="divide-y divide-line border-y border-line">
        {audit.tools.map((tool) => <ToolAuditRow audit={tool} key={tool.name} />)}
      </div>

      {audit.status === "recoverable" ? (
        <div className="flex justify-end">
          <button className="rounded-md bg-action px-4 py-2 text-sm text-white" onClick={onRepair} type="button">确认补充并清理</button>
        </div>
      ) : null}
    </div>
  );
}

function ToolAuditRow({ audit }: { audit: KnowledgeToolAudit }) {
  const additions = auditedFields.flatMap(({ key, label }) => audit.additions[key].map((value) => `${label}：${value}`));
  if (audit.scalarAdditions.problem) additions.push(`解决的问题：${audit.scalarAdditions.problem}`);
  if (audit.scalarAdditions.sourceChapter) additions.push(`来源章节：${audit.scalarAdditions.sourceChapter}`);

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{audit.name}</h3>
        <span className="text-xs text-slate-500">{audit.isNewTool ? "原始包中的新工具" : additions.length > 0 ? `可补充 ${additions.length} 项` : audit.cleanupItemCount > 0 ? `清理 ${audit.cleanupItemCount} 项编号重复` : "无解析差异"}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {auditedFields.slice(0, 4).map(({ key, label }) => <span key={key}>{label} {audit.currentCounts[key]} → {audit.parsedCounts[key]}</span>)}
      </div>
      {additions.length > 0 ? (
        <details className="mt-2 text-sm text-slate-600">
          <summary className="cursor-pointer text-action">查看可补充内容</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">{additions.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      ) : null}
    </div>
  );
}
