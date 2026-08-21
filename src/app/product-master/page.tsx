"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { createInboundProductsFromSkuMasters } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import { buildSupplyPlan } from "@/features/workbench/supply-decision";
import { groupSkuMastersByProduct, deriveProductFamilyKey } from "@/features/workbench/product-master";

export default function ProductMasterPage() {
  const data = useWorkbenchData();
  const [message, setMessage] = useState("");
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});
  const skus = data.skuMasters ?? [];
  const productGroups = groupSkuMastersByProduct(skus);
  const inboundGroups = productGroups.filter((group) => data.products.some((product) => product.recordKind === "existing" && product.productMode !== "dropship" && (product.productFamilyKey === group.familyKey || deriveProductFamilyKey(product.name) === group.familyKey)));

  function generateProducts() {
    const result = createInboundProductsFromSkuMasters();
    setMessage(`已生成/更新 ${result.createdProductIds.length} 个入仓产品，关联 ${result.linkedSkuCount} 条 SKU。`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">入仓产品主表</h1>
          <p className="mt-1 text-sm text-slate-500">实际经营产品的结构化入口。产品机会仍在“产品进程”中保留研究和阶段信息。</p>
        </div>
        <div className="flex gap-2">
          <Link className="rounded-md border border-line bg-white px-3 py-2 text-sm" href="/sku-master/import">管理 SKU 表</Link>
          <button className="rounded-md bg-action px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={skus.length === 0} onClick={generateProducts} type="button">从 SKU 表生成入仓产品</button>
        </div>
      </div>
      {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="入仓产品族" value={inboundGroups.length} />
        <Stat label="已导入 SKU" value={skus.length} />
        <Stat label="待关联 SKU" value={skus.filter((sku) => !sku.productId).length} />
      </div>
      {inboundGroups.length === 0 ? <EmptyState title="还没有入仓产品主表" description={skus.length ? "点击右上角按钮，系统会按产品族归并 SKU，并保留原产品机会资料。" : "请先导入并确认内部 SKU 表。"} actionHref="/sku-master/import" actionLabel="进入 SKU 导入" /> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper-warm text-xs text-slate-500"><tr><th className="px-4 py-3">产品</th><th className="px-4 py-3">SKU数</th><th className="px-4 py-3">内部编码</th><th className="px-4 py-3">供应方案</th><th className="px-4 py-3">经营状态</th><th className="px-4 py-3">经营数据</th></tr></thead>
            <tbody className="divide-y divide-line">{inboundGroups.map((group) => {
              const product = data.products.find((item) => item.recordKind === "existing" && item.productMode !== "dropship" && (item.productFamilyKey === group.familyKey || deriveProductFamilyKey(item.name) === group.familyKey));
              const productSkus = skus.filter((sku) => group.skuIds.includes(sku.id));
              const plan = buildSupplyPlan({
                products: [{ id: product?.id ?? group.familyKey, name: group.productName, productFamilyKey: group.familyKey }],
                skuMasters: productSkus,
                suppliers: data.suppliers.map((item) => ({ id: item.id, name: item.name })),
                offers: data.offers,
                links: data.skuOfferLinks ?? [],
                decisions: data.supplierOfferDecisions ?? []
              }, product?.id ?? group.familyKey);
              const expanded = Boolean(expandedFamilies[group.familyKey]);
              return <Fragment key={group.familyKey}><tr className="hover:bg-paper-warm/50"><td className="px-4 py-3"><div className="flex items-center gap-2"><button aria-label={`${expanded ? "收起" : "展开"}${group.productName} SKU`} className="rounded border border-line px-1.5 py-0.5 text-xs text-slate-500" onClick={() => setExpandedFamilies((current) => ({ ...current, [group.familyKey]: !expanded }))} type="button">{expanded ? "−" : "+"}</button>{product ? <Link className="font-medium text-action hover:underline" href={`/products/${product.id}`}>{group.productName}</Link> : <span className="font-medium text-slate-700">{group.productName}</span>}</div><div className="mt-1 pl-8 text-xs text-slate-400">{product?.category || "待补类目"}</div></td><td className="px-4 py-3">{productSkus.length}</td><td className="max-w-56 px-4 py-3 text-xs text-slate-600">{productSkus.slice(0, 4).map((sku) => sku.internalSkuCode).join("、") || "待关联"}{productSkus.length > 4 ? "…" : ""}</td><td className="px-4 py-3 text-xs">主供 {plan.primarySuppliers.length} · 备供 {plan.backupSuppliers.length}<div className="mt-1 text-amber-700">待补 {plan.missingFields.length}</div></td><td className="px-4 py-3">{product?.portfolioStatus === "active" ? "继续经营" : product?.portfolioStatus === "optimize" ? "需要优化" : product?.portfolioStatus === "discontinued" ? "淘汰" : "观察"}</td><td className="px-4 py-3 text-xs text-slate-500">{product?.portfolioMetrics?.monthlySales != null ? `月销量 ${product.portfolioMetrics.monthlySales}` : "待填写"}<div className="mt-1">{product?.portfolioMetrics?.grossMarginRate != null ? `毛利率 ${product.portfolioMetrics.grossMarginRate}%` : "毛利率待填写"}</div></td></tr>{expanded ? <tr className="bg-paper-warm/30"><td className="px-4 py-3" colSpan={6}><div className="grid gap-2 md:grid-cols-2">{productSkus.map((sku) => <div className="flex items-center justify-between rounded border border-line bg-white px-3 py-2 text-xs" key={sku.id}><span><span className="font-medium text-slate-800">{sku.internalSkuCode}</span><span className="ml-2 text-slate-500">{sku.specification || "规格待补"}</span></span><span className="text-slate-400">销量待填写 · 毛利待填写</span></div>)}</div></td></tr> : null}</Fragment>;
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-line bg-white p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div></div>;
}
