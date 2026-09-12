"use client";

import Link from "next/link";
import { updateIndustryInsightProject } from "@/features/workbench/industry-insight";
import { loadIndustryInsightProjects, saveIndustryInsightProject } from "@/features/workbench/local-store";
import { useState } from "react";

export function InsightHome() {
  const [projects, setProjects] = useState(() => loadIndustryInsightProjects());
  const active = projects.filter((project) => project.status !== "archived");
  const archived = projects.filter((project) => project.status === "archived");
  const refresh = () => setProjects(loadIndustryInsightProjects());
  const archive = (id: string) => {
    const project = projects.find((item) => item.id === id);
    if (!project || !window.confirm("归档后历史记录仍会保留，确认归档吗？")) return;
    saveIndustryInsightProject(updateIndustryInsightProject(project, { status: "archived" }));
    refresh();
  };
  const restore = (id: string) => {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    saveIndustryInsightProject(updateIndustryInsightProject(project, { status: "draft" }));
    refresh();
  };
  return <div className="space-y-8">
    <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-action">Market Context</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">行业洞察</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">从规模、趋势、阶段和产业链出发，形成可复核的行业判断与待验证机会。</p></div>
      <Link href="/industry-insight/new" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-action-strong">新建行业洞察</Link>
    </header>
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-lg font-bold text-ink">行业洞察项目</h2><p className="mt-1 text-sm text-muted">六步可以独立保存；报告会保留事实、判断、证据和信息缺口。</p></div><span className="rounded-full bg-action-soft px-3 py-1 text-xs font-semibold text-action">六步工作区</span></div>
      {active.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">还没有行业洞察项目。先明确一个需要支持的决策问题。</div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{active.map((project) => <ProjectCard key={project.id} project={project} onArchive={archive} />)}</div>}
      {archived.length > 0 && <div className="mt-6 border-t border-line pt-5"><h3 className="font-semibold text-ink">已归档项目</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{archived.map((project) => <ProjectCard key={project.id} project={project} archived onRestore={restore} />)}</div></div>}
    </section>
    <section className="grid gap-3 md:grid-cols-3"><Guide title="先定边界" text="先说明研究对象、场景、地域、时间口径和排除范围。" /><Guide title="再看四维" text="规模、趋势、市场占比与此消彼长分别记录事实和判断。" /><Guide title="最后做决策" text="把机会、风险、证据缺口转成可执行的下一步。" /></section>
  </div>;
}

function ProjectCard({ project, archived = false, onArchive, onRestore }: { project: ReturnType<typeof loadIndustryInsightProjects>[number]; archived?: boolean; onArchive?: (id: string) => void; onRestore?: (id: string) => void }) {
  return <div className="rounded-xl border border-line bg-paper p-5 transition hover:border-action/50 hover:bg-action-soft/20"><div className="flex items-start justify-between gap-3"><Link href={`/industry-insight/${project.id}`} className="min-w-0 flex-1"><h3 className="font-semibold text-ink">{project.title || "未命名行业洞察"}</h3></Link><div className="flex gap-3 text-xs"><span className="text-muted">{archived ? "已归档" : project.status === "completed" ? "已完成" : "进行中"}</span>{archived ? <button type="button" className="font-semibold text-action" onClick={() => onRestore?.(project.id)}>恢复项目</button> : <button type="button" className="text-muted hover:text-danger" onClick={() => onArchive?.(project.id)}>归档项目</button>}</div></div><Link href={`/industry-insight/${project.id}`}><p className="mt-2 text-sm text-muted">{project.productName || "未关联产品"} · {project.evidence.length} 条证据</p><p className="mt-4 text-xs text-muted">决策问题：{project.decisionQuestion || "尚未填写"}</p></Link></div>;
}

function Guide({ title, text }: { title: string; text: string }) { return <div className="rounded-xl border border-line bg-surface p-5"><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{text}</p></div>; }
