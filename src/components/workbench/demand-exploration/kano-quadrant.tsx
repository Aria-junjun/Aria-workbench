"use client";

import { calculateQuadrantPosition } from "@/features/workbench/demand-exploration";
import { loadDemandExplorations } from "@/features/workbench/local-store";

export function KanoQuadrant() {
  const scored = loadDemandExplorations().filter((item) => item.si !== null && item.dsi !== null);
  if (scored.length < 2) return <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">需要至少两个有有效分数的需求，才能进行四象限比较。</div>;
  const meanSi = scored.reduce((sum, item) => sum + (item.si ?? 0), 0) / scored.length;
  const meanDsi = scored.reduce((sum, item) => sum + (item.dsi ?? 0), 0) / scored.length;
  return <div className="rounded-2xl border border-line bg-surface p-6"><div className="relative mx-auto aspect-[1.5] max-w-3xl overflow-hidden rounded-xl border border-line bg-paper"><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" /><div className="absolute inset-y-0 left-1/2 border-l border-dashed border-line" /><span className="absolute left-2 top-2 text-xs text-muted">高影响 / 高改善</span><span className="absolute right-2 top-2 text-xs text-muted">高满意提升</span><span className="absolute bottom-2 left-2 text-xs text-muted">低影响</span><span className="absolute bottom-2 right-2 text-xs text-muted">高风险</span>{scored.map((item) => { const x = Math.max(4, Math.min(96, (item.si ?? 0) * 100)); const y = Math.max(4, Math.min(96, 100 - Math.abs(item.dsi ?? 0) * 100)); const quadrant = calculateQuadrantPosition({ si: item.si, dsi: item.dsi }, meanSi, meanDsi); return <div key={item.id} title={`${item.title} · ${quadrant}`} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-action px-3 py-2 text-[11px] font-semibold text-white shadow-glow" style={{ left: `${x}%`, top: `${y}%` }}>{item.title}</div>; })}</div><div className="mt-4 grid gap-3 text-xs text-muted md:grid-cols-3"><span>横轴：SI / Better，平均值 {meanSi.toFixed(2)}</span><span>纵轴：|DSI / Worse|，用于视觉比较</span><span>点位可回到对应分析记录查看原始依据</span></div></div>;
}
