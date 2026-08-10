"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { buildProductComparison } from "@/features/workbench/product-comparison";
import { useWorkbenchData } from "@/features/workbench/workbench-store";

export default function ProductComparisonPage() {
  return (
    <Suspense fallback={<div className="rounded-md border border-line bg-white p-4 text-sm">正在加载对比表...</div>}>
      <ProductComparisonContent />
    </Suspense>
  );
}

function ProductComparisonContent() {
  const searchParams = useSearchParams();
  const ids = (searchParams.get("ids") || "").split(",").filter(Boolean);
  const products = useWorkbenchData().products.filter((product) => ids.includes(product.id));
  const comparison = buildProductComparison(products);

  if (products.length < 2) {
    return (
      <div className="space-y-4">
        <Link className="text-sm text-action" href="/products">返回产品知识库</Link>
        <div className="rounded-md border border-line bg-white p-4 text-sm">请至少选择两个产品进行对比。</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link className="text-sm text-action" href="/products">返回产品知识库</Link>
        <h1 className="mt-2 text-2xl font-semibold">产品对比表</h1>
        <p className="mt-1 text-sm text-slate-600">只比较产品端资料；缺失字段保留为“未记录”。</p>
      </div>
      {comparison.unitWarning ? (
        <p className="rounded-md border border-warning/40 bg-white px-3 py-2 text-sm text-warning">{comparison.unitWarning}</p>
      ) : null}
      <div className="overflow-x-auto rounded-md border border-line bg-white">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-paper">
              <th className="min-w-32 px-3 py-3 font-medium">对比项目</th>
              {products.map((product) => <th className="min-w-52 px-3 py-3 font-medium" key={product.id}>{product.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr className="border-b border-line last:border-0" key={row.label}>
                <th className="px-3 py-3 font-medium text-slate-600">{row.label}</th>
                {row.values.map((value, index) => <td className="whitespace-pre-wrap px-3 py-3 align-top" key={`${row.label}-${products[index].id}`}>{value}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
