"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { LibraryToolbar, uniqueTags } from "@/components/workbench/library-toolbar";
import { includesQuery, sortPinnedFirst, togglePinned } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import {
  LIFECYCLE_STAGE_OPTIONS,
  SIGNAL_STATUS_OPTIONS,
  labelLifecycleStage,
  labelSignalStatus
} from "@/features/workbench/display-labels";

export default function ProductsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [signalStatusFilter, setSignalStatusFilter] = useState<string>("");
  const [version, setVersion] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const products = sortPinnedFirst(useWorkbenchData().products);
  const tags = uniqueTags(products.map((product) => [product.name]));

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { total: products.length };
    for (const p of products) {
      const s = p.lifecycleStage ?? "unset";
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [products]);

  const filtered = products.filter(
    (product) =>
      (!pinnedOnly || product.pinned) &&
      (!selectedTag || product.name === selectedTag) &&
      (!stageFilter || product.lifecycleStage === stageFilter || (stageFilter === "unset" && !product.lifecycleStage)) &&
      (!signalStatusFilter ||
        (stageFilter === "signal" || product.lifecycleStage === "signal" || !product.lifecycleStage
          ? product.signalStatus === signalStatusFilter || (signalStatusFilter === "unset" && !product.signalStatus)
          : false)) &&
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

      {/* 漏斗：阶段分段概览 + 快速筛选 */}
      <div className="rounded-xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">产品机会漏斗</h2>
          <div className="text-xs text-slate-500">共 {products.length} 条机会 · 选中 {filtered.length}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FunnelChip
            label="全部"
            count={stageCounts.total}
            active={!stageFilter}
            tone="default"
            onClick={() => { setStageFilter(""); setSignalStatusFilter(""); }}
          />
          {LIFECYCLE_STAGE_OPTIONS.map((opt) => {
            const meta = labelLifecycleStage(opt.value);
            return (
              <FunnelChip
                key={opt.value}
                label={opt.label}
                count={stageCounts[opt.value] ?? 0}
                active={stageFilter === opt.value}
                tone={opt.value === "validated" || opt.value === "supply_locked" ? "accent" : "default"}
                onClick={() => { setStageFilter(opt.value); setSignalStatusFilter(""); }}
              />
            );
          })}
        </div>
        {/* 信号池时显示二级状态筛选 */}
        {(stageFilter === "signal" || stageFilter === "") && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
            <span className="text-xs text-slate-500">信号状态：</span>
            <FunnelChip
              label="不限"
              count={products.filter((p) => !p.lifecycleStage || p.lifecycleStage === "signal").length}
              active={!signalStatusFilter}
              tone="default"
              onClick={() => setSignalStatusFilter("")}
            />
            {SIGNAL_STATUS_OPTIONS.map((opt) => {
              const meta = labelSignalStatus(opt.value);
              return (
                <FunnelChip
                  key={opt.value}
                  label={opt.label}
                  count={products.filter((p) => p.signalStatus === opt.value).length}
                  active={signalStatusFilter === opt.value}
                  tone={opt.value === "dormant" ? "muted" : "default"}
                  onClick={() => setSignalStatusFilter(opt.value)}
                />
              );
            })}
          </div>
        )}
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
          {filtered.map((product) => {
            const stage = labelLifecycleStage(product.lifecycleStage);
            const signal = labelSignalStatus(product.signalStatus);
            return (
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
                {/* 阶段标签 + 信号标签（如果是信号池） */}
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${stage.tone}`}>
                    {stage.label}
                  </span>
                  {(!product.lifecycleStage || product.lifecycleStage === "signal") && product.signalStatus && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${signal.tone}`}>
                      {signal.label}
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{product.decision.summary || product.coreUse || "未记录摘要"}</p>
                <div className="mt-3 space-y-1 text-sm">
                  <Info label="品类" value={product.category} />
                  <Info label="主要原料" value={product.materialStructures.map((item) => item.name).slice(0, 3).join("、")} />
                  <Info label="采购报价" value={product.procurementQuotes.length ? `${product.procurementQuotes.length} 条真实报价` : "待询价"} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FunnelChip({
  label,
  count,
  active,
  tone,
  onClick
}: {
  label: string;
  count: number;
  active: boolean;
  tone: "default" | "accent" | "muted";
  onClick: () => void;
}) {
  const base = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all";
  const activeTone =
    tone === "accent"
      ? "border-action/30 bg-action-soft text-action shadow-sm ring-1 ring-inset ring-action/20"
      : tone === "muted"
        ? "border-slate-300 bg-slate-100 text-slate-700"
        : "border-slate-400/40 bg-slate-800 text-white";
  const idleTone =
    tone === "accent"
      ? "border-action/20 bg-white text-slate-600 hover:bg-action-soft/40"
      : tone === "muted"
        ? "border-line bg-white text-slate-500 hover:bg-slate-50"
        : "border-line bg-white text-slate-600 hover:bg-slate-50";
  return (
    <button
      className={`${base} ${active ? activeTone : idleTone}`}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <span className={`rounded-full px-1.5 text-[10px] ${active ? (tone === "default" ? "bg-white/20 text-white" : "bg-white/60") : "bg-slate-100 text-slate-500"}`}>
        {count}
      </span>
    </button>
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
