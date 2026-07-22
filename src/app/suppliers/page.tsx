"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { LibraryToolbar, uniqueTags } from "@/components/workbench/library-toolbar";
import { includesQuery, loadLocalWorkbenchData, sortPinnedFirst, togglePinned } from "@/features/workbench/local-store";
import { labelSupplierType } from "@/features/workbench/display-labels";

export default function SuppliersPage() {
  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [version, setVersion] = useState(0);
  const suppliers = sortPinnedFirst(loadLocalWorkbenchData().suppliers);
  const tags = uniqueTags(suppliers.map((supplier) => [...supplier.categories, ...supplier.riskTags]));
  const filtered = suppliers.filter(
    (supplier) =>
      (!pinnedOnly || supplier.pinned) &&
      (!selectedTag || supplier.categories.includes(selectedTag) || supplier.riskTags.includes(selectedTag)) &&
      includesQuery([supplier.name, supplier.location, supplier.sourcePlatform, supplier.storeUrl, supplier.contactMethod, join(supplier.categories), join(supplier.riskTags), supplier.notes], query)
  );

  function pin(id: string) {
    togglePinned("suppliers", id);
    setVersion((current) => current + 1);
  }

  return (
    <div className="space-y-5" data-version={version}>
      <LibraryToolbar
        onPinnedOnlyChange={setPinnedOnly}
        onQueryChange={setQuery}
        onSelectedTagChange={setSelectedTag}
        pinnedOnly={pinnedOnly}
        placeholder="搜索供应商、品类、地区、风险"
        query={query}
        selectedTag={selectedTag}
        tags={tags}
        title="供应商库"
      />
      {suppliers.length === 0 ? (
        <EmptyState title="还没有供应商" description="从一次沟通整理开始建立供应商档案。" actionHref="/intake" actionLabel="快速录入" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((supplier) => (
            <article className="rounded-lg border border-line bg-white p-4" key={supplier.id}>
              <div className="flex items-start justify-between gap-3">
                <Link className="min-w-0 flex-1 font-medium hover:text-action" href={`/suppliers/${supplier.id}`}>
                  {supplier.name}
                </Link>
                <button className="shrink-0 whitespace-nowrap rounded border border-line px-2 py-1 text-xs" onClick={() => pin(supplier.id)} type="button">
                  {supplier.pinned ? "取消置顶" : "置顶"}
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{join(supplier.categories) || "未分类"}</p>
              <div className="mt-3 space-y-1 text-sm">
                <Info label="地区" value={supplier.location} />
                <Info label="平台" value={supplier.sourcePlatform} />
                <Info label="类型" value={labelSupplierType(supplier.supplierType)} />
                <Info label="风险" value={join(supplier.riskTags)} />
              </div>
              {supplier.storeUrl ? (
                <a className="mt-3 inline-block text-sm text-action hover:underline" href={supplier.storeUrl} rel="noreferrer" target="_blank">
                  打开店铺链接
                </a>
              ) : null}
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

function join(values?: string[]) {
  return Array.isArray(values) ? values.join(" / ") : "";
}
