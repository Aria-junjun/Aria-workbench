"use client";

import { useState } from "react";
import { loadDemandExplorations, updateDemandExploration } from "@/features/workbench/local-store";

const names = { A: "魅力属性", O: "期望属性", M: "必备属性", I: "无差异属性", R: "反向属性", Q: "可疑回答" } as const;

export function AnalysisResult({ analysisId }: { analysisId: string }) {
  const analysis = loadDemandExplorations().find((item) => item.id === analysisId);
  const [saved, setSaved] = useState(analysis?.status === "completed");
  if (!analysis) return <div className="rounded-2xl border border-danger/30 bg-surface p-6 text-sm text-danger">找不到这条分析记录。</div>;
  const ranked = (Object.entries(analysis.counts) as Array<[keyof typeof names, number]>).sort((a, b) => b[1] - a[1]);
  const conclusion = analysis.si === null ? "暂不能形成正式分类" : `${names[ranked[0][0]]} ${ranked[0][0]}`;
  const limitations = [
    analysis.responses.length < 10 ? "样本量较少，建议继续收集回答。" : null,
    analysis.counts.R > 0 ? `存在 ${analysis.counts.R} 条反向属性回答，需要检查是否有用户群体差异。` : null,
    analysis.counts.Q > 0 ? `存在 ${analysis.counts.Q} 条可疑回答，需要复核问题或回答理解。` : null
  ].filter(Boolean) as string[];
  function complete() { updateDemandExploration(analysisId, { status: "completed" }); setSaved(true); }
  return <div className="space-y-5"><section className="rounded-2xl border border-line bg-surface p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-action">模型结果</p><h2 className="mt-2 font-display text-2xl font-bold text-ink">{conclusion}</h2><p className="mt-2 text-sm leading-6 text-muted">这是基于当前回答组合得出的模型分类，不代表系统替你做了产品决策。</p></section><section className="rounded-2xl border border-line bg-surface p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-action">计算依据</p><div className="mt-4 grid gap-3 md:grid-cols-4"><div><span className="text-xs text-muted">有效样本</span><strong className="mt-1 block text-xl text-ink">{analysis.counts.A + analysis.counts.O + analysis.counts.M + analysis.counts.I}</strong></div><div><span className="text-xs text-muted">SI / Better</span><strong className="mt-1 block text-xl text-ink">{analysis.si === null ? "N/A" : analysis.si.toFixed(2)}</strong></div><div><span className="text-xs text-muted">DSI / Worse</span><strong className="mt-1 block text-xl text-ink">{analysis.dsi === null ? "N/A" : analysis.dsi.toFixed(2)}</strong></div><div><span className="text-xs text-muted">回答总数</span><strong className="mt-1 block text-xl text-ink">{analysis.responses.length}</strong></div></div><p className="mt-4 font-mono text-xs text-muted">SI = (A + O) ÷ (A + O + M + I)；DSI = -(M + O) ÷ (A + O + M + I)</p></section><section className="rounded-2xl border border-line bg-surface p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-action">可信度限制</p>{limitations.length === 0 ? <p className="mt-3 text-sm text-muted">当前未发现明显的数据质量限制，但仍需结合真实用户角色复核。</p> : <ul className="mt-3 space-y-2 text-sm text-muted">{limitations.map((item) => <li key={item}>· {item}</li>)}</ul>}</section><div className="flex justify-end">{saved ? <span className="rounded-xl bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">分析已保存</span> : <button type="button" onClick={complete} className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white">保存为完成记录</button>}</div></div>;
}
