"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { buildProductBrief } from "@/features/workbench/product-brief";
import { useWorkbenchData } from "@/features/workbench/workbench-store";

export default function ProductBriefPage() {
  const params = useParams();
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId;
  const product = useWorkbenchData().products.find((item) => item.id === productId);

  if (!product) {
    return <div className="rounded-md border border-line bg-white p-4 text-sm">没有找到这个产品知识。</div>;
  }
  const brief = buildProductBrief(product);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link className="text-sm text-action" href={`/products/${product.id}`}>返回产品详情</Link>
        <button className="rounded-md bg-action px-3 py-2 text-sm font-medium text-white" onClick={() => window.print()} type="button">打印或另存为 PDF</button>
      </div>
      <article className="bg-white p-6 print:p-0">
        <header className="border-b border-line pb-4">
          <p className="text-sm text-slate-500">产品知识简报</p>
          <h1 className="mt-1 text-3xl font-semibold">{brief.title}</h1>
          <p className="mt-2 text-slate-600">{brief.subtitle || "未记录产品定位"}</p>
        </header>
        <div className="grid gap-4 border-b border-line py-5 sm:grid-cols-2">
          {brief.facts.map(([label, value]) => (
            <div key={label}><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-sm">{value}</div></div>
          ))}
        </div>
        <div className="grid gap-x-8 gap-y-6 pt-5 sm:grid-cols-2">
          {brief.sections.map((section) => (
            <section key={section.title}>
              <h2 className="border-b border-line pb-2 text-lg font-semibold">{section.title}</h2>
              {section.items.length ? (
                <ul className="mt-3 space-y-2 text-sm">{section.items.map((item, index) => <li key={`${section.title}-${index}`}>• {item}</li>)}</ul>
              ) : <p className="mt-3 text-sm text-slate-500">未记录</p>}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
