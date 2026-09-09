"use client";

import Link from "next/link";
import { useMemo } from "react";
import { loadDemandConfirmationDocuments } from "@/features/workbench/local-store";

export function ExplorationHome() {
  const documents = useMemo(() => loadDemandConfirmationDocuments(), []);
  return <div className="space-y-8">
    <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-action">Product Discovery</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">需求探索</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">把产品、用户、场景、证据和多个需求项整理成一份可复核的需求确认文档。</p></div><Link href="/demand-exploration/new" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-action-strong">新建需求确认文档</Link></header>
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-lg font-bold text-ink">需求确认文档</h2><p className="mt-1 text-sm text-muted">一份文档可以包含多个功能板块、二级功能和需求项；KANO 只作为每个需求项的分析依据。</p></div><span className="rounded-full bg-action-soft px-3 py-1 text-xs font-semibold text-action">文档工作区</span></div>{documents.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">还没有需求确认文档。先建立产品和场景，再逐步添加需求项。</div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{documents.map((document) => <Link key={document.id} href={`/demand-exploration/${document.id}`} className="rounded-xl border border-line bg-paper p-5 transition hover:border-action/50 hover:bg-action-soft/20"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-ink">{document.title || "未命名需求文档"}</h3><span className="text-xs text-muted">{document.status === "completed" ? "已完成" : "进行中"}</span></div><p className="mt-2 text-sm text-muted">{document.productName || "未关联产品"} · {document.demandItems.length} 个需求项</p><div className="mt-4 flex gap-4 text-xs text-muted"><span>{document.sections.length} 个功能板块</span><span>{document.demandItems.filter((item) => item.si !== null && item.dsi !== null).length} 个已分析</span></div></Link>)}</div>}</section>
    <section className="grid gap-3 md:grid-cols-3"><ToolCard title="需求结构" description="建立功能板块、二级功能和需求项。" /><ToolCard title="KANO 分析" description="对单个原子需求项进行正反问题和多人回答分析。" /><ToolCard title="需求确认结论" description="汇总需求属性矩阵、优先级和证据限制。" /></section>
  </div>;
}

function ToolCard({ title, description }: { title: string; description: string }) { return <div className="rounded-xl border border-line bg-surface p-5"><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{description}</p></div>; }
