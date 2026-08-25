"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import * as XLSX from "xlsx";
import { unzipSync } from "fflate";
import { EmptyState } from "@/components/empty-state";
import {
  createInboundProductsFromSkuMasters,
  saveMonthlyInboundSnapshots,
  saveSkuOperatingSnapshots,
  type LocalSkuOperatingSnapshot,
} from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import { buildSupplyPlan } from "@/features/workbench/supply-decision";
import {
  aggregateSkuMetrics,
  aggregateSkuSnapshots,
  buildProductInboundSummary,
  buildProductInboundSupplierSummary,
  buildProductSupplierDecisionRows,
  groupSkuMastersByProduct,
  deriveProductFamilyKey,
  type SkuMetricInput,
} from "@/features/workbench/product-master";
import {
  formatJushuitanImportError,
  parseJushuitanSalesRows,
  type JushuitanSalesImportResult,
} from "@/features/workbench/jushuitan-sales-import";
import {
  formatSupplierInboundImportError,
  parseSupplierInboundRows,
  type SupplierInboundImportResult,
} from "@/features/workbench/supplier-inbound-import";
import {
  SupplierInboundImportPreview,
  type ConfirmedInboundRow,
} from "@/components/workbench/supplier-inbound-import-preview";
import { SkuCompositionPanel } from "@/components/workbench/sku-composition-panel";
import { getProductFamilyAttention } from "@/features/workbench/product-master-presentation";

