"use client";

import { useMemo } from "react";
import { loadDemandConfirmationDocuments } from "@/features/workbench/local-store";

export function KanoQuadrant({ documentId }: { documentId: string }) {
  const document = useMemo(() => loadDemandConfirmationDocuments().find((item) => item.id === documentId), [documentId]);
  const scored = document?.demandItems.filter((item) => item.si !== null && item.dsi !== null) ?? [];

  if (scored.length < 2) {
    return <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">暂无可比较需求，至少需要两个有有效 SI / DSI 的需求项。</div>;
  }

  const meanSi = scored.reduce((sum, item) => sum + (item.si ?? 0), 0) / scored.length;
  const meanWorse = scored.reduce((sum, item) => sum + Math.abs(item.dsi ?? 0), 0) / scored.length;

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="relative mx-auto aspect-[1.5] max-w-3xl overflow-hidden rounded-xl border border-line bg-paper">
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
        <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-line" />
        <span className="absolute left-2 top-2 text-xs text-muted">魅力属性</span>
        <span className="absolute right-2 top-2 text-xs text-muted">期望属性</span>
        <span className="absolute bottom-2 left-2 text-xs text-muted">无差异属性</span>
        <span className="absolute bottom-2 right-2 text-xs text-muted">必备属性</span>
        {scored.map((item) => {
          const x = Math.max(4, Math.min(96, (item.si ?? 0) * 100));
          const y = Math.max(4, Math.min(96, 100 - Math.abs(item.dsi ?? 0) * 100));
          return <div key={item.id} title={`${item.subFeature} · SI ${(item.si ?? 0).toFixed(2)} · DSI ${(item.dsi ?? 0).toFixed(2)}`} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-action px-3 py-2 text-[11px] font-semibold text-white shadow-glow" style={{ left: `${x}%`, top: `${y}%` }}>{item.subFeature}</div>;
        })}
      </div>
      <div className="mt-4 grid gap-3 text-xs text-muted md:grid-cols-3"><span>横轴：SI / Better，均值 {meanSi.toFixed(2)}</span><span>纵轴：|DSI / Worse|，均值 {meanWorse.toFixed(2)}</span><span>每个点对应一个独立需求项，不混合不同问题的回答。</span></div>
    </div>
  );
}
