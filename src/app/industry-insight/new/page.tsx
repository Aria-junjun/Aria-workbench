import Link from "next/link";
import { InsightIntakeForm } from "@/components/workbench/industry-insight/insight-intake-form";

export default function NewIndustryInsightPage() { return <div className="mx-auto max-w-4xl space-y-6"><div><Link href="/industry-insight" className="text-sm text-muted hover:text-action">← 返回行业洞察</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-action">Market Context</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">新建行业洞察</h1><p className="mt-2 text-sm leading-6 text-muted">先建立研究目的和边界，再逐步补充规模、趋势、阶段与产业链。</p></div><InsightIntakeForm /></div>; }
