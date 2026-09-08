"use client";

import { loadDemandExplorations } from "@/features/workbench/local-store";

export function CalculationBreakdown({ analysisId }: { analysisId: string }) {
  const analysis = loadDemandExplorations().find((item) => item.id === analysisId);
  if (!analysis) return <div className="rounded-2xl border border-danger/30 bg-surface p-6 text-sm text-danger">找不到这条分析记录。</div>;
  const { counts, si, dsi } = analysis;
  const denominator = counts.A + counts.O + counts.M + counts.I;
  return <div className="space-y-5"><div className="grid grid-cols-3 gap-3 md:grid-cols-6">{(["A", "O", "M", "I", "R", "Q"] as const).map((key) => <div key={key} className="rounded-xl border border-line bg-surface p-3 text-center"><span className="text-xs text-muted">{key}</span><strong className="mt-1 block text-xl text-ink">{counts[key]}</strong></div>)}</div><div className="rounded-2xl border border-line bg-surface p-6"><h2 className="font-display text-lg font-bold text-ink">公式代入过程</h2><div className="mt-5 space-y-4 font-mono text-sm"><div><p className="text-xs text-muted">有效样本 = A + O + M + I</p><p className="mt-1 text-ink">{counts.A} + {counts.O} + {counts.M} + {counts.I} = <strong>{denominator}</strong></p></div><div><p className="text-xs text-muted">SI / Better</p><p className="mt-1 text-ink">({counts.A} + {counts.O}) ÷ {denominator || "0"} = <strong>{si === null ? "N/A" : si.toFixed(2)}</strong></p></div><div><p className="text-xs text-muted">DSI / Worse</p><p className="mt-1 text-ink">-({counts.M} + {counts.O}) ÷ {denominator || "0"} = <strong>{dsi === null ? "N/A" : dsi.toFixed(2)}</strong></p></div></div></div><div className="rounded-xl border border-action/20 bg-action-soft/40 p-4 text-xs leading-6 text-muted">R（反向）和 Q（可疑）不进入有效样本分母，但必须保留在结果中。当前样本不足时，系统只显示 N/A，不将缺失数据当成 0。</div></div>;
}
