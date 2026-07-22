"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { LibraryToolbar, uniqueTags } from "@/components/workbench/library-toolbar";
import { includesQuery, loadLocalWorkbenchData, sortPinnedFirst, togglePinned } from "@/features/workbench/local-store";

export default function ProductsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [version, setVersion] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const products = sortPinnedFirst(loadLocalWorkbenchData().products);
  const tags = uniqueTags(products.map((product) => [product.name]));
  const filtered = products.filter(
    (product) =>
      (!pinnedOnly || product.pinned) &&
      (!selectedTag || product.name === selectedTag) &&
      includesQuery([
        product.name,
        product.category,
        product.coreUse,
        product.targetUsers,
        product.useScenarios.join(" "),
        product.specifications.map((item) => `${item.name} ${item.value} ${item.unit || ""}`).join(" "),
        product.procurementQuotes.map((item) => `${item.source} ${item.specification} ${item.price}`).join(" "),
        product.materialStructures.map((item) => `${item.name} ${item.role || ""}`).join(" "),
        product.manufacturing.processes.join(" "),
        product.machinery.join(" "),
        product.decision.summary,
        product.decision.recommendation
      ], query)
  );

  function pin(id: string) {
    togglePinned("products", id);
    setVersion((current) => current + 1);
  }

  return (
    <div className="space-y-5" data-version={version}>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:text-slate-400"
          disabled={selectedIds.length < 2}
          onClick={() => router.push(`/products/compare?ids=${selectedIds.join(",")}`)}
          type="button"
        >
          对比已选（{selectedIds.length}）
        </button>
        <Link
          className="whitespace-nowrap rounded-md bg-action px-3 py-2 text-sm font-medium text-white"
          href="/products/import"
        >
          导入产品调研
        </Link>
      </div>
      <LibraryToolbar
        onPinnedOnlyChange={setPinnedOnly}
        onQueryChange={setQuery}
        onSelectedTagChange={setSelectedTag}
        pinnedOnly={pinnedOnly}
        placeholder="搜索产品、规格、工艺、风险"
        query={query}
        selectedTag={selectedTag}
        tags={tags}
        title="产品知识库"
      />
      {products.length === 0 ? (
        <EmptyState
          title="还没有产品知识"
          description="导入标准产品调研文档，沉淀关键规格、真实采购报价、原料、工艺和质量风险。"
          actionHref="/products/import"
          actionLabel="导入产品调研"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <article className="rounded-lg border border-line bg-white p-4" key={product.id}>
              <div className="flex items-start justify-between gap-3">
                <label className="flex min-w-0 flex-1 items-start gap-2">
                  <input
                    checked={selectedIds.includes(product.id)}
                    className="mt-1"
                    onChange={(event) => setSelectedIds((current) => event.target.checked
                      ? [...current, product.id]
                      : current.filter((id) => id !== product.id))}
                    type="checkbox"
                  />
                  <Link className="min-w-0 font-medium hover:text-action" href={`/products/${product.id}`}>{product.name}</Link>
                </label>
                <button className="shrink-0 whitespace-nowrap rounded border border-line px-2 py-1 text-xs" onClick={() => pin(product.id)} type="button">
                  {product.pinned ? "取消置顶" : "置顶"}
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{product.decision.summary || product.coreUse || "未记录摘要"}</p>
              <div className="mt-3 space-y-1 text-sm">
                <Info label="品类" value={product.category} />
                <Info label="主要原料" value={product.materialStructures.map((item) => item.name).slice(0, 3).join("、")} />
                <Info label="采购报价" value={product.procurementQuotes.length ? `${product.procurementQuotes.length} 条真实报价` : "待询价"} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}：</span>
      {value || "未记录"}
    </div>
  );
}