export default function ProductMasterPage() {
  const data = useWorkbenchData();
  const [message, setMessage] = useState("");
  const [expandedFamilies, setExpandedFamilies] = useState<
    Record<string, boolean>
  >({});
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const [draftMetrics, setDraftMetrics] = useState<
    Record<string, SkuMetricInput>
  >({});
  const [salesPreview, setSalesPreview] =
    useState<JushuitanSalesImportResult | null>(null);
  const [salesFileMeta, setSalesFileMeta] = useState<{
    fileName: string;
    sheetName: string;
  } | null>(null);
  const [salesImportError, setSalesImportError] = useState("");
  const [inboundPreview, setInboundPreview] = useState<SupplierInboundImportResult | null>(null);
  const [inboundFileMeta, setInboundFileMeta] = useState<{ fileName: string; sheetName: string } | null>(null);
  const [inboundImportError, setInboundImportError] = useState("");
  const skus = (data.skuMasters ?? []).filter(
    (sku) => sku.status !== "archived",
  );
  const snapshots = data.skuOperatingSnapshots ?? [];
  const productGroups = groupSkuMastersByProduct(skus);
  const inboundGroups = productGroups.filter((group) =>
    data.products.some(
      (product) =>
        product.recordKind === "existing" &&
        product.productMode !== "dropship" &&
        (product.productFamilyKey === group.familyKey ||
          deriveProductFamilyKey(product.name) === group.familyKey),
    ),
  );
  const periodInboundSnapshots = (data.monthlyInboundSnapshots ?? []).filter(
    (snapshot) => snapshot.period === selectedPeriod,
  );
  const decisionRows = buildProductSupplierDecisionRows(
    inboundGroups.filter((group) =>
      periodInboundSnapshots.some((snapshot) => group.skuIds.includes(snapshot.skuMasterId)),
    ).map((group) => ({
      familyKey: group.familyKey,
      productName: group.productName,
      skus: skus.filter((sku) => group.skuIds.includes(sku.id)),
    })),
    periodInboundSnapshots,
    snapshots,
    selectedPeriod,
  );
  const previousPeriod = getPreviousPeriod(selectedPeriod);

  function snapshotFor(
    skuId: string,
    period: string,
  ): LocalSkuOperatingSnapshot | undefined {
    return snapshots.find(
      (snapshot) =>
        snapshot.skuMasterId === skuId && snapshot.period === period,
    );
  }

  function metricsFor(
    sku: (typeof skus)[number],
    period: string,
  ): SkuMetricInput {
    const snapshot = snapshotFor(sku.id, period);
    if (snapshot) return pickMetricFields(snapshot);
    if (
      period === currentPeriod &&
      snapshots.every((item) => item.skuMasterId !== sku.id)
    ) {
      return pickMetricFields(sku);
    }
    return {};
  }

  function draftFor(sku: (typeof skus)[number]): SkuMetricInput {
    return draftMetrics[sku.id] ?? metricsFor(sku, selectedPeriod);
  }

  function updateDraft(
    skuId: string,
    key: keyof SkuMetricInput,
    value?: number,
  ) {
    setDraftMetrics((current) => ({
      ...current,
      [skuId]: { ...current[skuId], [key]: value },
    }));
  }

  function saveSelectedPeriod() {
    const entries = skus.map((sku) => {
      const draft = draftFor(sku);
      return {
        skuMasterId: sku.id,
        period: selectedPeriod,
        metrics: pickMetricFields(draft),
      };
    });
    saveSkuOperatingSnapshots(entries);
    setDraftMetrics({});
    setMessage(
      `已保存 ${selectedPeriod}：${entries.length} 个 SKU 的月度经营快照，历史月份不会被覆盖。`,
    );
  }

  function generateProducts() {
    const result = createInboundProductsFromSkuMasters();
    setMessage(
      `已生成/更新 ${result.createdProductIds.length} 个入仓产品，关联 ${result.linkedSkuCount} 条 SKU。`,
    );
  }

  async function handleSalesFile(file: File | undefined) {
    if (!file) return;
    setSalesImportError("");
    try {
      const { rows, sheetName } = await readJushuitanWorkbook(file);
      setSalesPreview(
        parseJushuitanSalesRows(rows, {
          fileName: file.name,
          sheetName,
          importedAt: new Date().toISOString(),
        }),
      );
      setSalesFileMeta({ fileName: file.name, sheetName });
    } catch (cause) {
      setSalesPreview(null);
      setSalesFileMeta(null);
      setSalesImportError(formatJushuitanImportError(cause));
    }
  }

  async function handleInboundFile(file: File | undefined) {
    if (!file) return;
    setInboundImportError("");
    try {
      const { rows, sheetName } = await readJushuitanWorkbook(file);
      setInboundPreview(parseSupplierInboundRows(rows, { fileName: file.name, sheetName, importedAt: new Date().toISOString() }));
      setInboundFileMeta({ fileName: file.name, sheetName });
    } catch (cause) {
      setInboundPreview(null);
      setInboundFileMeta(null);
      setInboundImportError(formatSupplierInboundImportError(cause));
    }
  }

  function saveInboundImport(rows: ConfirmedInboundRow[]) {
    saveMonthlyInboundSnapshots(rows);
    setInboundPreview(null);
    setInboundFileMeta(null);
    setMessage(`已保存 ${selectedPeriod} 实际入仓：${rows.length} 条 SKU 记录；未匹配行未写入。`);
  }

  function saveSalesImport() {
    if (!salesPreview) return;
    const skuByCode = new Map(skus.map((sku) => [sku.internalSkuCode, sku]));
    const entries = salesPreview.rows.flatMap((row) => {
      const sku = skuByCode.get(row.internalSkuCode);
      return sku
        ? [
            {
              skuMasterId: sku.id,
              period: selectedPeriod,
              source: "imported" as const,
              metrics: {
                monthlySales: row.monthlySales,
                salesAmount: row.salesAmount,
                erpCostPrice: row.erpCostPrice,
                shippedQuantity: row.shippedQuantity,
                returnQuantity: row.returnQuantity,
                returnRate: row.returnRate,
              },
            },
          ]
        : [];
    });
    if (entries.length === 0) {
      setSalesImportError(
        "没有匹配到有效的内部 SKU 编码，请先导入并确认产品编码表。",
      );
      return;
    }
    saveSkuOperatingSnapshots(entries);
    const unmatched = salesPreview.rows.length - entries.length;
    setDraftMetrics({});
    setMessage(
      `已导入 ${selectedPeriod}：${entries.length} 个 SKU；${unmatched ? `有 ${unmatched} 个编码未匹配，未写入。` : "全部编码已匹配。"}`,
    );
    setSalesPreview(null);
    setSalesFileMeta(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            入仓产品主表
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            实际经营产品的结构化入口。产品机会仍在“产品进程”中保留研究和阶段信息。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 items-center rounded-md border border-line bg-white px-3 text-sm text-slate-600">
            统计月份
            <input
              aria-label="统计月份"
              className="ml-2 h-7 rounded border border-line px-2 text-sm text-slate-800"
              onChange={(event) => {
                setSelectedPeriod(event.target.value);
                setDraftMetrics({});
              }}
              type="month"
              value={selectedPeriod}
            />
          </label>
          <button
            className="h-10 rounded-md bg-action px-3 text-sm font-medium text-white disabled:opacity-50"
            disabled={skus.length === 0}
            onClick={saveSelectedPeriod}
            type="button"
          >
            保存本月快照
          </button>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line bg-white px-3 text-sm text-slate-700 hover:bg-paper-warm">
            导入聚水潭月度表
            <input
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) =>
                void handleSalesFile(event.target.files?.[0])
              }
              type="file"
            />
          </label>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line bg-white px-3 text-sm text-slate-700 hover:bg-paper-warm">
            导入月度实际入仓表
            <input accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => void handleInboundFile(event.target.files?.[0])} type="file" />
          </label>
          <Link
            className="inline-flex h-10 items-center rounded-md border border-line bg-white px-3 text-sm"
            href="/sku-master/import"
          >
            管理 SKU 表
          </Link>
          <button
            className="h-10 rounded-md bg-action px-3 text-sm font-medium text-white disabled:opacity-50"
            disabled={skus.length === 0}
            onClick={generateProducts}
            type="button"
          >
            从 SKU 表生成入仓产品
          </button>
        </div>
      </div>
      {message ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="入仓产品族" value={inboundGroups.length} />
        <Stat label="已导入 SKU" value={skus.length} />
        <Stat
          label="待关联 SKU"
          value={skus.filter((sku) => !sku.productId).length}
        />
      </div>
      <section className="rounded-xl border border-line bg-paper-warm/40 p-4 text-sm">
        <h2 className="font-medium text-slate-800">数据来源与汇总口径</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <SourceNote
            title="产品表现数据"
            detail="聚水潭月度表导入实发数量、实退数量、退货率和 ERP 成本基准；净销量仅作辅助参考，不做财务利润核算。"
          />
          <SourceNote
            title="供应方案"
            detail="供应商报价、MOQ、交期和规格匹配留在货盘报价页，用于供应商决策。"
          />
          <SourceNote
            title="产品族汇总"
            detail="同一产品族的 SKU 自动汇总销量和退货表现，成本只显示 ERP 成本基准，不展示成本变化。"
          />
        </div>
        <div className="mt-4 border-t border-line pt-4 text-xs text-slate-500">
          使用右上角统计月份导入并保存；只写入能匹配内部编码的 SKU。
        </div>
      </section>
      {decisionRows.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium text-slate-800">产品—供应商决策联动</h2>
              <p className="mt-1 text-xs text-slate-500">
                用聚水潭月度经营数据和实际入仓供应商，生成下一步动作；不替代聚水潭采购、库存和财务功能。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <DecisionCount label="保持主供" value={decisionRows.filter((row) => row.decision === "maintain_primary").length} tone="green" />
              <DecisionCount label="需要复核" value={decisionRows.filter((row) => row.decision === "review_split" || row.decision === "review_quality").length} tone="amber" />
              <DecisionCount label="待补供应商" value={decisionRows.filter((row) => row.decision === "confirm_supplier").length} tone="red" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-paper-warm text-slate-500">
                <tr>
                  <th className="px-3 py-2">产品</th>
                  <th className="px-3 py-2">实际供应商</th>
                  <th className="px-3 py-2">SKU覆盖</th>
                  <th className="px-3 py-2">本月入仓</th>
                  <th className="px-3 py-2">退货率信号</th>
                  <th className="px-3 py-2">建议动作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {decisionRows.map((row) => (
                  <tr key={row.familyKey} className="align-top">
                    <td className="px-3 py-3 font-medium text-slate-800">{row.productName}</td>
                    <td className="px-3 py-3">
                      {row.supplierId ? (
                        <Link className="text-action hover:underline" href={`/suppliers/${row.supplierId}`}>{row.supplierName}</Link>
                      ) : row.supplierName}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{row.coveredSkuCount}/{row.totalSkuCount}</td>
                    <td className="px-3 py-3 text-slate-600">{row.receivedQuantity || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">{row.returnRate !== undefined ? `${row.returnRate}%` : "未采集"}</td>
                    <td className="px-3 py-3">
                      <Link
                        className={`font-medium hover:underline ${row.decision === "maintain_primary" ? "text-emerald-700" : "text-amber-700"}`}
                        href={row.decision === "confirm_supplier" ? "/sku-master/import" : row.supplierId ? `/suppliers/${row.supplierId}` : "/suppliers"}
                        title={row.reason}
                      >
                        {row.actionLabel}
                      </Link>
                      <p className="mt-1 max-w-md text-slate-500">{row.reason}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">当前月份：{selectedPeriod} · 退货率仅作为产品质量复核信号，不在多供应商场景下直接归因。</p>
        </section>
      ) : null}
      {salesImportError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {salesImportError}
        </p>
      ) : null}
      {inboundImportError ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{inboundImportError}</p> : null}
      {inboundPreview && inboundFileMeta ? <SupplierInboundImportPreview result={inboundPreview} period={selectedPeriod} fileName={inboundFileMeta.fileName} sheetName={inboundFileMeta.sheetName} skuMasters={skus} suppliers={data.suppliers} onCancel={() => { setInboundPreview(null); setInboundFileMeta(null); }} onConfirm={saveInboundImport} /> : null}
      {salesPreview && salesFileMeta ? (
        <section className="space-y-3 rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium text-slate-800">聚水潭导入预览</h2>
              <p className="mt-1 text-xs text-slate-500">
                {salesFileMeta.fileName} · {salesFileMeta.sheetName} · 写入月份{" "}
                {selectedPeriod}
              </p>
            </div>
            <div className="text-xs text-slate-600">
              可导入{" "}
              {
                salesPreview.rows.filter((row) =>
                  skus.some(
                    (sku) => sku.internalSkuCode === row.internalSkuCode,
                  ),
                ).length
              }{" "}
              条 · 未匹配{" "}
              {
                salesPreview.rows.filter(
                  (row) =>
                    !skus.some(
                      (sku) => sku.internalSkuCode === row.internalSkuCode,
                    ),
                ).length
              }{" "}
              条
            </div>
          </div>
          {salesPreview.errors.length ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {salesPreview.errors
                .map((item) => `第${item.rowNumber}行：${item.message}`)
                .join("；")}
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-paper-warm text-slate-500">
                <tr>
                  <th className="px-3 py-2">商品编码</th>
                  <th className="px-3 py-2">实发数量</th>
                  <th className="px-3 py-2">实退数量</th>
                  <th className="px-3 py-2">退货率</th>
                  <th className="px-3 py-2">ERP成本价</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {salesPreview.rows.slice(0, 8).map((row) => (
                  <tr key={row.internalSkuCode}>
                    <td className="px-3 py-2 font-medium">
                      {row.internalSkuCode}
                    </td>
                    <td className="px-3 py-2">{row.monthlySales ?? "-"}</td>
                    <td className="px-3 py-2">{row.returnQuantity ?? "-"}</td>
                    <td className="px-3 py-2">
                      {row.returnRate != null ? `${row.returnRate}%` : "-"}
                    </td>
                    <td className="px-3 py-2">{row.erpCostPrice ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="rounded-md border border-line px-3 py-2 text-sm"
              onClick={() => {
                setSalesPreview(null);
                setSalesFileMeta(null);
              }}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-md bg-action px-3 py-2 text-sm font-medium text-white"
              onClick={saveSalesImport}
              type="button"
            >
              确认导入
            </button>
          </div>
        </section>
      ) : null}
      {inboundGroups.length === 0 ? (
        <EmptyState
          title="还没有入仓产品主表"
          description={
            skus.length
              ? "点击右上角按钮，系统会按产品族归并 SKU，并保留原产品机会资料。"
              : "请先导入并确认内部 SKU 表。"
          }
          actionHref="/sku-master/import"
          actionLabel="进入 SKU 导入"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="min-w-[1160px] w-full text-left text-sm">
            <thead className="bg-paper-warm text-xs text-slate-500">
              <tr>
                <th className="w-[220px] px-4 py-3">产品 / SKU</th>
                <th className="px-4 py-3">SKU数</th>
                <th className="px-4 py-3">供应方案</th>
                <th className="px-4 py-3">经营状态</th>
                <th className="px-4 py-3">本月实发</th>
                <th className="px-4 py-3">较上月</th>
                <th className="px-4 py-3">实际入仓</th>
                <th className="px-4 py-3">库存 / 可售</th>
                <th className="px-4 py-3">退货率</th>
                <th className="px-4 py-3">ERP成本</th>
                <th className="px-4 py-3">关注提示</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {inboundGroups.map((group) => {
                const product = data.products.find(
                  (item) =>
                    item.recordKind === "existing" &&
                    item.productMode !== "dropship" &&
                    (item.productFamilyKey === group.familyKey ||
                      deriveProductFamilyKey(item.name) === group.familyKey),
                );
                const productSkus = skus.filter((sku) =>
                  group.skuIds.includes(sku.id),
                );
                const currentRows = productSkus.map((sku) => draftFor(sku));
                const previousRows = productSkus.map((sku) => {
                  const snapshot = snapshotFor(sku.id, previousPeriod);
                  return snapshot ? pickMetricFields(snapshot) : {};
                });
                const comparison = aggregateSkuSnapshots(
                  currentRows,
                  previousRows,
                  selectedPeriod,
                );
                const metricSummary = comparison.current;
                const inboundSummary = buildProductInboundSummary(
                  productSkus,
                  data.monthlyInboundSnapshots ?? [],
                  snapshots,
                  selectedPeriod,
                );
                const inboundSupplierSummary = buildProductInboundSupplierSummary(
                  productSkus,
                  data.monthlyInboundSnapshots ?? [],
                  selectedPeriod,
                );
                const hasInboundPeriodData = (data.monthlyInboundSnapshots ?? []).some(
                  (snapshot) => productSkus.some((sku) => sku.id === snapshot.skuMasterId) && snapshot.period === selectedPeriod,
                );
                const plan = buildSupplyPlan(
                  {
                    products: [
                      {
                        id: product?.id ?? group.familyKey,
                        name: group.productName,
                        productFamilyKey: group.familyKey,
                      },
                    ],
                    skuMasters: productSkus,
                    suppliers: data.suppliers.map((item) => ({
                      id: item.id,
                      name: item.name,
                    })),
                    offers: data.offers,
                    links: data.skuOfferLinks ?? [],
                    decisions: data.supplierOfferDecisions ?? [],
                  },
                  product?.id ?? group.familyKey,
                );
                const expanded = Boolean(expandedFamilies[group.familyKey]);
                const attention = getProductFamilyAttention({
                  pendingSkuCount: plan.pendingSkuCount,
                  returnRate: metricSummary.returnRate,
                  currentSales: metricSummary.monthlySales,
                  previousSales: comparison.previous.monthlySales,
                  hasCurrentData: metricSummary.source !== "pending",
                });
                return (
                  <Fragment key={group.familyKey}>
                    <tr className="bg-white hover:bg-paper-warm/50">
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <button
                            aria-label={`${expanded ? "收起" : "展开"}${group.productName} SKU`}
                            className="rounded border border-line px-1.5 py-0.5 text-xs text-slate-500"
                            onClick={() =>
                              setExpandedFamilies((current) => ({
                                ...current,
                                [group.familyKey]: !expanded,
                              }))
                            }
                            type="button"
                          >
                            {expanded ? "−" : "+"}
                          </button>
                          {product ? (
                            <Link
                              className="font-medium text-action hover:underline"
                              href={`/products/${product.id}`}
                            >
                              {group.productName}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-700">
                              {group.productName}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 pl-8 text-xs text-slate-400">
                          {product?.category || "待补类目"}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top font-medium">{productSkus.length}</td>
                      <td className="px-4 py-3 align-top text-xs">
                        主供 {plan.primarySuppliers.length} · 备供{" "}
                        {plan.backupSuppliers.length}
                        <MissingSupplyLink
                          productId={product?.id}
                          familyKey={group.familyKey}
                          count={plan.pendingSkuCount}
                        />
                        <div className="mt-1 text-[11px] text-slate-500">
                          实际供货：{inboundSupplierSummary.suppliers.length === 0
                            ? "待采集"
                            : inboundSupplierSummary.suppliers.map((item) => item.supplierName).join("、")}
                          {inboundSupplierSummary.isSplit ? "（供应商分拆）" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {product?.portfolioStatus === "active"
                          ? "继续经营"
                          : product?.portfolioStatus === "optimize"
                            ? "需要优化"
                            : product?.portfolioStatus === "discontinued"
                              ? "淘汰"
                              : "观察"}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-700">{metricSummary.monthlySales ?? "待采集"}</td>
                      <td className={`px-4 py-3 align-top text-xs font-medium ${comparison.delta.monthlySales != null && comparison.delta.monthlySales < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {comparison.delta.monthlySales == null ? "—" : `${comparison.delta.monthlySales >= 0 ? "+" : ""}${comparison.delta.monthlySales}`}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-700">{hasInboundPeriodData ? inboundSummary.receivedQuantity : "待采集"}</td>
                      <td className="px-4 py-3 align-top text-xs text-slate-500">
                        {inboundSummary.actualStock != null ? inboundSummary.actualStock : "待采集"}
                        <span className="text-slate-400"> / </span>
                        {inboundSummary.availableStock != null ? inboundSummary.availableStock : "待采集"}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-700">{metricSummary.returnRate != null ? `${metricSummary.returnRate}%` : "待采集"}</td>
                      <td className="px-4 py-3 align-top text-xs text-slate-700">{metricSummary.erpCostPrice != null ? metricSummary.erpCostPrice : "待采集"}</td>
                      <td className="px-4 py-3 align-top text-xs">
                        <div className={attention[0] === "当前无明显异常" ? "text-slate-500" : "font-medium text-amber-700"}>{attention[0]}</div>
                        {attention[1] ? <div className="mt-1 text-slate-500">{attention[1]}</div> : null}
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="bg-paper-warm/30 text-xs">
                        <td className="px-4 py-2 text-slate-500" colSpan={11}>
                          统计月份：{selectedPeriod}；主销售量按实发数量，历史数据保留为月度快照。
                        </td>
                      </tr>
                    ) : null}
                    {expanded ? productSkus.map((sku) => {
                      const draft = draftFor(sku);
                      const previous = snapshotFor(sku.id, previousPeriod);
                      const skuInboundSummary = buildProductInboundSummary([sku], data.monthlyInboundSnapshots ?? [], snapshots, selectedPeriod);
                      const skuHasInbound = (data.monthlyInboundSnapshots ?? []).some((snapshot) => snapshot.skuMasterId === sku.id && snapshot.period === selectedPeriod);
                      const skuSupplierSummary = buildProductInboundSupplierSummary([sku], data.monthlyInboundSnapshots ?? [], selectedPeriod);
                      const skuAttention = getProductFamilyAttention({
                        pendingSkuCount: 0,
                        returnRate: draft.returnRate,
                        currentSales: draft.monthlySales,
                        previousSales: previous?.monthlySales,
                        hasCurrentData: draft.monthlySales !== undefined,
                      });
                      const skuDelta = draft.monthlySales != null && previous?.monthlySales != null ? draft.monthlySales - previous.monthlySales : undefined;
                      return (
                        <tr className="bg-paper-warm/20 align-top text-xs" key={sku.id}>
                          <td className="px-4 py-2 pl-10">
                            <div className="font-medium text-slate-800">{sku.internalSkuCode}</div>
                            <div className="mt-0.5 text-slate-500">{sku.specification || "规格待补"}</div>
                          </td>
                          <td className="px-4 py-2 text-slate-400">—</td>
                          <td className="px-4 py-2 text-slate-500">
                            {skuSupplierSummary.suppliers.length ? skuSupplierSummary.suppliers.map((item) => item.supplierName).join("、") : "待采集"}
                          </td>
                          <td className="px-4 py-2 text-slate-400">—</td>
                          <td className="px-4 py-2">
                            <CompactMetricInput ariaLabel={`${sku.internalSkuCode} 实发数量`} value={draft.monthlySales} onChange={(value) => updateDraft(sku.id, "monthlySales", value)} />
                          </td>
                          <td className={`px-4 py-2 font-medium ${skuDelta != null && skuDelta < 0 ? "text-red-600" : "text-emerald-700"}`}>{skuDelta == null ? "—" : `${skuDelta >= 0 ? "+" : ""}${skuDelta}`}</td>
                          <td className="px-4 py-2 text-slate-700">{skuHasInbound ? skuInboundSummary.receivedQuantity : "待采集"}</td>
                          <td className="px-4 py-2 text-slate-500">{skuInboundSummary.actualStock ?? "待采集"} / {skuInboundSummary.availableStock ?? "待采集"}</td>
                          <td className="px-4 py-2"><CompactMetricInput ariaLabel={`${sku.internalSkuCode} 退货率`} suffix="%" value={draft.returnRate} onChange={(value) => updateDraft(sku.id, "returnRate", value)} /></td>
                          <td className="px-4 py-2"><CompactMetricInput ariaLabel={`${sku.internalSkuCode} ERP成本`} value={draft.erpCostPrice} onChange={(value) => updateDraft(sku.id, "erpCostPrice", value)} /></td>
                          <td className="px-4 py-2"><span className={skuAttention[0] === "当前无明显异常" ? "text-slate-400" : "text-amber-700"}>{skuAttention[0]}</span></td>
                        </tr>
                      );
                    }) : null}
                    {expanded ? (
                      <tr className="bg-paper-warm/20">
                        <td className="px-4 py-2" colSpan={11}>
                          <SkuCompositionPanel salesSkuCodes={productSkus.map((sku) => sku.internalSkuCode)} compositions={data.skuCompositions ?? []} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SourceNote({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2">
      <div className="font-medium text-slate-700">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
    </div>
  );
}

function DecisionCount({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "red" }) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-full px-2.5 py-1 ${colors[tone]}`}>{label} {value}</span>;
}

function MissingSupplyLink({
  productId,
  familyKey,
  count,
}: {
  productId?: string;
  familyKey: string;
  count: number;
}) {
  if (!count) return null;
  const label = `待处理 SKU ${count}`;
  return productId ? (
    <Link
      className="mt-1 block text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-900"
      href={`/products/${productId}?familyKey=${encodeURIComponent(familyKey)}`}
      title="进入产品详情，查看具体 SKU 的供应方案缺项"
    >
      {label}
    </Link>
  ) : (
    <div className="mt-1 text-amber-700">{label}</div>
  );
}

function CompactMetricInput({
  ariaLabel,
  value,
  suffix,
  onChange,
}: {
  ariaLabel: string;
  value?: number;
  suffix?: string;
  onChange: (value?: number) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1 text-xs text-slate-700">
      <input
        aria-label={ariaLabel}
        className="w-20 rounded border border-line bg-white px-2 py-1 text-xs text-slate-800"
        min="0"
        onChange={(event) =>
          onChange(
            event.target.value === "" ? undefined : Number(event.target.value),
          )
        }
        type="number"
        value={value ?? ""}
      />
      {suffix ? <span className="text-slate-500">{suffix}</span> : null}
    </label>
  );
}

function getPreviousPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function pickMetricFields(metrics: SkuMetricInput): SkuMetricInput {
  return {
    monthlySales: metrics.monthlySales,
    salesAmount: metrics.salesAmount,
    erpCostPrice: metrics.erpCostPrice,
    shippedQuantity: metrics.shippedQuantity,
    returnQuantity: metrics.returnQuantity,
    grossMarginRate: metrics.grossMarginRate,
    inventoryDays: metrics.inventoryDays,
    stockoutCount: metrics.stockoutCount,
    returnRate: metrics.returnRate,
  };
}

async function readJushuitanWorkbook(
  file: File,
): Promise<{ rows: unknown[][]; sheetName: string }> {
  const buffer = await file.arrayBuffer();
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("文件没有可读取的工作表");
    return {
      rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
        header: 1,
        defval: "",
      }),
      sheetName,
    };
  } catch {
    return readXlsxXmlFallback(buffer);
  }
}

function readXlsxXmlFallback(buffer: ArrayBuffer): {
  rows: unknown[][];
  sheetName: string;
} {
  const files = unzipSync(new Uint8Array(buffer));
  const sheetXml = files["xl/worksheets/sheet1.xml"];
  if (!sheetXml) throw new Error("文件没有可读取的第一张工作表");
  const xml = new TextDecoder().decode(sheetXml).replace(/^\uFEFF/, "");
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror"))
    throw new Error("Excel 工作表格式无法读取");
  const namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const rowNodes = Array.from(
    document.getElementsByTagNameNS(namespace, "row"),
  );
  const rows: unknown[][] = [];
  for (const rowNode of rowNodes) {
    const values: unknown[] = [];
    for (const cell of Array.from(
      rowNode.getElementsByTagNameNS(namespace, "c"),
    )) {
      const reference = cell.getAttribute("r") ?? "";
      const column = reference.match(/^[A-Z]+/)?.[0] ?? "A";
      const index = columnLettersToIndex(column);
      const inlineText =
        cell.getElementsByTagNameNS(namespace, "t")[0]?.textContent ?? "";
      const value =
        cell.getElementsByTagNameNS(namespace, "v")[0]?.textContent ?? "";
      values[index] =
        cell.getAttribute("t") === "inlineStr" ? inlineText : value;
    }
    rows.push(values);
  }
  return { rows, sheetName: "Sheet1" };
}

function columnLettersToIndex(value: string): number {
  return (
    value
      .split("")
      .reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0) -
    1
  );
}
