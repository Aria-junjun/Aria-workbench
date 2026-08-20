"use client";

import Link from "next/link";
import { ExternalLink, Pin, PinOff } from "lucide-react";
import type { LocalOffer } from "@/features/workbench/local-store";
import { getOfferDisplaySkuCount, getOfferDisplaySummary, getOfferRelationStatus } from "@/features/workbench/offer-presentation";

export function OfferListView({
  offers,
  selectedOfferIds,
  onToggleSelected,
  onPin,
  onOpenDetails,
  onAddToCompare
}: {
  offers: LocalOffer[];
  selectedOfferIds: string[];
  onToggleSelected: (id: string) => void;
  onPin: (id: string) => void;
  onOpenDetails: (offer: LocalOffer) => void;
  onAddToCompare: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-sm">
          <thead className="bg-paper-warm/70 text-xs text-muted">
            <tr>
              <th className="w-12 px-4 py-3 text-left">选</th>
              <th className="min-w-[260px] px-4 py-3 text-left">商品/货盘</th>
              <th className="min-w-[170px] px-4 py-3 text-left">供应商</th>
              <th className="min-w-[150px] px-4 py-3 text-left">报价</th>
              <th className="px-4 py-3 text-left">MOQ</th>
              <th className="px-4 py-3 text-left">交期</th>
              <th className="px-4 py-3 text-left">关联状态</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {offers.map((offer) => {
              const status = getOfferRelationStatus(offer);
              return (
                <tr className="transition-colors hover:bg-paper-warm/30" key={offer.id}>
                  <td className="px-4 py-3 align-top">
                    <input
                      aria-label={`选择 ${offer.name}`}
                      checked={selectedOfferIds.includes(offer.id)}
                      onChange={() => onToggleSelected(offer.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button className="text-left font-medium hover:text-action" onClick={() => onOpenDetails(offer)} type="button">
                      <span className="line-clamp-2">{offer.name}</span>
                    </button>
                    {getOfferDisplaySkuCount(offer) > 0 ? <p className="mt-1 text-xs text-muted">{getOfferDisplaySkuCount(offer)} 个规格</p> : null}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-600">{offer.supplierName || "未关联供应商"}</td>
                  <td className="max-w-[230px] px-4 py-3 align-top font-medium text-slate-700"><span className="line-clamp-2" title={offer.quotedPrice || "未记录"}>{getOfferDisplaySummary(offer)}</span></td>
                  <td className="px-4 py-3 align-top text-slate-600">{offer.moq || "未记录"}</td>
                  <td className="px-4 py-3 align-top text-slate-600">{offer.leadTime || "未记录"}</td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs ${status === "已关联" ? "bg-success-soft text-success" : "bg-paper-warm text-muted"}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button className="text-action hover:underline" onClick={() => onOpenDetails(offer)} type="button">查看</button>
                      <button className="text-action hover:underline" onClick={() => onAddToCompare(offer.id)} type="button">加入对比</button>
                      <button aria-label={offer.pinned ? `取消置顶 ${offer.name}` : `置顶 ${offer.name}`} className="text-muted hover:text-action" onClick={() => onPin(offer.id)} type="button">
                        {offer.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                      <Link aria-label={`打开 ${offer.name}`} className="text-muted hover:text-action" href={`/offers/${offer.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
