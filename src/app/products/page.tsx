"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { LibraryToolbar, uniqueTags } from "@/components/workbench/library-toolbar";
import { includesQuery, sortPinnedFirst, syncFromCloud, togglePinned } from "@/features/workbench/local-store";
import { setWorkbenchSnapshot, useWorkbenchData } from "@/features/workbench/workbench-store";
import {
  LIFECYCLE_STAGE_OPTIONS,
  PRODUCT_RECORD_KIND_OPTIONS,
  SIGNAL_STATUS_OPTIONS,
  labelLifecycleStage,
  labelProductRecordKind,
  labelSignalStatus
} from "@/features/workbench/display-labels";
import { getStageMeta, getAllStages, getStageIndex } from "@/features/workbench/stage-checklist-template";
import { ChevronRight } from "lucide-react";

const stageColors: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  signal: { bg: "bg-slate-400", text: "text-slate-600", border: "border-slate-300", hex: "#94a3b8" },
  validated: { bg: "bg-blue-400", text: "text-blue-600", border: "border-blue-300", hex: "#60a5fa" },
  defined: { bg: "bg-indigo-400", text: "text-indigo-600", border: "border-indigo-300", hex: "#818cf8" },
  supply_locked: { bg: "bg-amber-400", text: "text-amber-600", border: "border-amber-300", hex: "#fbbf24" },
  listing: { bg: "bg-emerald-400", text: "text-emerald-600", border: "border-emerald-300", hex: "#34d399" },
  evaluating: { bg: "bg-purple-400", text: "text-purple-600", border: "border-purple-300", hex: "#c084fc" },
  archived: { bg: "bg-green-500", text: "text-green-600", border: "border-green-300", hex: "#22c55e" },
  discontinued: { bg: "bg-red-400", text: "text-red-600", border: "border-red-300", hex: "#f87171" }
};

export default function ProductsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [recordKindFilter, setRecordKindFilter] = useState<string>("");
  const [signalStatusFilter, setSignalStatusFilter] = useState<string>("");
  const [version, setVersion] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const products = sortPinnedFirst(useWorkbenchData().products);
  const tags = uniqueTags(products.map((product) => [product.name]));

  useEffect(() => {
    void syncFromCloud().then((data) => {
      setWorkbenchSnapshot(data);
    }).catch(() => {});
  }, []);

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
      (!recordKindFilter || product.recordKind === recordKindFilter) &&
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

      {/* Funnel visualization */}
      <div className="rounded-xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">产品分类与机会阶段</h2>
          <div className="text-xs text-slate-500">共 {products.length} 条记录 · 当前显示 {filtered.length}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FunnelChip
            label="全部"
            count={stageCounts.total}
            active={!recordKindFilter && !stageFilter}
            tone="default"
            onClick={() => { setRecordKindFilter(""); setStageFilter(""); setSignalStatusFilter(""); }}
          />
          {PRODUCT_RECORD_KIND_OPTIONS.map((opt) => (
            <FunnelChip
              key={opt.value}
              label={opt.label}
              count={products.filter((product) => product.recordKind === opt.value).length}
              active={recordKindFilter === opt.value}
              tone={opt.value === "existing" ? "accent" : "default"}
              onClick={() => { setRecordKindFilter(opt.value); setStageFilter(""); setSignalStatusFilter(""); }}
            />
          ))}
        </div>
        {(!recordKindFilter || recordKindFilter === "opportunity") && (
        <>
        <div className="mt-3 border-t border-dashed border-line pt-3 text-xs font-medium text-slate-500">机会阶段</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {LIFECYCLE_STAGE_OPTIONS.map((opt) => {
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
            {SIGNAL_STATUS_OPTIONS.map((opt) => (
              <FunnelChip
                key={opt.value}
                label={opt.label}
                count={products.filter((p) => p.signalStatus === opt.value).length}
                active={signalStatusFilter === opt.value}
                tone={opt.value === "dormant" ? "muted" : "default"}
                onClick={() => setSignalStatusFilter(opt.value)}
              />
            ))}
          </div>
        )}
        </>
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
            const signal = labelSignalStatus(product.signalStatus);
            const currentStage = product.lifecycleStage ?? "signal";
            const progress = product.stageProgress?.find((sp) => sp.stage === currentStage);
            const checklist = progress?.checklist ?? [];
            const completedCount = checklist.filter((c) => c.checked).length;
            const totalCount = checklist.length;
            const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const colors = stageColors[currentStage] ?? stageColors.signal;
            const meta = getStageMeta(currentStage);
            const stages = getAllStages();
            const currentIdx = getStageIndex(currentStage);

            return (
              <article
                className="group rounded-xl border border-line bg-white p-4 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5"
                key={product.id}
              >
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
                    <Link className="min-w-0 font-medium hover:text-action line-clamp-2" href={`/products/${product.id}`}>
                      {product.name}
                    </Link>
                  </label>
                  <button className="shrink-0 whitespace-nowrap rounded border border-line px-2 py-1 text-xs" onClick={() => pin(product.id)} type="button">
                    {product.pinned ? "取消置顶" : "置顶"}
                  </button>
                </div>

                {/* Stage progress visualization */}
                <div className="mt-3 rounded-lg border border-line-soft bg-paper-warm/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${labelProductRecordKind(product.recordKind).tone}`}>
                        {labelProductRecordKind(product.recordKind).label}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${colors.bg} text-white`}>
                        {meta.title}
                      </span>
                      {(!product.lifecycleStage || product.lifecycleStage === "signal") && product.signalStatus && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${signal.tone}`}>
                          {signal.label}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted font-semibold">{progressPercent}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-warm">
                    <div
                      className={`h-full rounded-full transition-all ${colors.bg}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Stage dots */}
                  <div className="mt-2 flex items-center gap-0.5">
                    {stages.map((s, i) => {
                      const stageColor = stageColors[s];
                      const isCurrent = s === currentStage;
                      const isPast = i < currentIdx;
                      return (
                        <div key={s} className="flex items-center">
                          <div
                            className={`h-2 w-2 rounded-full transition-all ${
                              isCurrent
                                ? `${stageColor.bg} ring-2 ring-offset-1 ring-offset-white`
                                : isPast
                                  ? stageColor.bg
                                  : "bg-muted-light/30"
                            }`}
                          />
                          {i < stages.length - 1 && (
                            <div className={`w-2 h-px ${isPast ? stageColor.bg : "bg-line-soft"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-muted">
                      {totalCount > 0
                        ? `${completedCount}/${totalCount} 检查项`
                        : "检查项待生成"}
                    </span>
                    <div className="flex items-center gap-0.5 text-muted-light group-hover:text-action transition-colors">
                      <span>查看</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>

                {/* Quick info */}
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{product.decision.summary || product.coreUse || "未记录摘要"}</p>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  {product.category && <div>品类：{product.category}</div>}
                  <div>
                    报价 {product.procurementQuotes.length} 条 · 原料 {product.materialStructures.length} 种
                  </div>
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
