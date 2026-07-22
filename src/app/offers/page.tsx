"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDownUp, ArrowUpDown } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LibraryToolbar, uniqueTags } from "@/components/workbench/library-toolbar";
import { includesQuery, loadLocalWorkbenchData, sortPinnedFirst, togglePinned, type LocalOffer } from "@/features/workbench/local-store";

type SortField = "createdAt" | "quotedPriceNum" | "moqNum" | "leadTimeDays";
type SortDirection = "asc" | "desc";

export default function OffersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [version, setVersion] = useState(0);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [moqMax, setMoqMax] = useState("");

  const offers = sortPinnedFirst(loadLocalWorkbenchData().offers);
  const tags = uniqueTags(offers.map((offer) => [offer.category || "", offer.supplierName || ""]));

  const filtered = useMemo(() => {
    let result = offers.filter(
      (offer) =>
        (!pinnedOnly || offer.pinned) &&
        (!selectedTag || offer.category === selectedTag || offer.supplierName === selectedTag) &&
        includesQuery(
          [
            offer.name,
            offer.supplierName,
            offer.category,
            offer.productUrl,
            offer.resourceUrl,
            offer.quotedPrice,
            offer.priceDetails,
            offer.comparisonBasis,
            offer.normalizedPriceDetails,
            offer.moq,
            offer.leadTime,
            offer.risks
          ],
          query
        )
    );

    // 数值筛选
    const minPrice = priceMin ? parseFloat(priceMin) : null;
    const maxPrice = priceMax ? parseFloat(priceMax) : null;
    const maxMoq = moqMax ? parseInt(moqMax, 10) : null;

    result = result.filter((offer) => {
      if (minPrice !== null && (offer.quotedPriceNum === null || offer.quotedPriceNum === undefined || offer.quotedPriceNum < minPrice)) return false;
      if (maxPrice !== null && (offer.quotedPriceNum === null || offer.quotedPriceNum === undefined || offer.quotedPriceNum > maxPrice)) return false;
      if (maxMoq !== null && (offer.moqNum === null || offer.moqNum === undefined || offer.moqNum > maxMoq)) return false;
      return true;
    });

    // 排序
    result.sort((a, b) => {
      // 置顶始终优先
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;

      const aVal = a[sortField];
      const bVal = b[sortField];

      // null/undefined 排最后
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      // 字符串排序（createdAt）
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return result;
  }, [offers, pinnedOnly, selectedTag, query, sortField, sortDir, priceMin, priceMax, moqMax]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function pin(id: string) {
    togglePinned("offers", id);
    setVersion((current) => current + 1);
  }

  function toggleSelected(id: string) {
    setSelectedOfferIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function generateQuoteTable() {
    if (selectedOfferIds.length === 0) return;
    router.push(`/quotes?offerIds=${encodeURIComponent(selectedOfferIds.join(","))}`);
  }

  return (
    <div className="space-y-5" data-version={version}>
      <LibraryToolbar
        onPinnedOnlyChange={setPinnedOnly}
        onQueryChange={setQuery}
        onSelectedTagChange={setSelectedTag}
        pinnedOnly={pinnedOnly}
        placeholder="搜索货盘、供应商、报价、MOQ"
        query={query}
        selectedTag={selectedTag}
        tags={tags}
        title="货盘库"
      />

      {/* 排序与数值筛选 */}
      {offers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">排序</span>
            <SortButton active={sortField === "quotedPriceNum"} direction={sortDir} label="报价" onClick={() => toggleSort("quotedPriceNum")} />
            <SortButton active={sortField === "moqNum"} direction={sortDir} label="MOQ" onClick={() => toggleSort("moqNum")} />
            <SortButton active={sortField === "leadTimeDays"} direction={sortDir} label="交期" onClick={() => toggleSort("leadTimeDays")} />
            <SortButton active={sortField === "createdAt"} direction={sortDir} label="时间" onClick={() => toggleSort("createdAt")} />
          </div>
          <div className="mx-1 h-6 w-px bg-line" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">筛选</span>
            <input
              className="w-20 rounded-md border border-line px-2 py-1 text-xs"
              onChange={(e) => setPriceMin(e.target.value)}
              placeholder="最低报价"
              type="number"
              value={priceMin}
            />
            <span className="text-xs text-muted-light">-</span>
            <input
              className="w-20 rounded-md border border-line px-2 py-1 text-xs"
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="最高报价"
              type="number"
              value={priceMax}
            />
            <input
              className="w-20 rounded-md border border-line px-2 py-1 text-xs"
              onChange={(e) => setMoqMax(e.target.value)}
              placeholder="最大MOQ"
              type="number"
              value={moqMax}
            />
            {(priceMin || priceMax || moqMax) ? (
              <button
                className="text-xs text-muted hover:text-action"
                onClick={() => { setPriceMin(""); setPriceMax(""); setMoqMax(""); }}
                type="button"
              >
                清除
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {offers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3">
          <span className="text-sm text-slate-600">
            {selectedOfferIds.length > 0 ? `已选择 ${selectedOfferIds.length} 个货盘` : "勾选货盘后可生成报价对比表"}
          </span>
          <button
            className="rounded-md bg-action px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedOfferIds.length === 0}
            onClick={generateQuoteTable}
            type="button"
          >
            生成对比表
          </button>
          <button
            className="rounded-md border border-line px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedOfferIds.length === 0}
            onClick={() => setSelectedOfferIds([])}
            type="button"
          >
            清空选择
          </button>
        </div>
      ) : null}
      {offers.length === 0 ? (
        <EmptyState title="还没有货盘" description="货盘会从沟通整理结果中归档，不做复杂对比。" actionHref="/intake" actionLabel="录入沟通" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((offer) => (
            <article className="rounded-lg border border-line bg-white p-4" key={offer.id}>
              <div className="flex items-start justify-between gap-3">
                <label className="flex min-w-0 flex-1 items-start gap-2">
                  <input
                    checked={selectedOfferIds.includes(offer.id)}
                    className="mt-1"
                    onChange={() => toggleSelected(offer.id)}
                    type="checkbox"
                  />
                  <span className="min-w-0">
                    <span className="mb-1 inline-block rounded bg-paper px-2 py-0.5 text-xs text-slate-500">选择</span>
                    <Link className="block font-medium hover:text-action" href={`/offers/${offer.id}`}>
                      {offer.name}
                    </Link>
                  </span>
                </label>
                <button className="shrink-0 whitespace-nowrap rounded border border-line px-2 py-1 text-xs" onClick={() => pin(offer.id)} type="button">
                  {offer.pinned ? "取消置顶" : "置顶"}
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{offer.supplierName || "未关联供应商"}</p>
              <div className="mt-3 space-y-1 text-sm">
                <Info label="报价" value={offer.quotedPrice} />
                {offer.normalizedPriceDetails ? <Info label="折算" value={offer.normalizedPriceDetails} /> : null}
                <Info label="MOQ" value={offer.moq} />
                <Info label="交期" value={offer.leadTime} />
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {offer.productUrl ? (
                  <a className="text-sm text-action hover:underline" href={offer.productUrl} rel="noreferrer" target="_blank">
                    打开商品链接
                  </a>
                ) : null}
                {offer.resourceUrl ? (
                  <a className="text-sm text-action hover:underline" href={offer.resourceUrl} rel="noreferrer" target="_blank">
                    打开资料链接
                  </a>
                ) : null}
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
    <div className="line-clamp-2">
      <span className="text-slate-500">{label}：</span>
      {value || "未记录"}
    </div>
  );
}

function SortButton({ label, active, direction, onClick }: { label: string; active: boolean; direction: SortDirection; onClick: () => void }) {
  return (
    <button
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
        active ? "bg-action-soft text-action font-medium" : "text-muted hover:bg-paper-warm"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
      {active ? (direction === "asc" ? <ArrowUpDown className="h-3 w-3" /> : <ArrowDownUp className="h-3 w-3" />) : null}
    </button>
  );
}
