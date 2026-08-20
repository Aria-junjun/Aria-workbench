"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { LocalOffer } from "@/features/workbench/local-store";
import { getOfferCompleteness, getOfferDisplayPrice, getOfferDisplaySkuCount, getOfferRelationStatus } from "@/features/workbench/offer-presentation";

export function OfferDetailDrawer({
  offer,
  open,
  onClose,
  onAddToCompare
}: {
  offer: LocalOffer | null;
  open: boolean;
  onClose: () => void;
  onAddToCompare: (id: string) => void;
}) {
  if (!open || !offer) return null;
  const completeness = getOfferCompleteness(offer);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20" role="dialog" aria-modal="true" aria-label="货盘详情">
      <button aria-label="关闭详情" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-line bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted">货盘详情</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{offer.name}</h2>
            <p className="mt-1 text-sm text-muted">{offer.supplierName || "未关联供应商"}</p>
          </div>
          <button aria-label="关闭详情" className="rounded-xl p-2 text-muted hover:bg-paper-warm" onClick={onClose} type="button"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Detail label="报价" value={getOfferDisplayPrice(offer)} />
          <Detail label="MOQ" value={offer.moq || "未记录"} />
          <Detail label="交期" value={offer.leadTime || "未记录"} />
          <Detail label="规格" value={getOfferDisplaySkuCount(offer) ? `${getOfferDisplaySkuCount(offer)} 个` : "未记录"} />
          <Detail label="关联状态" value={getOfferRelationStatus(offer)} />
          <Detail label="数据状态" value={completeness === "structured" ? "已整理" : completeness === "partial" ? "部分整理" : "待确认"} />
        </div>

        <section className="mt-6 rounded-2xl border border-line bg-paper-warm/40 p-4">
          <h3 className="font-medium">关联信息</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>产品：{offer.productName || "未关联"}</p>
            <p>供应商：{offer.supplierName || "未关联"}</p>
            <p>录入时间：{offer.createdAt ? new Date(offer.createdAt).toLocaleDateString("zh-CN") : "未记录"}</p>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-line p-4">
          <h3 className="font-medium">原始资料</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{offer.priceDetails || offer.quotedPrice || "未记录"}</p>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link className="rounded-xl bg-action px-4 py-2 text-sm text-white hover:shadow-card-hover" href={`/offers/${offer.id}`}>编辑货盘</Link>
          <button className="rounded-xl border border-line px-4 py-2 text-sm text-action hover:bg-paper-warm" onClick={() => onAddToCompare(offer.id)} type="button">加入对比</button>
          {offer.productUrl ? <a className="rounded-xl border border-line px-4 py-2 text-sm text-action hover:bg-paper-warm" href={offer.productUrl} rel="noreferrer" target="_blank">打开1688链接</a> : null}
          {offer.resourceUrl ? <a className="rounded-xl border border-line px-4 py-2 text-sm text-action hover:bg-paper-warm" href={offer.resourceUrl} rel="noreferrer" target="_blank">打开资料链接</a> : null}
        </div>
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-paper-warm/50 p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 line-clamp-2 text-sm font-medium text-slate-700">{value}</p></div>;
}
