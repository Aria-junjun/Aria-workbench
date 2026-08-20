"use client";

import type { LocalOffer } from "@/features/workbench/local-store";
import { getOfferDisplayPrice, getOfferDisplaySkuCount, getOfferRelationStatus } from "@/features/workbench/offer-presentation";

export type OfferGroup = { key: string; label: string; offers: LocalOffer[]; inferred: boolean };

export function groupOffersByProduct(offers: LocalOffer[]): OfferGroup[] {
  const groups = new Map<string, OfferGroup>();
  for (const offer of offers) {
    const stable = offer.productId || offer.productName;
    const label = offer.productName || offer.name || "未命名货盘";
    const key = stable || `name:${label.trim().toLowerCase()}`;
    const current = groups.get(key);
    if (current) current.offers.push(offer);
    else groups.set(key, { key, label, offers: [offer], inferred: !stable });
  }
  return [...groups.values()];
}

export function groupOffersBySupplier(offers: LocalOffer[]): OfferGroup[] {
  const groups = new Map<string, OfferGroup>();
  for (const offer of offers) {
    const label = offer.supplierName || "未关联供应商";
    const key = offer.supplierId || `supplier:${label.trim().toLowerCase()}`;
    const current = groups.get(key);
    if (current) current.offers.push(offer);
    else groups.set(key, { key, label, offers: [offer], inferred: !offer.supplierId });
  }
  return [...groups.values()];
}

export function OfferSkuCompareView({ groups, onOpenDetails, onAddToCompare }: { groups: OfferGroup[]; onOpenDetails: (offer: LocalOffer) => void; onAddToCompare: (id: string) => void }) {
  return <div className="space-y-4">{groups.map((group) => <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm" key={group.key}>
    <div className="flex items-center justify-between gap-3 border-b border-line bg-paper-warm/60 px-5 py-4"><div><h2 className="font-semibold">{group.label}</h2><p className="mt-1 text-xs text-muted">{group.offers.length} 个供应商报价{group.inferred ? " · 名称匹配，待确认" : ""}</p></div></div>
    <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-sm"><thead className="text-xs text-muted"><tr><th className="px-5 py-3 text-left">供应商</th><th className="px-5 py-3 text-left">报价</th><th className="px-5 py-3 text-left">MOQ</th><th className="px-5 py-3 text-left">交期</th><th className="px-5 py-3 text-left">规格</th><th className="px-5 py-3 text-left">状态</th><th className="px-5 py-3 text-left">操作</th></tr></thead><tbody className="divide-y divide-line">{group.offers.map((offer) => <tr className="hover:bg-paper-warm/30" key={offer.id}><td className="px-5 py-3">{offer.supplierName || "未关联供应商"}</td><td className="px-5 py-3 font-medium">{getOfferDisplayPrice(offer)}</td><td className="px-5 py-3 text-slate-600">{offer.moq || "未记录"}</td><td className="px-5 py-3 text-slate-600">{offer.leadTime || "未记录"}</td><td className="px-5 py-3 text-slate-600">{getOfferDisplaySkuCount(offer) || "未记录"}</td><td className="px-5 py-3 text-slate-600">{getOfferRelationStatus(offer)}</td><td className="px-5 py-3"><div className="flex gap-2 text-xs"><button className="text-action hover:underline" onClick={() => onOpenDetails(offer)} type="button">查看</button><button className="text-action hover:underline" onClick={() => onAddToCompare(offer.id)} type="button">对比</button></div></td></tr>)}</tbody></table></div>
  </section>)}</div>;
}

export function SupplierOfferView({ groups, onOpenDetails }: { groups: OfferGroup[]; onOpenDetails: (offer: LocalOffer) => void }) {
  return <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[720px] w-full text-sm"><thead className="bg-paper-warm/60 text-xs text-muted"><tr><th className="px-5 py-3 text-left">供应商</th><th className="px-5 py-3 text-left">货盘数量</th><th className="px-5 py-3 text-left">SKU数量</th><th className="px-5 py-3 text-left">最近更新</th><th className="px-5 py-3 text-left">操作</th></tr></thead><tbody className="divide-y divide-line">{groups.map((group) => <tr className="hover:bg-paper-warm/30" key={group.key}><td className="px-5 py-4 font-medium">{group.label}{group.inferred ? <span className="ml-2 text-xs text-muted">待确认</span> : null}</td><td className="px-5 py-4">{group.offers.length}</td><td className="px-5 py-4">{group.offers.reduce((sum, offer) => sum + getOfferDisplaySkuCount(offer), 0) || "未记录"}</td><td className="px-5 py-4 text-slate-600">{[...group.offers].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt ? new Date([...group.offers].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt).toLocaleDateString("zh-CN") : "未记录"}</td><td className="px-5 py-4"><button className="text-action hover:underline" onClick={() => onOpenDetails(group.offers[0])} type="button">查看报价</button></td></tr>)}</tbody></table></div></div>;
}
