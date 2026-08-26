"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import {
  findDuplicateSuppliers,
  mergeSuppliers,
  sortPinnedFirst,
  togglePinned,
} from "@/features/workbench/local-store";
import { buildSupplierAutoEvidence, getSupplierKpiSummary, getQcdsWeights, type SupplierEvaluationRecord, type SupplierGrade, type SupplierBusinessModel } from "@/features/workbench/supplier-evaluation";
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
type DecisionFilter = "all" | "maintain_primary" | "review_split" | "confirm_supplier" | "review_quality";
const SUPPLIER_PAGE_SIZE = 10;

export default function SuppliersPage() {
  const [period, setPeriod] = useState<Period>("quarter");
  const [version, setVersion] = useState(0);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicatePairs, setDuplicatePairs] = useState<ReturnType<typeof findDuplicateSuppliers>>([]);
  const [merging, setMerging] = useState<string | null>(null);
  const [mergedMsg, setMergedMsg] = useState<{ pair: string; text: string } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [supplierPage, setSupplierPage] = useState(1);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    setSupplierPage(1);
    setDecisionFilter("all");
  }, [period]);

  const workbenchData = useWorkbenchData();
  const data = workbenchData ?? {
    suppliers: [], communications: [], offers: [], products: [],
    tasks: [], knowledgeCards: [], knowledgeBooks: [], decisionTools: [],
    knowledgeApplications: [], decisionCases: [], skuMasters: [], monthlyInboundSnapshots: [],
  };

  const suppliers = hydrated ? sortPinnedFirst(data.suppliers) : [];
  // 兼容历史入仓记录：旧数据可能只有供应商名称，没有 supplierId。
  // 只在名称唯一匹配供应商主档时回填，避免把同名供应商错误合并。
  const supplierIdByName = new Map<string, string>();
  const duplicateSupplierNames = new Set<string>();
  for (const supplier of suppliers) {
    const key = supplier.name.trim().toLowerCase();
    if (!key) continue;
    if (supplierIdByName.has(key)) duplicateSupplierNames.add(key);
    else supplierIdByName.set(key, supplier.id);
  }
  for (const key of duplicateSupplierNames) supplierIdByName.delete(key);
  const inboundPeriods = (data.monthlyInboundSnapshots ?? []).map((snapshot) => snapshot.period).filter(Boolean).sort();
  const decisionAnchor = inboundPeriods.at(-1) ?? new Date().toISOString().slice(0, 7);
  const decisionSnapshots = (data.monthlyInboundSnapshots ?? [])
    .filter((snapshot) => isInPeriod(snapshot.period, period, decisionAnchor))
    .map((snapshot) => ({
      ...snapshot,
      supplierId: snapshot.supplierId ?? (snapshot.supplierName ? supplierIdByName.get(snapshot.supplierName.trim().toLowerCase()) : undefined),
      period: "selected",
    }));
  const decisionOperatingSnapshots = (data.skuOperatingSnapshots ?? [])
    .filter((snapshot) => isInPeriod(snapshot.period, period, decisionAnchor))
    .map((snapshot) => ({ ...snapshot, period: "selected" }));
  const autoEvidenceBySupplier = new Map(
    suppliers.map((supplier) => [supplier.id, buildSupplierAutoEvidence({
      supplierId: supplier.id,
      period: decisionAnchor,
      periodType: period,
      inboundSnapshots: data.monthlyInboundSnapshots ?? [],
      operatingSnapshots: data.skuOperatingSnapshots ?? [],
    })]),
  );
  const autoQualityScores = [...autoEvidenceBySupplier.values()]
    .map((evidence) => evidence.qualityScore)
    .filter((score): score is number => score !== undefined);
  const autoQualityAverage = autoQualityScores.length > 0
    ? Number((autoQualityScores.reduce((sum, score) => sum + score, 0) / autoQualityScores.length).toFixed(1))
    : "—";
  const periodSuppliers = suppliers.map((supplier) => {
    const selectedEvaluation = getSelectedEvaluation(supplier.evaluations, period, decisionAnchor);
    return {
      ...supplier,
      latestEvaluationGrade: selectedEvaluation?.scores.grade,
      latestEvaluationScore: selectedEvaluation?.scores.total,
    };
  });
  const kpi = getSupplierKpiSummary(periodSuppliers);
  const supplierPageCount = Math.max(1, Math.ceil(suppliers.length / SUPPLIER_PAGE_SIZE));
  const activeSupplierPage = Math.min(supplierPage, supplierPageCount);
  const paginatedSuppliers = suppliers.slice(
    (activeSupplierPage - 1) * SUPPLIER_PAGE_SIZE,
    activeSupplierPage * SUPPLIER_PAGE_SIZE,
  );

  // 表头权重：筛选了具体模式时显示对应权重，否则用入仓型默认
  const displayModel: SupplierBusinessModel = "inbound";
  const dw = getQcdsWeights(displayModel);
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
  const supplierDecisionRows = buildSupplierDecisionOverviewRows(
    decisionGroups,
    decisionSnapshots,
    "selected",
    decisionOperatingSnapshots,
    5,
    decisionAnchor,
    data.productSupplierAssignments ?? [],
  );
  const focusedDecisionRows = decisionFilter === "all"
    ? supplierDecisionRows
    : supplierDecisionRows.filter((row) => row.decision === decisionFilter);
  const decisionDataStatus = getDecisionDataStatus({
    supplierCount: suppliers.length,
    skuCount: skuMasters.length,
    inboundCount: decisionSnapshots.length,
    existingProductCount: existingProductFamilyKeys.size,
    decisionRowCount: supplierDecisionRows.length,
  });

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

      {(
        <section className="space-y-3 rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">供应商决策总览 · {periodLabel(period, decisionAnchor)}</h2>
              <p className="mt-1 text-xs text-muted">只显示有实际入仓证据的供应商；评分仅作参考，不作为单独结论。</p>
            </div>
            {supplierDecisionRows.length > 0 ? <div className="flex flex-wrap gap-2 text-xs">
              <DecisionPill active={decisionFilter === "all"} label="全部动作" value={supplierDecisionRows.length} tone="neutral" onClick={() => setDecisionFilter("all")} />
              <DecisionPill active={decisionFilter === "maintain_primary"} label="保持主供" value={supplierDecisionRows.filter((row) => row.decision === "maintain_primary").length} tone="success" onClick={() => setDecisionFilter("maintain_primary")} />
              <DecisionPill active={decisionFilter === "review_split"} label="复核分拆" value={supplierDecisionRows.filter((row) => row.decision === "review_split").length} tone="warning" onClick={() => setDecisionFilter("review_split")} />
              <DecisionPill active={decisionFilter === "confirm_supplier"} label="待确认供应商" value={supplierDecisionRows.filter((row) => row.decision === "confirm_supplier").length} tone="danger" onClick={() => setDecisionFilter("confirm_supplier")} />
              <DecisionPill active={decisionFilter === "review_quality"} label="复核质量信号" value={supplierDecisionRows.filter((row) => row.decision === "review_quality").length} tone="warning" onClick={() => setDecisionFilter("review_quality")} />
            </div> : null}
          </div>
          {supplierDecisionRows.length === 0 ? (
            <div className="rounded-lg border border-warning/30 bg-warning-soft/20 px-4 py-4 text-sm">
              <div className="font-medium text-ink">当前周期暂未生成供应商决策</div>
              <p className="mt-1 text-xs leading-5 text-muted">{decisionDataStatus.message}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <span>已读取供应商 {suppliers.length} 家</span>
                <span>产品编码 {skuMasters.length} 个</span>
                <span>入仓记录 {decisionSnapshots.length} 条</span>
                <Link className="text-action hover:underline" href="/product-master">去入仓产品查看数据来源</Link>
              </div>
            </div>
          ) : null}
          {decisionFilter !== "all" && supplierDecisionRows.length > 0 ? (
            <div className="rounded-lg bg-paper-warm px-3 py-2 text-xs text-muted">
              当前显示：{decisionFilterLabel(decisionFilter)} · 共 {focusedDecisionRows.length} 项。点击供应商或“下一步”进入处理页面。
            </div>
          ) : null}
          {supplierDecisionRows.length > 0 ? <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2 pr-4 text-left font-medium">供应商</th>
                  <th className="px-4 py-2 text-left font-medium">实际供货产品</th>
                  <th className="px-4 py-2 text-center font-medium">实际供货 SKU</th>
                  <th className="px-4 py-2 text-right font-medium">{periodMetricLabel(period)}实际入仓</th>
                  <th className="px-4 py-2 text-center font-medium">产品退货信号</th>
                  <th className="px-4 py-2 text-left font-medium">证据</th>
                  <th className="py-2 pl-4 text-left font-medium">下一步</th>
                </tr>
              </thead>
              <tbody>
                {focusedDecisionRows.map((row) => (
                  <tr key={`${row.supplierId ?? "unknown"}-${row.supplierName}`} className="border-b border-line-soft">
                    <td className="py-3 pr-4 font-medium">
                      {row.supplierId ? <Link className="hover:text-action" href={`/suppliers/${row.supplierId}`}>{row.supplierName}</Link> : row.supplierName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.productNames.join("、")}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.coveredSkuCount}/{row.totalSkuCount}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.receivedQuantity || "-"}</td>
                    <td className={`px-4 py-3 text-center ${row.returnRate !== undefined && row.returnRate >= 5 ? "text-danger" : "text-muted"}`}>
                      {row.returnRate !== undefined ? `${row.returnRate}%` : "未采集"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{row.evidence}</td>
                    <td className="py-3 pl-4">
                      <Link className={row.decision === "maintain_primary" ? "text-success hover:underline" : "text-warning hover:underline"} href={row.supplierId ? `/suppliers/${row.supplierId}` : "/sku-master/import"} title="评分不是此动作的唯一依据；供应关系需要明确维护">
                        {row.decision === "confirm_supplier" ? "维护供应关系" : row.actionLabel}
                      </Link>
                    </td>
                  </tr>
                ))}
                {focusedDecisionRows.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-xs text-muted" colSpan={7}>当前周期没有需要处理的项目。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div> : null}
        </section>
      )}

      {/* 评分总览与明细 */}
      <section className="space-y-4 rounded-xl border border-line bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold">供应商评分总览 · {periodLabel(period, decisionAnchor)}</h2>
          <p className="mt-1 text-xs text-muted">仅统计当前周期有评估记录的供应商；无对应记录时不跨周期补值。</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <KpiFlat label="周期内供应商" value={kpi.total} sub={`主供 ${kpi.active} · 备用 ${kpi.backup}`} accent="text-ink" />
          <KpiFlat label="A级供应商" value={kpi.gradeA} sub={`占比 ${kpi.gradeAPct}%`} accent="text-success" />
          <KpiFlat label="聚水潭质量参考" value={autoQualityAverage} sub="实退数量 ÷ 实发数量" accent="text-action" />
          <KpiFlat label="待改善（C/D级）" value={kpi.needsAction} sub={kpi.gradeD > 0 ? `D级 ${kpi.gradeD} · 需启动汰换` : "暂无D级"} accent={kpi.needsAction > 0 ? "text-danger" : "text-success"} />
        </div>
      </section>

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

       {/* 供应商评分明细 */}
       <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-2 text-xs text-muted">
           聚水潭自动证据 · 退货率 = 实退数量 ÷ 实发数量 · 自动质量参考 = 100 - 退货率；交付、服务等无来源数据不补分
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-3 pr-4 text-left font-medium">供应商</th>
                <th className="py-3 px-4 text-left font-medium">品类</th>
                <th className="py-3 px-4 text-center font-medium">评分参考</th>
                <th className="py-3 px-4 text-center font-medium">聚水潭自动证据</th>
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
              {paginatedSuppliers.map((supplier) => {
                const selectedEvaluation = getSelectedEvaluation(supplier.evaluations, period, decisionAnchor);
                const scores = selectedEvaluation?.scores;
                const autoEvidence = autoEvidenceBySupplier.get(supplier.id);
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
                    <td className="py-3 px-4 text-center text-xs">
                      {autoEvidence?.qualityScore !== undefined ? (
                        <div>
                          <div className="font-medium text-action">{Math.round(autoEvidence.qualityScore)}分</div>
                          <div className="text-muted">退货 {autoEvidence.returnRate}% · 覆盖 {autoEvidence.dataCoveragePct}%</div>
                        </div>
                      ) : (
                        <span className="text-muted-light">未采集</span>
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
                       {selectedEvaluation && selectedEvaluation.riskLabels.length > 0 && selectedEvaluation.riskLabels[0] !== "无风险" ? (
                         <div className="flex flex-wrap gap-1">
                           {selectedEvaluation.riskLabels.slice(0, 3).map((label, i) => (
                             <span key={i} className="text-[10px] text-danger">{label}</span>
                           ))}
                           {selectedEvaluation.riskLabels.length > 3 ? (
                             <span className="text-[10px] text-muted">+{selectedEvaluation.riskLabels.length - 3}</span>
                           ) : null}
                         </div>
                       ) : selectedEvaluation ? (
                         <span className="text-[10px] text-success">无风险</span>
                      ) : (
                        <span className="text-[10px] text-muted-light">—</span>
                      )}
                    </td>
                    <td className="py-3 pl-4 text-center text-xs text-muted">
                       {selectedEvaluation ? new Date(selectedEvaluation.evaluatedAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          {suppliers.length > 0 && supplierPageCount > 1 ? (
           <div className="flex items-center justify-between border-t border-line py-3 text-xs text-muted">
              <span>第 {activeSupplierPage} / {supplierPageCount} 页 · 共 {suppliers.length} 家供应商</span>
             <div className="flex items-center gap-2">
               <button
                 className="border border-line px-3 py-1.5 hover:border-action disabled:cursor-not-allowed disabled:opacity-40"
                 disabled={activeSupplierPage === 1}
                 onClick={() => setSupplierPage((page) => Math.max(1, page - 1))}
                 type="button"
               >
                 上一页
               </button>
               <button
                 className="border border-line px-3 py-1.5 hover:border-action disabled:cursor-not-allowed disabled:opacity-40"
                 disabled={activeSupplierPage === supplierPageCount}
                 onClick={() => setSupplierPage((page) => Math.min(supplierPageCount, page + 1))}
                 type="button"
               >
                 下一页
               </button>
             </div>
           </div>
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

function periodLabel(p: Period, anchor: string) {
  const [year, month] = anchor.split("-").map(Number);
  if (p === "month") return `${year}年${month}月`;
  if (p === "quarter") return `${year} Q${Math.ceil(month / 3)}`;
  return `${year}年`;
}

function periodMetricLabel(p: Period) {
  return p === "month" ? "本月" : p === "quarter" ? "本季度" : "本年度";
}

function getDecisionDataStatus(input: {
  supplierCount: number;
  skuCount: number;
  inboundCount: number;
  existingProductCount: number;
  decisionRowCount: number;
}) {
  if (input.skuCount === 0) {
    return { message: "还没有产品编码主表，供应商决策需要先知道产品和 SKU 范围。" };
  }
  if (input.inboundCount === 0) {
    return { message: "当前周期没有入仓记录；请在入仓产品页面选择对应月份查看，页面不会用供应商评分代替实际供货证据。" };
  }
  if (input.existingProductCount === 0) {
    return { message: "已有入仓记录，但还没有把产品归类为入仓产品，因此暂时不能生成供应商决策。" };
  }
  if (input.decisionRowCount === 0) {
    return { message: "已有基础数据，但产品族、SKU 和入仓记录尚未匹配到同一周期，暂不生成结论。" };
  }
  return { message: "当前周期没有可生成的供应商决策。" };
}

function isInPeriod(value: string, type: Period, anchor: string) {
  const [anchorYear, anchorMonth] = anchor.split("-").map(Number);
  if (type === "month") return value === anchor;
  if (value.startsWith(`${anchorYear}-Q`)) return value === `${anchorYear}-Q${Math.ceil(anchorMonth / 3)}`;
  const [year, month] = value.split("-").map(Number);
  if (type === "year") return year === anchorYear;
  return year === anchorYear && Math.ceil(month / 3) === Math.ceil(anchorMonth / 3);
}

function getSelectedEvaluation(evaluations: SupplierEvaluationRecord[] | undefined, period: Period, anchor: string) {
  return [...(evaluations ?? [])]
    .filter((evaluation) => evaluation.periodType === period && isInPeriod(evaluation.period, period, anchor))
    .sort((left, right) => `${left.period}-${left.evaluatedAt}`.localeCompare(`${right.period}-${right.evaluatedAt}`))
    .at(-1);
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

function DecisionPill({ label, value, tone, active, onClick }: { label: string; value: number; tone: "neutral" | "success" | "warning" | "danger"; active: boolean; onClick: () => void }) {
  const colors = { neutral: "bg-paper-warm text-muted", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger" };
  return (
    <button
      className={`rounded-full px-2.5 py-1 transition ${colors[tone]} ${active ? "ring-1 ring-action/50" : "opacity-70 hover:opacity-100"}`}
      onClick={onClick}
      type="button"
    >
      {label} {value}
    </button>
  );
}

function decisionFilterLabel(filter: Exclude<DecisionFilter, "all">) {
  if (filter === "maintain_primary") return "保持主供";
  if (filter === "review_split") return "复核分拆";
  if (filter === "review_quality") return "复核质量信号";
  return "待确认供应商";
}

function join(values?: string[]) {
  return Array.isArray(values) ? values.join(" / ") : "";
}
