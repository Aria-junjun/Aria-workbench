"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { createInboundProductsFromSkuMasters } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import { buildSupplyPlan } from "@/features/workbench/supply-decision";

export default function ProductMasterPage() {
  const data = useWorkbenchData();
  const [message, setMessage] = useState("");
  const skus = data.skuMasters ?? [];
  const inboundProducts = data.products.filter((product) => product.recordKind === "existing" && product.productMode !== "dropship");

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
        <Stat label="入仓产品" value={inboundProducts.length} />
        <Stat label="已导入 SKU" value={skus.length} />
        <Stat label="待关联 SKU" value={skus.filter((sku) => !sku.productId).length} />
      </div>
      {inboundProducts.length === 0 ? <EmptyState title="还没有入仓产品主表" description={skus.length ? "点击右上角按钮，系统会按商品名称归并 SKU，并保留原产品机会资料。" : "请先导入并确认内部 SKU 表。"} actionHref="/sku-master/import" actionLabel="进入 SKU 导入" /> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper-warm text-xs text-slate-500"><tr><th className="px-4 py-3">产品</th><th className="px-4 py-3">SKU数</th><th className="px-4 py-3">内部编码</th><th className="px-4 py-3">供应方案</th><th className="px-4 py-3">经营状态</th><th className="px-4 py-3">经营数据</th></tr></thead>
            <tbody className="divide-y divide-line">{inboundProducts.map((product) => {
              const productSkus = skus.filter((sku) => sku.productId === product.id || (!sku.productId && sku.productName === product.name));
              const plan = buildSupplyPlan({
                products: data.products.map((item) => ({ id: item.id, name: item.name })),
                skuMasters: productSkus,
                suppliers: data.suppliers.map((item) => ({ id: item.id, name: item.name })),
                offers: data.offers,
                links: data.skuOfferLinks ?? [],
                decisions: data.supplierOfferDecisions ?? []
              }, product.id);
              return <tr className="hover:bg-paper-warm/50" key={product.id}><td className="px-4 py-3"><Link className="font-medium text-action hover:underline" href={`/products/${product.id}`}>{product.name}</Link><div className="mt-1 text-xs text-slate-400">{product.category || "待补类目"}</div></td><td className="px-4 py-3">{productSkus.length}</td><td className="max-w-56 px-4 py-3 text-xs text-slate-600">{productSkus.slice(0, 4).map((sku) => sku.internalSkuCode).join("、") || "待关联"}{productSkus.length > 4 ? "…" : ""}</td><td className="px-4 py-3 text-xs">主供 {plan.primarySuppliers.length} · 备供 {plan.backupSuppliers.length}<div className="mt-1 text-amber-700">待补 {plan.missingFields.length}</div></td><td className="px-4 py-3">{product.portfolioStatus === "active" ? "继续经营" : product.portfolioStatus === "optimize" ? "需要优化" : product.portfolioStatus === "discontinued" ? "淘汰" : "观察"}</td><td className="px-4 py-3 text-xs text-slate-500">{product.portfolioMetrics?.monthlySales != null ? `月销量 ${product.portfolioMetrics.monthlySales}` : "待填写"}<div className="mt-1">{product.portfolioMetrics?.grossMarginRate != null ? `毛利率 ${product.portfolioMetrics.grossMarginRate}%` : "毛利率待填写"}</div></td></tr>;
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
