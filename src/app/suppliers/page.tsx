"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import {
  findDuplicateSuppliers,
  includesQuery,
  mergeSuppliers,
  sortPinnedFirst,
  togglePinned,
} from "@/features/workbench/local-store";
import { getSupplierKpiSummary, getQcdsWeights, type SupplierGrade, type SupplierBusinessModel } from "@/features/workbench/supplier-evaluation";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import {
  buildSupplierDecisionOverviewRows,
  deriveProductFamilyKey,
  groupSkuMastersByProduct,
} from "@/features/workbench/product-master";
import { labelSupplierType } from "@/features/workbench/display-labels";
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Plus,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";

type Period = "month" | "quarter" | "year";

export default function SuppliersPage() {
  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [period, setPeriod] = useState<Period>("quarter");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [version, setVersion] = useState(0);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicatePairs, setDuplicatePairs] = useState<ReturnType<typeof findDuplicateSuppliers>>([]);
  const [merging, setMerging] = useState<string | null>(null);
  const [mergedMsg, setMergedMsg] = useState<{ pair: string; text: string } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const workbenchData = useWorkbenchData();
  const data = workbenchData ?? {
    suppliers: [], communications: [], offers: [], products: [],
    tasks: [], knowledgeCards: [], knowledgeBooks: [], decisionTools: [],
    knowledgeApplications: [], decisionCases: [], skuMasters: [], monthlyInboundSnapshots: [],
  };

  const suppliers = hydrated ? sortPinnedFirst(data.suppliers) : [];
  const kpi = getSupplierKpiSummary(suppliers);

  // 收集所有品类
  const allCategories = hydrated
    ? [...new Set(suppliers.flatMap((s) => s.categories))].sort()
    : [];

  // 筛选
  const filtered = suppliers.filter(
    (supplier) =>
      (!pinnedOnly || supplier.pinned) &&
      (!selectedCategory || supplier.categories.includes(selectedCategory)) &&
      (!selectedGrade || supplier.latestEvaluationGrade === selectedGrade) &&
      (!selectedModel || (supplier.businessModel ?? "inbound") === selectedModel) &&
      includesQuery(
        [supplier.name, supplier.location, supplier.sourcePlatform, supplier.storeUrl,
         supplier.contactMethod, join(supplier.categories), join(supplier.riskTags), supplier.notes],
        query
      )
  );

  // 表头权重：筛选了具体模式时显示对应权重，否则用入仓型默认
  const displayModel: SupplierBusinessModel = selectedModel ? (selectedModel as SupplierBusinessModel) : "inbound";
  const dw = getQcdsWeights(displayModel);
  const modelLabel = selectedModel === "dropship" ? "代发型" : selectedModel === "hybrid" ? "综合型" : "入仓型（默认）";
  const skuMasters = (data.skuMasters ?? []).filter((sku) => sku.status !== "archived");
  const existingProductFamilyKeys = new Set(
    data.products
      .filter((product) => product.recordKind === "existing" && product.productMode !== "dropship")
      .map((product) => product.productFamilyKey || deriveProductFamilyKey(product.name)),
  );
  const decisionGroups = groupSkuMastersByProduct(skuMasters)
    .filter((group) => existingProductFamilyKeys.has(group.familyKey))
    .map((group) => ({
      familyKey: group.familyKey,
      productName: group.productName,
      skus: skuMasters.filter((sku) => group.skuIds.includes(sku.id)),
    }));
  const inboundPeriods = (data.monthlyInboundSnapshots ?? []).map((snapshot) => snapshot.period).filter(Boolean);
  const decisionPeriod = inboundPeriods.sort().at(-1) ?? new Date().toISOString().slice(0, 7);
  const supplierDecisionRows = buildSupplierDecisionOverviewRows(
    decisionGroups,
    data.monthlyInboundSnapshots ?? [],
    decisionPeriod,
  );

  function pin(id: string) {
    togglePinned("suppliers", id);
    setVersion((c) => c + 1);
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
    setDuplicatePairs(findDuplicateSuppliers());
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-action border-t-transparent" />
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <EmptyState
        title="还没有供应商"
        description="从一次沟通整理开始建立供应商档案。"
        actionHref="/intake"
        actionLabel="快速录入"
      />
    );
  }

  return (
    <div className="space-y-6" data-version={version}>
      {/* 页头：周期切换 + 操作按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-0 border-b border-line">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
                period === p ? "text-ink" : "text-muted hover:text-ink"
              }`}
              onClick={() => setPeriod(p)}
              type="button"
            >
              {PERIOD_LABELS[p]}
              {period === p ? (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-action" />
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:text-ink hover:border-action/30 transition-colors"
            onClick={checkDuplicates}
            type="button"
          >
            <AlertTriangle className="h-4 w-4" />
            检测重复
          </button>
          <Link
            className="inline-flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90 transition-colors"
            href="/intake"
          >
            <Plus className="h-4 w-4" />
            新增供应商
          </Link>
        </div>
      </div>

      {/* KPI 仪表盘 - 扁平无卡片 */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">供应商事实与评分参考 · {periodLabel(period)}</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 py-2">
          <KpiFlat
            label="供应商总数"
            value={kpi.total}
            sub={`活跃 ${kpi.active} · 备用 ${kpi.backup}`}
            accent="text-ink"
          />
          <KpiFlat
            label="A级供应商"
            value={kpi.gradeA}
            sub={`占比 ${kpi.gradeAPct}%`}
            accent="text-success"
          />
          <KpiFlat
            label="平均综合得分"
            value={kpi.avgScore}
            sub={period === "quarter" ? "本季度" : period === "month" ? "本月" : "本年"}
            accent="text-action"
          />
          <KpiFlat
            label="待改善（C/D级）"
            value={kpi.needsAction}
            sub={kpi.gradeD > 0 ? `D级 ${kpi.gradeD} · 需启动汰换` : "暂无D级"}
            accent={kpi.needsAction > 0 ? "text-danger" : "text-success"}
          />
        </div>
      </section>

      {supplierDecisionRows.length > 0 ? (
        <section className="space-y-3 border-y border-line py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">供应商决策总览 · {decisionPeriod}</h2>
              <p className="mt-1 text-xs text-muted">只显示有实际入仓证据的供应商；评分仅作参考，不作为单独结论。</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <DecisionPill label="保持主供" value={supplierDecisionRows.filter((row) => row.decision === "maintain_primary").length} tone="success" />
              <DecisionPill label="复核分拆" value={supplierDecisionRows.filter((row) => row.decision === "review_split").length} tone="warning" />
              <DecisionPill label="待确认供应商" value={supplierDecisionRows.filter((row) => row.decision === "confirm_supplier").length} tone="danger" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2 pr-4 text-left font-medium">供应商</th>
                  <th className="px-4 py-2 text-left font-medium">实际供货产品</th>
                  <th className="px-4 py-2 text-center font-medium">SKU覆盖</th>
                  <th className="px-4 py-2 text-right font-medium">本月实际入仓</th>
                  <th className="px-4 py-2 text-left font-medium">证据</th>
                  <th className="py-2 pl-4 text-left font-medium">下一步</th>
                </tr>
              </thead>
              <tbody>
                {supplierDecisionRows.map((row) => (
                  <tr key={`${row.supplierId ?? "unknown"}-${row.supplierName}`} className="border-b border-line-soft">
                    <td className="py-3 pr-4 font-medium">
                      {row.supplierId ? <Link className="hover:text-action" href={`/suppliers/${row.supplierId}`}>{row.supplierName}</Link> : row.supplierName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.productNames.join("、")}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.coveredSkuCount}/{row.totalSkuCount}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.receivedQuantity || "-"}</td>
                    <td className="px-4 py-3 text-xs text-muted">{row.evidence}</td>
                    <td className="py-3 pl-4">
                      <Link className={row.decision === "maintain_primary" ? "text-success hover:underline" : "text-warning hover:underline"} href={row.supplierId ? `/suppliers/${row.supplierId}` : "/sku-master/import"} title="评分不是此动作的唯一依据">
                        {row.actionLabel}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* 筛选栏 - 扁平 */}
      <div className="flex flex-wrap items-center gap-3 border-y border-line py-3">
        <input
          className="flex-1 min-w-[200px] border-0 border-b border-line bg-transparent px-1 py-1.5 text-sm outline-none focus:border-action"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索供应商、品类、地区、风险..."
          value={query}
        />
        <button
          className={`text-sm transition-colors ${
            pinnedOnly ? "text-action font-medium" : "text-muted hover:text-ink"
          }`}
          onClick={() => setPinnedOnly((v) => !v)}
          type="button"
        >
          {pinnedOnly ? "✓ 置顶" : "置顶"}
        </button>
      </div>

      {/* 品类 + 等级 + 合作模式筛选 - 下拉选择 */}
      <div className="flex flex-wrap items-center gap-3 border-y border-line py-3">
        <select
          className="border border-line px-3 py-1.5 text-sm bg-white min-w-[160px]"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">全部分类</option>
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          className="border border-line px-3 py-1.5 text-sm bg-white min-w-[120px]"
          value={selectedGrade}
          onChange={(e) => setSelectedGrade(e.target.value)}
        >
          <option value="">全部等级</option>
          <option value="A">A级</option>
          <option value="B">B级</option>
          <option value="C">C级</option>
          <option value="D">D级</option>
        </select>
        <select
          className="border border-line px-3 py-1.5 text-sm bg-white min-w-[120px]"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          <option value="">全部模式</option>
          <option value="inbound">入仓型</option>
          <option value="dropship">代发型</option>
          <option value="hybrid">综合型</option>
        </select>
        {selectedCategory && (
          <button
            className="text-xs text-muted hover:text-danger"
            onClick={() => setSelectedCategory("")}
            type="button"
          >
            清除分类 ×
          </button>
        )}
        {selectedGrade && (
          <button
            className="text-xs text-muted hover:text-danger"
            onClick={() => setSelectedGrade("")}
            type="button"
          >
            清除等级 ×
          </button>
        )}
        {selectedModel && (
          <button
            className="text-xs text-muted hover:text-danger"
            onClick={() => setSelectedModel("")}
            type="button"
          >
            清除模式 ×
          </button>
        )}
      </div>

      {/* 重复检测面板 */}
      {showDuplicates && (
        <section className="border border-warning/20 bg-warning-soft/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-warning" />
              <h2 className="font-semibold text-sm">
                {duplicatePairs.length > 0
                  ? `发现 ${duplicatePairs.length} 组可能重复的供应商`
                  : mergedMsg ? "合并完成" : "未发现重复供应商"}
              </h2>
            </div>
            <button className="px-2 py-1 text-xs text-muted hover:text-ink" onClick={() => { setShowDuplicates(false); setMergedMsg(null); }} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>
          {duplicatePairs.length > 0 ? (
            <div className="space-y-2">
              {duplicatePairs.map((pair) => {
                const pairKey = [pair.target.id, pair.source.id].sort().join("|");
                const isMerging = merging === pairKey;
                const isMerged = mergedMsg?.pair === pairKey;
                return (
                  <div key={pairKey} className={`flex flex-wrap items-center gap-3 border px-4 py-3 ${isMerged ? "border-success/30 bg-success-soft/20" : "border-line bg-white"}`}>
                    {isMerged ? (
                      <span className="text-sm text-success font-medium flex items-center gap-1">
                        <Check className="h-4 w-4" />{mergedMsg!.text}
                      </span>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-medium text-sm truncate">{pair.target.name}</span>
                          <span className="text-xs text-muted shrink-0">{join(pair.target.categories) || "未分类"}</span>
                          <ArrowRightLeft className="h-3.5 w-3.5 text-muted shrink-0" />
                          <span className="font-medium text-sm truncate">{pair.source.name}</span>
                          <span className="text-xs text-warning shrink-0 px-1.5 py-0.5">{pair.reason}</span>
                        </div>
                        <button
                          className="shrink-0 rounded-lg bg-action px-3 py-1.5 text-xs font-medium text-white hover:bg-action/90 disabled:opacity-50"
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
          ) : null}
        </section>
      )}

      {/* 供应商大表格 - 去卡片化 */}
      <section>
        <div className="mb-2 text-xs text-muted">
                  评分仅作参考 · {modelLabel}：交付{Math.round(dw.delivery * 100)}% / 成本{Math.round(dw.cost * 100)}% / 质量{Math.round(dw.quality * 100)}% / 服务{Math.round(dw.service * 100)}%
          {!selectedModel ? "（筛选特定模式可查看对应权重）" : ""}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-3 pr-4 text-left font-medium">供应商</th>
                <th className="py-3 px-4 text-left font-medium">品类</th>
                <th className="py-3 px-4 text-center font-medium">评分参考</th>
                <th className="py-3 px-4 text-center font-medium">等级</th>
                <th className="py-3 px-4 text-center font-medium">交付<div className="text-[9px] text-muted-light">{Math.round(dw.delivery * 100)}%</div></th>
                <th className="py-3 px-4 text-center font-medium">成本<div className="text-[9px] text-muted-light">{Math.round(dw.cost * 100)}%</div></th>
                <th className="py-3 px-4 text-center font-medium">质量<div className="text-[9px] text-muted-light">{Math.round(dw.quality * 100)}%</div></th>
                <th className="py-3 px-4 text-center font-medium">服务<div className="text-[9px] text-muted-light">{Math.round(dw.service * 100)}%</div></th>
                <th className="py-3 px-4 text-left font-medium">风险标签</th>
                <th className="py-3 pl-4 text-center font-medium">最近评估</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((supplier) => {
                const evals = supplier.evaluations ?? [];
                const latest = evals.length > 0 ? evals[evals.length - 1] : undefined;
                const scores = latest?.scores;
                return (
                  <tr key={supplier.id} className="border-b border-line-soft hover:bg-paper-warm/50 transition-colors group">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-muted-light hover:text-action shrink-0"
                          onClick={() => pin(supplier.id)}
                          title={supplier.pinned ? "取消置顶" : "置顶"}
                          type="button"
                        >
                          {supplier.pinned ? "📌" : ""}
                        </button>
                        <Link className="font-medium hover:text-action truncate" href={`/suppliers/${supplier.id}`}>
                          {supplier.name}
                        </Link>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {labelSupplierType(supplier.supplierType)}
                        {supplier.location ? ` · ${supplier.location}` : ""}
                        {" · "}
                        <span className="text-muted-light">
                          {(supplier.businessModel ?? "inbound") === "dropship"
                            ? "代发型"
                            : (supplier.businessModel ?? "inbound") === "hybrid"
                              ? "综合型"
                              : "入仓型"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{join(supplier.categories) || "—"}</td>
                    <td className="py-3 px-4 text-center">
                      {scores ? (
                        <span className="text-base font-bold">{Math.round(scores.total)}</span>
                      ) : (
                        <span className="text-muted-light">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {scores ? (
                        <GradePill grade={scores.grade} />
                      ) : (
                        <span className="text-muted-light text-xs">未评估</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">{scores ? <MiniScore value={scores.delivery} /> : "—"}</td>
                    <td className="py-3 px-4 text-center">{scores ? <MiniScore value={scores.cost} /> : "—"}</td>
                    <td className="py-3 px-4 text-center">{scores ? <MiniScore value={scores.quality} /> : "—"}</td>
                    <td className="py-3 px-4 text-center">{scores ? <MiniScore value={scores.service} /> : "—"}</td>
                    <td className="py-3 px-4">
                      {latest && latest.riskLabels.length > 0 && latest.riskLabels[0] !== "无风险" ? (
                        <div className="flex flex-wrap gap-1">
                          {latest.riskLabels.slice(0, 3).map((label, i) => (
                            <span key={i} className="text-[10px] text-danger">{label}</span>
                          ))}
                          {latest.riskLabels.length > 3 ? (
                            <span className="text-[10px] text-muted">+{latest.riskLabels.length - 3}</span>
                          ) : null}
                        </div>
                      ) : latest ? (
                        <span className="text-[10px] text-success">无风险</span>
                      ) : (
                        <span className="text-[10px] text-muted-light">—</span>
                      )}
                    </td>
                    <td className="py-3 pl-4 text-center text-xs text-muted">
                      {latest ? new Date(latest.evaluatedAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">没有匹配的供应商</div>
        ) : null}
      </section>
    </div>
  );
}

// ===== 子组件 =====

const PERIOD_LABELS: Record<Period, string> = {
  month: "月度",
  quarter: "季度",
  year: "年度",
};

function periodLabel(p: Period) {
  const now = new Date();
  if (p === "month") return `${now.getFullYear()}年${now.getMonth() + 1}月`;
  if (p === "quarter") return `${now.getFullYear()} Q${Math.floor(now.getMonth() / 3) + 1}`;
  return `${now.getFullYear()}年`;
}

// 扁平KPI：大字 + 两排小字，无边框无阴影
function KpiFlat({ label, value, sub, accent }: {
  label: string; value: number | string; sub: string; accent: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${accent}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </div>
  );
}

function GradePill({ grade }: { grade: SupplierGrade }) {
  const colorMap: Record<string, string> = {
    A: "bg-success text-white",
    B: "bg-action text-white",
    C: "bg-warning text-white",
    D: "bg-danger text-white",
  };
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center text-sm font-bold ${colorMap[grade]}`}>
      {grade}
    </span>
  );
}

function MiniScore({ value }: { value: number }) {
  const v = Math.round(value);
  const color = v >= 85 ? "text-success" : v >= 70 ? "text-action" : v >= 60 ? "text-warning" : "text-danger";
  return <span className={`font-medium ${color}`}>{v}</span>;
}

function DecisionPill({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" }) {
  const colors = { success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger" };
  return <span className={`rounded-full px-2 py-1 ${colors[tone]}`}>{label} {value}</span>;
}

function join(values?: string[]) {
  return Array.isArray(values) ? values.join(" / ") : "";
}
