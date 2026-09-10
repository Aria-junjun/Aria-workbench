"use client";

import Link from "next/link";
import { useState } from "react";
import { archiveCompetitorAnalysisProject, restoreCompetitorAnalysisProject } from "@/features/workbench/competitor-analysis";
import { loadCompetitorAnalysisProjects, saveCompetitorAnalysisProject } from "@/features/workbench/local-store";

export function AnalysisHome() {
  const [projects, setProjects] = useState(() => loadCompetitorAnalysisProjects());
  const active = projects.filter((project) => project.status !== "archived");
  const archived = projects.filter((project) => project.status === "archived");
  function refresh() { setProjects(loadCompetitorAnalysisProjects()); }
  function archive(id: string) {
    const project = projects.find((item) => item.id === id);
    if (!project || !window.confirm("归档后项目历史记录仍会保留。确认归档吗？")) return;
    saveCompetitorAnalysisProject(archiveCompetitorAnalysisProject(project));
    refresh();
  }
  function restore(id: string) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    saveCompetitorAnalysisProject(restoreCompetitorAnalysisProject(project));
    refresh();
  }
  return <div className="space-y-8"><header className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-action">Product Strategy</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">竞品分析</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">以白板贴为唯一案例，比较真实产品和替代方案，形成有证据的产品取舍。</p></div><Link href="/competitor-analysis/new" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-action-strong">新建白板贴分析</Link></header><section className="rounded-2xl border border-line bg-surface p-5 shadow-card"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-lg font-bold text-ink">白板贴竞品分析项目</h2><p className="mt-1 text-sm text-muted">销售、用户反馈、商品页面和替代方案都归入同一个白板贴产品案例。</p></div><span className="rounded-full bg-action-soft px-3 py-1 text-xs font-semibold text-action">六步工作区</span></div>{active.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">还没有白板贴竞品分析项目。先建立一个分析目标。</div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{active.map((project) => <ProjectCard key={project.id} project={project} onArchive={archive} />)}</div>}{archived.length > 0 && <div className="mt-6 border-t border-line pt-5"><div className="flex items-center justify-between"><h3 className="font-semibold text-ink">已归档项目</h3><span className="text-xs text-muted">历史记录保留，可恢复</span></div><div className="mt-3 grid gap-3 md:grid-cols-2">{archived.map((project) => <ProjectCard key={project.id} project={project} archived onRestore={restore} />)}</div></div>}</section><section className="grid gap-3 md:grid-cols-3"><GuideCard title="确认替代方案" description="判断传统白板、磁性白板等是否和白板贴争夺同一场景。" /><GuideCard title="拆解产品体验" description="从用户场景、功能范围、使用流程到页面呈现逐层比较。" /><GuideCard title="形成产品策略" description="把销售与反馈证据转成白板贴的跟随、借鉴或差异化行动。" /></section></div>;
}

function ProjectCard({ project, archived = false, onArchive, onRestore }: { project: ReturnType<typeof loadCompetitorAnalysisProjects>[number]; archived?: boolean; onArchive?: (id: string) => void; onRestore?: (id: string) => void }) { return <div className="rounded-xl border border-line bg-paper p-5 transition hover:border-action/50 hover:bg-action-soft/20"><div className="flex items-start justify-between gap-3"><Link href={`/competitor-analysis/${project.id}`} className="min-w-0 flex-1"><h3 className="font-semibold text-ink">{project.title || "未命名分析项目"}</h3></Link><div className="flex shrink-0 items-center gap-3"><span className="text-xs text-muted">{archived ? "已归档" : project.status === "completed" ? "已完成" : "进行中"}</span>{archived ? <button type="button" onClick={() => onRestore?.(project.id)} className="text-xs font-semibold text-action">恢复项目</button> : <button type="button" onClick={() => onArchive?.(project.id)} className="text-xs font-semibold text-muted hover:text-danger">归档项目</button>}</div></div><Link href={`/competitor-analysis/${project.id}`}><p className="mt-2 text-sm text-muted">{project.productName || "未关联产品"} · {project.competitors.length} 个竞品 · {project.evidence.length} 条证据</p><div className="mt-4 flex gap-4 text-xs text-muted"><span>阶段：{project.productStage || "未填写"}</span><span>{project.strategies.length} 条策略</span></div></Link></div>; }
function GuideCard({ title, description }: { title: string; description: string }) { return <div className="rounded-xl border border-line bg-surface p-5"><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{description}</p></div>; }
