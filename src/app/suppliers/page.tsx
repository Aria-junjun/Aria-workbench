"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { LibraryToolbar, uniqueTags } from "@/components/workbench/library-toolbar";
import { findDuplicateSuppliers, includesQuery, mergeSuppliers, sortPinnedFirst, togglePinned, type LocalWorkbenchData } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import { labelSupplierType } from "@/features/workbench/display-labels";
import { AlertTriangle, ArrowRightLeft, Check, X } from "lucide-react";

export default function SuppliersPage() {
  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [version, setVersion] = useState(0);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicatePairs, setDuplicatePairs] = useState<ReturnType<typeof findDuplicateSuppliers>>([]);
  const [merging, setMerging] = useState<string | null>(null);
  const [mergedMsg, setMergedMsg] = useState<{ pair: string; text: string } | null>(null);
  // 使用 useEffect 延迟加载客户端数据，避免 hydration mismatch
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const workbenchData = useWorkbenchData();

  //  hydration 前使用空数据，hydration 后使用真实数据
  const data = workbenchData ?? { suppliers: [], communications: [], offers: [], products: [], tasks: [], knowledgeCards: [], knowledgeBooks: [], decisionTools: [], knowledgeApplications: [], decisionCases: [] };
  const suppliers = hydrated ? sortPinnedFirst(data.suppliers) : [];
  const tags = hydrated ? uniqueTags(suppliers.map((supplier) => [...supplier.categories, ...supplier.riskTags])) : [];
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

  function checkDuplicates() {
    const pairs = findDuplicateSuppliers();
    setDuplicatePairs(pairs);
    setShowDuplicates(true);
    setMergedMsg(null);
  }

  function handleMerge(targetId: string, sourceId: string, targetName: string, sourceName: string) {
    const pairKey = [targetId, sourceId].sort().join("|");
    if (!window.confirm(`确认合并吗？\n\n「${sourceName}」的所有货盘、沟通记录和待办将迁移到「${targetName}」，然后「${sourceName}」会被删除。\n\n此操作不可撤销。`)) return;
    setMerging(pairKey);
    mergeSuppliers(targetId, sourceId);
    setMerging(null);
    setMergedMsg({ pair: pairKey, text: `已合并：${sourceName} → ${targetName}` });
    setVersion((v) => v + 1);
    // 刷新重复列表
    setDuplicatePairs(findDuplicateSuppliers());
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

      {/* 重复检测工具栏 */}
      <div className="flex items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-xl border border-warning/30 bg-warning-soft/30 px-3 py-2 text-sm font-medium text-warning hover:bg-warning-soft/50 transition-colors"
          onClick={checkDuplicates}
          type="button"
        >
          <AlertTriangle className="h-4 w-4" />
          检测重复供应商
        </button>
        {duplicatePairs.length > 0 && !showDuplicates && (
          <span className="text-xs text-warning font-medium">{duplicatePairs.length} 组可能重复</span>
        )}
      </div>

      {/* 重复供应商面板 */}
      {showDuplicates && (
        <section className="rounded-2xl border border-warning/20 bg-warning-soft/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-warning" />
              <h2 className="font-semibold text-sm">
                {duplicatePairs.length > 0
                  ? `发现 ${duplicatePairs.length} 组可能重复的供应商`
                  : mergedMsg
                    ? "合并完成"
                    : "未发现重复供应商"}
              </h2>
            </div>
            <button
              className="rounded-lg px-2 py-1 text-xs text-muted hover:text-ink transition-colors"
              onClick={() => { setShowDuplicates(false); setMergedMsg(null); }}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {duplicatePairs.length === 0 && !mergedMsg ? (
            <p className="text-sm text-muted">所有供应商名称都不重复，无需合并。</p>
          ) : duplicatePairs.length === 0 && mergedMsg ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success-soft/20 px-4 py-3">
                <span className="text-sm text-success font-medium flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  {mergedMsg.text}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {duplicatePairs.map((pair) => {
                const pairKey = [pair.target.id, pair.source.id].sort().join("|");
                const isMerging = merging === pairKey;
                const isMerged = mergedMsg?.pair === pairKey;
                const targetOfferCount = data.offers.filter((o) => o.supplierId === pair.target.id || o.supplierName === pair.target.name).length;
                const sourceOfferCount = data.offers.filter((o) => o.supplierId === pair.source.id || o.supplierName === pair.source.name).length;

                return (
                  <div
                    className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
                      isMerged ? "border-success/30 bg-success-soft/20" : "border-line bg-white"
                    }`}
                    key={pairKey}
                  >
                    {isMerged ? (
                      <span className="text-sm text-success font-medium flex items-center gap-1">
                        <Check className="h-4 w-4" />
                        {mergedMsg!.text}
                      </span>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-medium text-sm truncate">{pair.target.name}</span>
                          <span className="text-xs text-muted shrink-0">
                            {join(pair.target.categories) || "未分类"} · {targetOfferCount}个货盘
                          </span>
                          <ArrowRightLeft className="h-3.5 w-3.5 text-muted shrink-0" />
                          <span className="font-medium text-sm truncate">{pair.source.name}</span>
                          <span className="text-xs text-muted shrink-0">
                            {join(pair.source.categories) || "未分类"} · {sourceOfferCount}个货盘
                          </span>
                          <span className="text-xs text-warning shrink-0 rounded bg-warning-soft/40 px-1.5 py-0.5">
                            {pair.reason}
                          </span>
                        </div>
                        <button
                          className="shrink-0 rounded-lg bg-action px-3 py-1.5 text-xs font-medium text-white hover:bg-action/90 disabled:opacity-50 transition-colors"
                          disabled={isMerging}
                          onClick={() => handleMerge(pair.target.id, pair.source.id, pair.target.name, pair.source.name)}
                          type="button"
                        >
                          {isMerging ? "合并中..." : "合并"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

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
