"use client";

import Link from "next/link";
import { useMemo } from "react";
import { loadDemandExplorations } from "@/features/workbench/local-store";

const tools = [
  { title: "提出需求", description: "明确用户、场景、问题和目标。", href: "/demand-exploration/new", status: "本期开放" },
  { title: "KANO 问题设计", description: "自己拆解产品特性，设计正向和反向问题。", href: "/demand-exploration/new", status: "本期开放" },
  { title: "KANO 对照表", description: "理解两组回答如何映射到 A/O/M/I/R/Q。", href: "/demand-exploration/new", status: "本期开放" },
  { title: "多人统计与 BI/SI", description: "汇总回答并查看公式代入和计算结果。", href: "/demand-exploration/new", status: "本期开放" },
  { title: "需求四象限", description: "比较多个需求的 Better / Worse 优先级。", href: "/demand-exploration/new", status: "本期开放" },
  { title: "HMW 问题拆解", description: "按照课程后续内容逐步开放。", href: "#", status: "后续开放" },
  { title: "竞品拆解", description: "待学习对应方法后再建立独立模块。", href: "#", status: "后续开放" }
];

export function ExplorationHome() {
  const analyses = useMemo(() => loadDemandExplorations(), []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-action">Product Discovery</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">需求探索</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">跟着课程一步一步完成需求分析。你负责思考，系统负责解释、校验、计算和保留过程。</p>
        </div>
        <Link href="/demand-exploration/new" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-action-strong">新建需求分析</Link>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-display text-lg font-bold text-ink">按课程节奏学习</h2><p className="mt-1 text-sm text-muted">每个环节可以单独进入，也可以关联到同一条分析记录。</p></div>
          <span className="rounded-full bg-action-soft px-3 py-1 text-xs font-semibold text-action">KANO · 本期主线</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool, index) => {
            const disabled = tool.status === "后续开放";
            const content = <div className={`h-full rounded-xl border p-4 transition ${disabled ? "border-dashed border-line bg-paper/60" : "border-line bg-paper hover:border-action/50 hover:bg-action-soft/30"}`}><div className="flex items-start justify-between gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-action-soft text-xs font-bold text-action">{String(index + 1).padStart(2, "0")}</span><span className={`text-[11px] font-semibold ${disabled ? "text-muted-light" : "text-success"}`}>{tool.status}</span></div><h3 className="mt-4 font-semibold text-ink">{tool.title}</h3><p className="mt-1 text-xs leading-5 text-muted">{tool.description}</p></div>;
            return disabled ? <div key={tool.title}>{content}</div> : <Link key={tool.title} href={tool.href}>{content}</Link>;
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-ink">我的分析记录</h2><p className="mt-1 text-sm text-muted">保存后可从任一环节继续，不要求一次完成。</p></div><span className="text-xs text-muted">{analyses.length} 条记录</span></div>
        {analyses.length === 0 ? <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">还没有需求分析记录。可以先新建一条练习。</div> : <div className="grid gap-3 md:grid-cols-2">{analyses.map((analysis) => <Link key={analysis.id} href={`/demand-exploration/${analysis.id}/questions`} className="rounded-2xl border border-line bg-surface p-5 hover:border-action/50"><div className="flex items-center justify-between"><h3 className="font-semibold text-ink">{analysis.title}</h3><span className="text-xs text-muted">{analysis.status === "completed" ? "已完成" : "草稿"}</span></div><p className="mt-2 text-sm text-muted">{analysis.productFamily || "未关联产品族"} · {analysis.feature || "尚未填写产品特性"}</p></Link>)}</div>}
      </section>
    </div>
  );
}
