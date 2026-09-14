"use client";

import Link from "next/link";
import { useState } from "react";
import {
  archiveProductDecompositionProject,
  loadProductDecompositionProjects,
  saveProductDecompositionProject,
} from "@/features/workbench/local-store";
import { updateProductDecompositionProject, type ProductDecompositionProject } from "@/features/workbench/product-decomposition";

export function DecompositionHome() {
  const [projects, setProjects] = useState(() => loadProductDecompositionProjects());
  const active = projects.filter((project) => project.status !== "archived");
  const archived = projects.filter((project) => project.status === "archived");
  const refresh = () => setProjects(loadProductDecompositionProjects());

  const archive = (id: string) => {
    if (!window.confirm("归档后历史记录仍会保留，确认归档吗？")) return;
    archiveProductDecompositionProject(id, true);
    refresh();
  };

  const restore = (id: string) => {
    archiveProductDecompositionProject(id, false);
    refresh();
  };

  return <div className="space-y-8">
    <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-action">Product Decomposition</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">产品拆解</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">从产品定位和中心问题出发，拆解原因、方案优先级和下一步行动。</p>
      </div>
      <Link href="/product-decomposition/new" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow">新建产品拆解</Link>
    </header>
    <Ledger title="产品拆解项目" description="五步独立保存；结果保留事实、判断、方案和行动计划。" empty={active.length === 0 ? "还没有产品拆解项目。先明确一个产品问题。" : undefined}>
      <table className="w-full min-w-[1050px] text-left text-sm"><thead><TableHeader /></thead><tbody>{active.map((project) => <ProjectRow key={project.id} project={project} onArchive={archive} />)}</tbody></table>
    </Ledger>
    {archived.length > 0 && <Ledger title="已归档项目" description="历史记录保留，可恢复。"><table className="w-full min-w-[1050px] text-left text-sm"><thead><TableHeader /></thead><tbody>{archived.map((project) => <ProjectRow key={project.id} project={project} archived onRestore={restore} />)}</tbody></table></Ledger>}
  </div>;
}

function Ledger({ title, description, empty, children }: { title: string; description: string; empty?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-surface p-5 shadow-card"><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="font-display text-lg font-bold text-ink">{title}</h2><p className="mt-1 text-sm text-muted">{description}</p></div><span className="rounded-full bg-action-soft px-3 py-1 text-xs font-semibold text-action">台账</span></div>{empty ? <div className="rounded-xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">{empty}</div> : <div className="overflow-x-auto">{children}</div>}</section>;
}

function TableHeader() {
  return <tr className="border-b border-line text-xs text-muted"><th className="px-3 py-3 font-semibold">项目</th><th className="px-3 py-3 font-semibold">关联产品</th><th className="px-3 py-3 font-semibold">中心问题</th><th className="px-3 py-3 font-semibold">完成阶段</th><th className="px-3 py-3 font-semibold">方案数</th><th className="px-3 py-3 font-semibold">行动项</th><th className="px-3 py-3 font-semibold">状态</th><th className="px-3 py-3 font-semibold">操作</th></tr>;
}

function ProjectRow({ project, archived = false, onArchive, onRestore }: { project: ProductDecompositionProject; archived?: boolean; onArchive?: (id: string) => void; onRestore?: (id: string) => void }) {
  const completed = Object.values(project.steps).filter((step) => step === "completed").length;
  return <tr className="border-b border-line/70 last:border-0 hover:bg-paper-warm/50"><td className="px-3 py-4"><Link href={`/product-decomposition/${project.id}`} className="font-semibold text-ink hover:text-action">{project.title || "未命名拆解"}</Link></td><td className="px-3 py-4 text-muted">{project.linkedProductId || "未关联产品"}</td><td className="max-w-[230px] px-3 py-4 text-muted">{project.centralQuestion || "尚未填写"}</td><td className="px-3 py-4 text-muted">{completed}/5 步</td><td className="px-3 py-4 text-muted">{project.solutions.length} 个</td><td className="px-3 py-4 text-muted">{project.actionItems.length} 个</td><td className="px-3 py-4"><span className="rounded-full bg-action-soft px-2.5 py-1 text-xs font-semibold text-action">{archived ? "已归档" : project.status === "completed" ? "已完成" : "进行中"}</span></td><td className="px-3 py-4">{archived ? <button type="button" onClick={() => onRestore?.(project.id)} className="text-xs font-semibold text-action">恢复</button> : <button type="button" onClick={() => onArchive?.(project.id)} className="text-xs text-muted hover:text-danger">归档</button>}</td></tr>;
}
