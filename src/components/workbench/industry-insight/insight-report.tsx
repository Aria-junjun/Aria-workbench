import type { IndustryInsightProject } from "@/features/workbench/industry-insight";
import { buildIndustryInsightReport } from "@/features/workbench/industry-insight";

export function getIndustryInsightDraftReviewCounts(project: IndustryInsightProject) {
  return {
    unreviewed: project.aiDrafts.filter((draft) => draft.status === "draft" || draft.status === "needs_verification").length,
    needsVerification: project.aiDrafts.filter((draft) => draft.status === "needs_verification").length,
  };
}

export function InsightReport({ project }: { project: IndustryInsightProject }) {
  const report = buildIndustryInsightReport(project);
  const draftCounts = getIndustryInsightDraftReviewCounts(project);
  return <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-card"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-action">Report Preview</p><h2 className="mt-1 font-display text-xl font-bold text-ink">{report.title || "行业洞察报告"}</h2></div><span className="rounded-full bg-paper-warm px-3 py-1 text-xs text-muted">已完成 {report.completeness.filled}/{report.completeness.total} 项</span></div>{draftCounts.unreviewed > 0 && <div className="rounded-xl border border-action/20 bg-action-soft/30 p-4 text-sm text-muted">未审核 AI 初稿：{draftCounts.unreviewed} 条，其中待验证 {draftCounts.needsVerification} 条。正式报告只读取已确认字段。</div>}{!report.completeness.complete && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">报告仍有信息缺口：{report.completeness.missing.join("、")}。这不是自动评分，而是提醒你补证据或明确暂不判断。</div>}<div className="grid items-stretch gap-3 md:grid-cols-2">{report.sections.map((section) => <article key={section.key} className={`flex h-72 min-h-0 flex-col rounded-xl border border-line bg-paper p-4 ${section.key === "conclusion" ? "md:col-span-2" : ""}`}><div className="flex shrink-0 items-center justify-between gap-3"><h3 className="font-semibold text-ink">{section.title}</h3>{section.tag && <span className="rounded-full bg-action-soft px-2 py-1 text-[11px] font-semibold text-action">{section.tag === "strategy" ? "策略" : section.tag === "inference" ? "推断" : "待验证"}</span>}</div><div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-2"><p className="whitespace-pre-line text-sm leading-6 text-muted">{section.content}</p></div></article>)}</div><div className="rounded-xl border border-line bg-paper-warm p-4 text-xs leading-5 text-muted"><strong className="text-ink">限制说明：</strong>{report.limitations}</div></section>;
}
