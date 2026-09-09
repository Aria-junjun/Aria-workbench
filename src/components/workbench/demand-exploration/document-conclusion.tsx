"use client";

import { useMemo } from "react";
import { loadDemandConfirmationDocuments } from "@/features/workbench/local-store";

export function DocumentConclusion({ documentId }: { documentId: string }) {
  const document = useMemo(() => loadDemandConfirmationDocuments().find((item) => item.id === documentId), [documentId]);
  if (!document) return <p className="text-sm text-muted">未找到需求确认文档。</p>;
  const scored = document.demandItems.filter((item) => item.si !== null && item.dsi !== null);
  const pendingEvidence = document.demandItems.filter((item) => item.evidence.length === 0);
  return <div className="space-y-4"><section className="rounded-xl border border-line bg-paper p-5"><h3 className="font-display text-lg font-bold text-ink">需求确认结论</h3><p className="mt-2 text-sm leading-6 text-muted">当前文档包含 {document.demandItems.length} 个需求项，其中 {scored.length} 个已经完成 KANO 样本分析。系统仅汇总证据和模型结果，不替用户做最终产品决策。</p></section><section className="rounded-xl border border-line bg-paper p-5"><h3 className="font-semibold text-ink">模型结果</h3><div className="mt-3 space-y-2">{scored.length === 0 ? <p className="text-sm text-muted">暂无可确认的模型结果。</p> : scored.map((item) => <div key={item.id} className="flex items-center justify-between border-b border-line/70 py-2 text-sm"><span className="text-ink">{item.subFeature}</span><span className="text-muted">SI {item.si?.toFixed(2)} · DSI {item.dsi?.toFixed(2)}</span></div>)}</div></section><section className="rounded-xl border border-warning/30 bg-warning/5 p-5"><h3 className="font-semibold text-ink">证据限制</h3><p className="mt-2 text-sm leading-6 text-muted">{pendingEvidence.length === 0 ? "每个需求项都已补充证据。" : `还有 ${pendingEvidence.length} 个需求项缺少来源或证据，不能只依据模型分数确认。`}</p></section></div>;
}
