"use client";

import Link from "next/link";
import { useState } from "react";
import { archiveDemandConfirmationDocument, restoreDemandConfirmationDocument } from "@/features/workbench/demand-confirmation";
import { loadDemandConfirmationDocuments, saveDemandConfirmationDocument } from "@/features/workbench/local-store";

export function ExplorationHome() {
  const [documents, setDocuments] = useState(() => loadDemandConfirmationDocuments());
  const activeDocuments = documents.filter((document) => document.status !== "archived");
  const archivedDocuments = documents.filter((document) => document.status === "archived");

  function refreshDocuments() { setDocuments(loadDemandConfirmationDocuments()); }
  function archiveDocument(documentId: string) {
    const document = documents.find((candidate) => candidate.id === documentId);
    if (!document || !window.confirm("删除后文档会进入已归档，不会抹除历史数据。确认删除吗？")) return;
    saveDemandConfirmationDocument(archiveDemandConfirmationDocument(document));
    refreshDocuments();
  }
  function restoreDocument(documentId: string) {
    const document = documents.find((candidate) => candidate.id === documentId);
    if (!document) return;
    saveDemandConfirmationDocument(restoreDemandConfirmationDocument(document));
    refreshDocuments();
  }

  return <div className="space-y-8">
    <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-action">Product Discovery</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">需求探索</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">把产品、用户、场景、证据和多个需求项整理成一份可复核的需求确认文档。</p></div><Link href="/demand-exploration/new" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-action-strong">新建需求确认文档</Link></header>
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-lg font-bold text-ink">需求确认文档</h2><p className="mt-1 text-sm text-muted">一份文档可以包含多个功能板块、二级功能和需求项；KANO 只作为每个需求项的分析依据。</p></div><span className="rounded-full bg-action-soft px-3 py-1 text-xs font-semibold text-action">文档工作区</span></div>{activeDocuments.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">还没有需求确认文档。先建立产品和场景，再逐步添加需求项。</div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{activeDocuments.map((document) => <DocumentCard key={document.id} document={document} onArchive={archiveDocument} />)}</div>}{archivedDocuments.length > 0 && <div className="mt-6 border-t border-line pt-5"><div className="flex items-center justify-between"><h3 className="font-semibold text-ink">已归档文档</h3><span className="text-xs text-muted">历史数据保留，可恢复</span></div><div className="mt-3 grid gap-3 md:grid-cols-2">{archivedDocuments.map((document) => <DocumentCard key={document.id} document={document} archived onRestore={restoreDocument} />)}</div></div>}</section>
    <section className="grid gap-3 md:grid-cols-3"><ToolCard title="需求结构" description="建立功能板块、二级功能和需求项。" /><ToolCard title="KANO 分析" description="对单个原子需求项进行正反问题和多人回答分析。" /><ToolCard title="需求确认结论" description="汇总需求属性矩阵、优先级和证据限制。" /></section>
  </div>;
}

function DocumentCard({ document, archived = false, onArchive, onRestore }: { document: ReturnType<typeof loadDemandConfirmationDocuments>[number]; archived?: boolean; onArchive?: (id: string) => void; onRestore?: (id: string) => void }) {
  return <div className="rounded-xl border border-line bg-paper p-5 transition hover:border-action/50 hover:bg-action-soft/20"><div className="flex items-start justify-between gap-3"><Link href={`/demand-exploration/${document.id}`} className="min-w-0 flex-1"><h3 className="font-semibold text-ink">{document.title || "未命名需求文档"}</h3></Link><div className="flex shrink-0 items-center gap-3"><span className="text-xs text-muted">{archived ? "已归档" : document.status === "completed" ? "已完成" : "进行中"}</span>{archived ? <button type="button" onClick={() => onRestore?.(document.id)} className="text-xs font-semibold text-action hover:text-action-strong">恢复文档</button> : <button type="button" onClick={() => onArchive?.(document.id)} className="text-xs font-semibold text-muted hover:text-danger">删除文档</button>}</div></div><Link href={`/demand-exploration/${document.id}`}><p className="mt-2 text-sm text-muted">{document.productName || "未关联产品"} · {document.demandItems.filter((item) => item.status !== "archived").length} 个需求项</p><div className="mt-4 flex gap-4 text-xs text-muted"><span>{document.sections.length} 个功能板块</span><span>{document.demandItems.filter((item) => item.status !== "archived" && item.si !== null && item.dsi !== null).length} 个已分析</span></div></Link></div>;
}

function ToolCard({ title, description }: { title: string; description: string }) { return <div className="rounded-xl border border-line bg-surface p-5"><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{description}</p></div>; }
