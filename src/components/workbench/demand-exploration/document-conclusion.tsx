"use client";

import { useMemo } from "react";
import { exportDemandConfirmationMarkdown } from "@/features/workbench/demand-confirmation-export";
import { loadDemandConfirmationDocuments } from "@/features/workbench/local-store";

export function DocumentConclusion({ documentId }: { documentId: string }) {
  const document = useMemo(() => loadDemandConfirmationDocuments().find((item) => item.id === documentId), [documentId]);
  if (!document) return <p className="text-sm text-muted">未找到需求确认文档。</p>;
  const scored = document.demandItems.filter((item) => item.si !== null && item.dsi !== null);
  const pendingEvidence = document.demandItems.filter((item) => item.evidence.length === 0);
  return <div className="space-y-4"><section className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-paper p-5 md:flex-row md:items-center"><div><h3 className="font-display text-lg font-bold text-ink">需求确认结论</h3><p className="mt-2 text-sm leading-6 text-muted">当前文档包含 {document.demandItems.length} 个需求项，其中 {scored.length} 个已经完成 KANO 样本分析。系统汇总原始回答、分类和计算结果，不替用户做最终产品决策。</p></div><button type="button" onClick={() => downloadDocument(document)} className="shrink-0 rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white">导出正式文档</button></section><section className="rounded-xl border border-line bg-paper p-5"><h3 className="font-semibold text-ink">数据来源与计算口径</h3><p className="mt-2 text-sm leading-6 text-muted">当前结果来源于本需求项录入的正向回答和反向回答。系统先通过 KANO 对照矩阵分类，再按有效样本 A+O+M+I 计算：SI / Better = (A + O) ÷ 有效样本；DSI / Worse = -(M + O) ÷ 有效样本。R、Q 会保留展示，但不进入分母。</p></section><section className="rounded-xl border border-line bg-paper p-5"><h3 className="font-semibold text-ink">原始数量与公式代入</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-line text-xs text-muted"><th className="p-2">需求项</th><th className="p-2">回答数</th><th className="p-2">A/O/M/I/R/Q</th><th className="p-2">有效样本</th><th className="p-2">SI / Better</th><th className="p-2">DSI / Worse</th></tr></thead><tbody>{document.demandItems.map((item) => { const denominator = item.counts.A + item.counts.O + item.counts.M + item.counts.I; return <tr key={item.id} className="border-b border-line/70"><td className="p-2 font-semibold text-ink">{item.subFeature}</td><td className="p-2">{item.responses.length}</td><td className="p-2">{item.counts.A}/{item.counts.O}/{item.counts.M}/{item.counts.I}/{item.counts.R}/{item.counts.Q}</td><td className="p-2">{denominator}</td><td className="p-2">{denominator ? `(${item.counts.A}+${item.counts.O})÷${denominator}=${(item.si ?? 0).toFixed(2)}` : "N/A"}</td><td className="p-2">{denominator ? `-(${item.counts.M}+${item.counts.O})÷${denominator}=${(item.dsi ?? 0).toFixed(2)}` : "N/A"}</td></tr>; })}</tbody></table></div><p className="mt-3 text-xs text-muted">数据来源：当前需求项的原始回答录入。评价文本、好评/中评/差评暂不参与 KANO 计算。</p></section><section className="rounded-xl border border-line bg-paper p-5"><h3 className="font-semibold text-ink">模型结果</h3><div className="mt-3 space-y-2">{scored.length === 0 ? <p className="text-sm text-muted">暂无可确认的模型结果。</p> : scored.map((item) => <div key={item.id} className="flex items-center justify-between border-b border-line/70 py-2 text-sm"><span className="text-ink">{item.subFeature}</span><span className="text-muted">SI {item.si?.toFixed(2)} · DSI {item.dsi?.toFixed(2)}</span></div>)}</div></section><section className="rounded-xl border border-warning/30 bg-warning/5 p-5"><h3 className="font-semibold text-ink">证据限制</h3><p className="mt-2 text-sm leading-6 text-muted">{pendingEvidence.length === 0 ? "每个需求项都已补充来源或证据。" : `还有 ${pendingEvidence.length} 个需求项缺少来源或证据，不能只依据模型分数确认。`}</p></section></div>;
}

function downloadDocument(document: Parameters<typeof exportDemandConfirmationMarkdown>[0]): void {
  const blob = new Blob([exportDemandConfirmationMarkdown(document)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${document.title || "需求确认文档"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
