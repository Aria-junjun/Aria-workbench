"use client";

import { useMemo } from "react";
import { loadDemandConfirmationDocuments } from "@/features/workbench/local-store";

const categories = ["A", "O", "M", "I", "R", "Q"] as const;
const labels: Record<(typeof categories)[number], string> = { A: "魅力", O: "期望", M: "必备", I: "无差异", R: "反向", Q: "待复核" };

export function DemandAttributeMatrix({ documentId }: { documentId: string }) {
  const document = useMemo(() => loadDemandConfirmationDocuments().find((item) => item.id === documentId), [documentId]);
  if (!document) return <p className="text-sm text-muted">未找到需求确认文档。</p>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-line text-xs text-muted"><th className="p-3">功能板块</th><th className="p-3">二级功能 / 需求项</th>{categories.map((category) => <th key={category} className="p-3">{labels[category]}</th>)}</tr></thead><tbody>{document.demandItems.map((item) => { const section = document.sections.find((entry) => entry.id === item.sectionId); const category = strongestCategory(item.counts); return <tr key={item.id} className="border-b border-line/70"><td className="p-3 text-muted">{section?.name || "未归类"}</td><td className="p-3 font-semibold text-ink">{item.subFeature}<div className="mt-1 text-xs font-normal text-muted">{item.needStatement}</div></td>{categories.map((value) => <td key={value} className={`p-3 text-center ${category === value ? "bg-action-soft font-semibold text-action" : "text-muted-light"}`}>{category === value ? "●" : "—"}</td>)}</tr>; })}</tbody></table>{document.demandItems.length === 0 ? <p className="p-6 text-center text-sm text-muted">暂无需求项，先建立需求结构。</p> : null}</div>;
}

function strongestCategory(counts: Record<string, number>): string | null {
  const order = ["M", "O", "A", "I", "R", "Q"];
  const scored = order.map((category) => ({ category, count: counts[category] ?? 0 })).sort((left, right) => right.count - left.count);
  return scored[0]?.count ? scored[0].category : null;
}
