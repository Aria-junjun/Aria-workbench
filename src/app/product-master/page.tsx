"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import * as XLSX from "xlsx";
import { unzipSync } from "fflate";
import { EmptyState } from "@/components/empty-state";
import { HelpHint } from "@/components/workbench/help-hint";
import {
  createInboundProductsFromSkuMasters,
  saveMonthlyInboundSnapshots,
  saveSkuOperatingSnapshots,
  type LocalMonthlyInboundSnapshot,
  type LocalSkuOperatingSnapshot,
} from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import {
  aggregateSkuMetrics,
  aggregateSkuSnapshots,
  buildProductSupplierDisplay,
  buildProductInboundSummary,
  buildProductInboundSupplierSummary,
  buildProductSupplierDecisionRows,
  groupSkuMastersByProduct,
  groupSkuMastersByOperatingProduct,
  deriveProductFamilyKey,
  sortProductMasterGroupsByOperatingData,
  sortProductMasterSkusByOperatingData,
  type SkuMetricInput,
} from "@/features/workbench/product-master";
import {
  formatJushuitanImportError,
  parseJushuitanSalesRows,
  type JushuitanSalesImportResult,
} from "@/features/workbench/jushuitan-sales-import";
import { summarizeImportQuality } from "@/features/workbench/import-data-quality";
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
import { SkuSupplierExceptionEditor } from "@/components/workbench/sku-supplier-exception-editor";
import { getProductFamilyAttention, isCompositeSalesSku } from "@/features/workbench/product-master-presentation";
import {
  classifySkuRelationship,
  formatSkuRelationshipStatus,
  type SkuRelationshipSummary,
} from "@/features/workbench/relationship-rules";

export default function ProductMasterPage() {
  const data = useWorkbenchData();
  const [message, setMessage] = useState("");
  const [expandedFamilies, setExpandedFamilies] = useState<
    Record<string, boolean>
  >({});
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const [productPage, setProductPage] = useState(1);
  const [skuQuery, setSkuQuery] = useState("");
  const [skuSort, setSkuSort] = useState<"sales" | "return" | "inbound" | "code">("sales");
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
  function snapshotForSku(skuId: string, period: string): LocalSkuOperatingSnapshot {
    return snapshots.find((snapshot) => snapshot.skuMasterId === skuId && snapshot.period === period) ?? {
      id: `missing-${skuId}-${period}`,
      skuMasterId: skuId,
      period,
      source: "manual",
      createdAt: "",
      updatedAt: "",
    };
  }
  const productGroups = groupSkuMastersByOperatingProduct(skus);
  const productFamilyGroups = groupSkuMastersByProduct(skus);
  const inboundMatchesGroup = (snapshot: LocalMonthlyInboundSnapshot, group: { skuIds: string[]; productFamilyKey?: string; familyKey?: string }) =>
    group.skuIds.includes(snapshot.skuMasterId) || (snapshot.mappingLevel === "product_family" && Boolean(snapshot.productFamilyKey) && snapshot.productFamilyKey === (group.productFamilyKey ?? group.familyKey));
  const inboundGroups = productGroups.filter((group) =>
    data.products.some(
      (product) =>
        product.recordKind === "existing" &&
        product.productMode !== "dropship" &&
        (product.productFamilyKey === (group.productFamilyKey ?? group.familyKey) ||
          deriveProductFamilyKey(product.name) === (group.productFamilyKey ?? group.familyKey)),
    ),
  );
  const pendingGroups = productGroups.filter((group) => !inboundGroups.some((item) => item.familyKey === group.familyKey));
  const sortedInboundGroups = sortProductMasterGroupsByOperatingData(
    inboundGroups,
    snapshots,
    data.monthlyInboundSnapshots ?? [],
    selectedPeriod,
  );
  const filteredInboundGroups = sortedInboundGroups
    .filter((group) => {
      const query = skuQuery.trim().toLowerCase();
      if (!query) return true;
      const familyCodeAliases = [group.operatingProductCode, ...group.internalSkuCodes]
        .filter(Boolean)
        .map((code) => code!.replace(/^([a-z]+)-\d+/i, "$1-"));
      return [group.productName, group.productFamilyKey, ...familyCodeAliases, ...group.internalSkuCodes]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    })
    .sort((left, right) => {
      if (skuSort === "code") return (left.operatingProductCode ?? "").localeCompare(right.operatingProductCode ?? "");
      const valueFor = (group: typeof sortedInboundGroups[number]) => {
        const groupSkus = skus.filter((sku) => group.skuIds.includes(sku.id));
        if (skuSort === "inbound") return (data.monthlyInboundSnapshots ?? []).filter((snapshot) => snapshot.period === selectedPeriod && inboundMatchesGroup(snapshot, group)).reduce((total, snapshot) => total + (snapshot.receivedQuantity ?? 0), 0);
        const metrics = groupSkus.map((sku) => snapshotForSku(sku.id, selectedPeriod));
        if (skuSort === "return") return aggregateSkuMetrics(metrics).returnRate ?? -1;
        return aggregateSkuMetrics(metrics).monthlySales ?? -1;
      };
      return valueFor(right) - valueFor(left);
    });
  const productPageSize = 20;
  const productPageCount = Math.max(1, Math.ceil(filteredInboundGroups.length / productPageSize));
  const safeProductPage = Math.min(productPage, productPageCount);
  const visibleInboundGroups = filteredInboundGroups.slice(
    (safeProductPage - 1) * productPageSize,
    safeProductPage * productPageSize,
  );
  const periodInboundSnapshots = (data.monthlyInboundSnapshots ?? []).filter(
    (snapshot) => snapshot.period === selectedPeriod,
  );
  const productFamilyComparisonGroups = productFamilyGroups.filter((group) =>
    data.products.some((product) =>
      product.recordKind === "existing" &&
      product.productMode !== "dropship" &&
      (product.productFamilyKey === group.familyKey || deriveProductFamilyKey(product.name) === group.familyKey),
    ),
  );
  const decisionRows = buildProductSupplierDecisionRows(
    productFamilyComparisonGroups.filter((group) =>
      periodInboundSnapshots.some((snapshot) => inboundMatchesGroup(snapshot, group)),
    ).map((group) => ({
      familyKey: group.familyKey,
      productName: group.productName,
      skus: skus.filter((sku) => group.skuIds.includes(sku.id)),
    })),
    periodInboundSnapshots,
    snapshots,
    selectedPeriod,
  );
  const actionableDecisionRows = decisionRows
    .filter((row) => row.decision !== "maintain_primary")
    .sort((left, right) => decisionPriority(right) - decisionPriority(left) || (right.returnRate ?? -1) - (left.returnRate ?? -1));
  const previousPeriod = getPreviousPeriod(selectedPeriod);
  const totalFamilySales = productFamilyComparisonGroups.reduce((total, family) => {
    const familySkus = skus.filter((sku) => family.skuIds.includes(sku.id));
    return total + (aggregateSkuMetrics(familySkus.map((sku) => draftFor(sku))).monthlySales ?? 0);
  }, 0);
  const salesQuality = salesPreview
    ? summarizeImportQuality({
        sourceLabel: "销售表",
        totalRows: salesPreview.rows.length + salesPreview.errors.length,
        validRows: salesPreview.rows.length,
        matchedRows: salesPreview.rows.filter((row) => skus.some((sku) => sku.internalSkuCode === row.internalSkuCode)).length,
        issueRows: salesPreview.errors.length,
        duplicateRows: salesPreview.errors.filter((item) => item.message.includes("重复")).length,
        mergedRows: 0,
        period: selectedPeriod,
      })
    : null;

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
    const grouped = new Map<string, ConfirmedInboundRow>();
    rows.forEach((row) => {
      const key = row.mappingLevel === "product_family" && row.productFamilyKey ? `family:${row.productFamilyKey}` : `sku:${row.skuMasterId}`;
      const existing = grouped.get(key);
      grouped.set(key, existing ? { ...existing, receivedQuantity: existing.receivedQuantity + row.receivedQuantity } : row);
    });
    saveMonthlyInboundSnapshots([...grouped.values()]);
    setInboundPreview(null);
    setInboundFileMeta(null);
    setMessage(`已保存 ${selectedPeriod} 实际入仓：${grouped.size} 条产品族/ SKU 记录；未匹配行未写入。`);
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
                setProductPage(1);
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
      {pendingGroups.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium text-amber-900">待生成入仓产品族（{pendingGroups.length}）</h2>
              <p className="mt-1 text-xs text-amber-800">
                SKU 已导入，但还没有建立产品族。确认生成后，才会进入主表并关联经营数据。
              </p>
            </div>
            <button
              className="h-9 rounded-md bg-action px-3 text-sm font-medium text-white"
              onClick={generateProducts}
              type="button"
            >
              确认生成入仓产品
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-amber-50 text-amber-900">
                <tr>
                  <th className="px-3 py-2">产品族</th>
                  <th className="px-3 py-2">SKU数</th>
                  <th className="px-3 py-2">内部编码示例</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {pendingGroups.map((group) => (
                  <tr key={group.familyKey}>
                    <td className="px-3 py-2 font-medium text-slate-800">{group.productName}</td>
                    <td className="px-3 py-2 text-slate-600">{group.skuIds.length}</td>
                    <td className="px-3 py-2 text-slate-600">{group.internalSkuCodes.slice(0, 3).join("、")}{group.internalSkuCodes.length > 3 ? "…" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <section className="rounded-lg border border-line bg-paper-warm/40 px-4 py-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-medium text-slate-700">数据口径</span>
          <span>实发、实退和 ERP 成本来自月度经营表；实际入仓来自入仓表；库存与可售暂不纳入判断。经营数据按主编码归并，例如 Y-10BBT 与 Y-10BBT-8 计入同一经营产品。</span>
          <HelpHint label="数据口径" description="页面只使用已导入并成功匹配的经营数据，不用入仓数量推算库存或可售。" />
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
              <DecisionCount label="正常供货" value={decisionRows.filter((row) => row.decision === "maintain_primary").length} tone="green" />
              <DecisionCount label="需要复核" value={decisionRows.filter((row) => row.decision === "review_split" || row.decision === "review_quality").length} tone="amber" />
              <DecisionCount label="待补供应商" value={decisionRows.filter((row) => row.decision === "confirm_supplier").length} tone="red" />
            </div>
          </div>
          {actionableDecisionRows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-[1040px] w-full table-fixed text-left text-xs">
              <colgroup><col className="w-[18%]" /><col className="w-[14%]" /><col className="w-[26%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[20%]" /></colgroup>
              <thead className="bg-paper-warm text-slate-500">
                <tr className="whitespace-nowrap align-middle">
                  <th className="px-3 py-2">产品</th>
                  <th className="whitespace-nowrap px-3 py-2">实际供应商</th>
                  <th className="px-3 py-2">异常 SKU 明细</th>
                  <th className="whitespace-nowrap px-3 py-2">本月入仓 <HelpHint label="本月入仓" description="来自当前统计月份的实际入仓记录，用于判断真实供货，不代表库存余额。" /></th>
                  <th className="whitespace-nowrap px-3 py-2">退货率信号 <HelpHint label="退货率信号" description="退货率只作为产品质量复核信号，多供应商场景下不直接归因给单一供应商。" /></th>
                  <th className="whitespace-nowrap px-3 py-2">建议动作 <HelpHint label="建议动作" description="动作由供应关系、实际入仓和质量信号共同决定，不由 SKU 覆盖单独决定。" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {actionableDecisionRows.map((row) => (
                  <tr key={row.familyKey} className="align-top">
                    <td className="px-3 py-3 font-medium text-slate-800">{row.productName}</td>
                    <td className="px-3 py-3">
                      {row.supplierId ? (
                         <Link className="text-action hover:underline" href={`/suppliers/${row.supplierId}#supplier-relationship`}>{row.supplierName}</Link>
                      ) : row.supplierName}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <div className="space-y-1">
                        {row.skuDetails.filter((detail) => detail.returnRate !== undefined || detail.receivedQuantity > 0).map((detail) => (
                          <div key={detail.internalSkuCode}>
                            <span className="font-medium text-slate-700">{detail.internalSkuCode}</span>
                            <span className="ml-1">{detail.specification || "规格待补"}</span>
                            {detail.receivedQuantity > 0 ? <span className="ml-1">· 入仓 {detail.receivedQuantity}</span> : null}
                            {detail.returnRate !== undefined ? <span className="ml-1">· 退货率 {detail.returnRate}%</span> : null}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{row.receivedQuantity || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">{row.returnRate !== undefined ? `${row.returnRate}%` : "未采集"}</td>
                    <td className="px-3 py-3">
                      <Link
                        className={`font-medium hover:underline ${row.decision === "maintain_primary" ? "text-emerald-700" : "text-amber-700"}`}
                         href={row.decision === "confirm_supplier" ? "/sku-master/import" : row.supplierId ? `/suppliers/${row.supplierId}#supplier-relationship` : "/suppliers"}
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
          ) : (
            <p className="rounded-lg bg-emerald-50 px-3 py-3 text-xs text-emerald-800">当前产品族均为正常供货，没有需要复核或补充的产品 / 供应商。</p>
          )}
          <p className="text-xs text-slate-500">当前月份：{selectedPeriod} · 退货率仅作为产品质量复核信号，不在多供应商场景下直接归因。</p>
        </section>
      ) : null}
      {salesImportError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {salesImportError}
        </p>
      ) : null}
      {inboundImportError ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{inboundImportError}</p> : null}
      {inboundPreview && inboundFileMeta ? <SupplierInboundImportPreview result={inboundPreview} period={selectedPeriod} fileName={inboundFileMeta.fileName} sheetName={inboundFileMeta.sheetName} skuMasters={skus} suppliers={data.suppliers} existingAssignments={data.productSupplierAssignments ?? []} onCancel={() => { setInboundPreview(null); setInboundFileMeta(null); }} onConfirm={saveInboundImport} /> : null}
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
          {salesQuality ? <div className={`rounded-lg px-3 py-2 text-xs leading-5 ${salesQuality.status === "ready" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
            <div className="font-medium">数据质量检查：{salesQuality.headline}</div>
            <div className="mt-1">{salesQuality.details.join(" · ")}。只有已匹配内部 SKU 的行会写入本次经营数据。</div>
            <div className="mt-1">ERP成本字段：{salesPreview.costField ? `${salesPreview.costField}${salesPreview.costField === "成本价" ? "（单位成本）" : "（按本期实发数量换算单位成本）"}` : "未提供，本次不写入成本"}。</div>
          </div> : null}
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
      {productFamilyComparisonGroups.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-line bg-white p-4 shadow-sm">
          <div>
            <h2 className="font-medium text-slate-800">产品族经营对比</h2>
            <p className="mt-1 text-xs text-slate-500">先看大类在整体经营盘子中的权重，再进入下方经营产品和 SKU 明细定位问题。</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-paper-warm text-slate-500"><tr className="whitespace-nowrap">
                <th className="px-3 py-2">产品族</th><th className="px-3 py-2">SKU数</th><th className="px-3 py-2">本月实发</th><th className="px-3 py-2">实发占比</th><th className="px-3 py-2">实发环比</th><th className="px-3 py-2">实际入仓</th><th className="px-3 py-2">入仓环比</th><th className="px-3 py-2">退货率</th><th className="px-3 py-2">关注提示</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {productFamilyComparisonGroups.map((family) => {
                  const familySkus = skus.filter((sku) => family.skuIds.includes(sku.id));
                  const comparison = aggregateSkuSnapshots(
                    familySkus.map((sku) => draftFor(sku)),
                    familySkus.map((sku) => snapshotFor(sku.id, previousPeriod) ? pickMetricFields(snapshotFor(sku.id, previousPeriod)!) : {}),
                    selectedPeriod,
                  );
                  const familyInbound = buildProductInboundSummary(familySkus, data.monthlyInboundSnapshots ?? [], snapshots, selectedPeriod);
                  const previousFamilyInbound = buildProductInboundSummary(familySkus, data.monthlyInboundSnapshots ?? [], snapshots, previousPeriod);
                  const hasFamilyInbound = (data.monthlyInboundSnapshots ?? []).some((snapshot) => snapshot.period === selectedPeriod && (family.skuIds.includes(snapshot.skuMasterId) || (snapshot.mappingLevel === "product_family" && snapshot.productFamilyKey === family.familyKey)));
                  const hasPreviousFamilyInbound = (data.monthlyInboundSnapshots ?? []).some((snapshot) => snapshot.period === previousPeriod && (family.skuIds.includes(snapshot.skuMasterId) || (snapshot.mappingLevel === "product_family" && snapshot.productFamilyKey === family.familyKey)));
                  const familyInboundDelta = hasFamilyInbound && hasPreviousFamilyInbound ? familyInbound.receivedQuantity - previousFamilyInbound.receivedQuantity : undefined;
                  const familySales = comparison.current.monthlySales ?? 0;
                  const familyAttention = getProductFamilyAttention({ pendingSkuCount: 0, returnRate: comparison.current.returnRate, currentSales: comparison.current.monthlySales, previousSales: comparison.previous.monthlySales, hasCurrentData: comparison.current.source !== "pending" });
                  return <tr key={family.familyKey} className="align-top">
                    <td className="px-3 py-3 font-medium text-slate-800">{family.productName}</td>
                    <td className="px-3 py-3 text-slate-600">{familySkus.length}</td>
                    <td className="px-3 py-3 text-slate-600">{comparison.current.monthlySales ?? "待采集"}</td>
                    <td className="px-3 py-3 text-slate-600">{totalFamilySales > 0 ? `${((familySales / totalFamilySales) * 100).toFixed(1)}%` : "—"}</td>
                    <td className={`px-3 py-3 font-medium ${comparison.delta.monthlySales != null && comparison.delta.monthlySales < 0 ? "text-red-600" : "text-emerald-700"}`}>{comparison.delta.monthlySales == null ? "—" : `${comparison.delta.monthlySales >= 0 ? "+" : ""}${comparison.delta.monthlySales}`}</td>
                    <td className="px-3 py-3 text-slate-600">{hasFamilyInbound ? familyInbound.receivedQuantity : "待采集"}</td>
                    <td className={`px-3 py-3 font-medium ${familyInboundDelta != null && familyInboundDelta < 0 ? "text-red-600" : "text-emerald-700"}`}>{familyInboundDelta == null ? "—" : `${familyInboundDelta >= 0 ? "+" : ""}${familyInboundDelta}`}</td>
                    <td className="px-3 py-3 text-slate-600">{comparison.current.returnRate != null ? `${comparison.current.returnRate}%` : "待采集"}</td>
                    <td className={`px-3 py-3 ${familyAttention[0] === "当前无明显异常" ? "text-slate-500" : "font-medium text-amber-700"}`}>{familyAttention[0]}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {inboundGroups.length === 0 ? (
        <EmptyState
          title={pendingGroups.length > 0 ? "还没有已确认的入仓产品主表" : "还没有入仓产品主表"}
          description={
            skus.length
              ? "上方已列出待生成产品族；确认后，系统会按产品族归并 SKU，并保留原产品机会资料。"
              : "请先导入并确认内部 SKU 表。"
          }
          actionHref="/sku-master/import"
          actionLabel="进入 SKU 导入"
        />
      ) : (
        <section className="space-y-3 rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-medium text-slate-800">SKU 明细对比</h2>
              <p className="mt-1 text-xs text-slate-500">按经营产品归并后查看原始 SKU；默认按本月实发排序，组合装不会另起主表产品。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input aria-label="搜索 SKU 或产品" className="h-9 w-56 rounded-md border border-line px-3 text-sm" onChange={(event) => { setSkuQuery(event.target.value); setProductPage(1); }} placeholder="搜索产品、编码、规格" value={skuQuery} />
              <select aria-label="SKU排序" className="h-9 rounded-md border border-line px-3 text-sm" onChange={(event) => { setSkuSort(event.target.value as typeof skuSort); setProductPage(1); }} value={skuSort}>
                <option value="sales">按本月实发排序</option>
                <option value="return">按退货率排序</option>
                <option value="inbound">按实际入仓排序</option>
                <option value="code">按经营编码排序</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-slate-500">当前显示 {filteredInboundGroups.length} 个经营产品 · 共 {productFamilyComparisonGroups.length} 个产品族</div>
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="min-w-[1160px] w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[220px]" />
              <col className="w-[72px]" />
              <col className="w-[220px]" />
              <col className="w-[100px]" />
              <col className="w-[92px]" />
              <col className="w-[80px]" />
              <col className="w-[92px]" />
              <col className="w-[82px]" />
              <col className="w-[82px]" />
              <col className="w-[82px]" />
              <col className="w-[160px]" />
            </colgroup>
            <thead className="bg-paper-warm text-xs text-slate-500">
              <tr className="whitespace-nowrap">
                <th className="px-4 py-3 text-left">产品 / SKU</th>
                <th className="px-4 py-3 text-center">SKU数</th>
                <th className="px-4 py-3 text-left">供应方案 <HelpHint label="供应关系" description="已确认的主供或备供关系默认持续有效，只有发生明确变更时才需要维护。" /></th>
                <th className="px-4 py-3 text-center">经营状态</th>
                <th className="px-4 py-3 text-center">本月实发</th>
                <th className="px-4 py-3 text-center">实发环比</th>
                <th className="px-4 py-3 text-center">实际入仓 <HelpHint label="实际入仓" description="来自当前统计月份的入仓记录，用于判断供货表现，不代表库存余额。" /></th>
                <th className="px-4 py-3 text-center">入仓环比</th>
                <th className="px-4 py-3 text-center">退货率 <HelpHint label="退货率" description="实退数量 ÷ 实发数量；当前仅作为质量复核信号。" /></th>
                <th className="px-4 py-3 text-center">ERP成本</th>
                <th className="px-4 py-3 text-left">关注提示 <HelpHint label="关注提示" description="仅提示已有数据支持的异常或待处理关系，不根据缺失库存数据推断风险。" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleInboundGroups.map((group) => {
                const product = data.products.find(
                  (item) =>
                    item.recordKind === "existing" &&
                    item.productMode !== "dropship" &&
                    (item.productFamilyKey === (group.productFamilyKey ?? group.familyKey) ||
                      deriveProductFamilyKey(item.name) === (group.productFamilyKey ?? group.familyKey)),
                );
                const productFamilyKey = group.productFamilyKey ?? group.familyKey;
                const productSkus = sortProductMasterSkusByOperatingData(
                  skus.filter((sku) => group.skuIds.includes(sku.id)),
                  snapshots,
                  data.monthlyInboundSnapshots ?? [],
                  selectedPeriod,
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
                const hasInboundPeriodData = (data.monthlyInboundSnapshots ?? []).some(
                  (snapshot) => productSkus.some((sku) => sku.id === snapshot.skuMasterId) && snapshot.period === selectedPeriod,
                );
                const previousInboundSummary = buildProductInboundSummary(productSkus, data.monthlyInboundSnapshots ?? [], snapshots, previousPeriod);
                const hasPreviousInboundPeriodData = (data.monthlyInboundSnapshots ?? []).some(
                  (snapshot) => productSkus.some((sku) => sku.id === snapshot.skuMasterId) && snapshot.period === previousPeriod,
                );
                const inboundDelta = hasInboundPeriodData && hasPreviousInboundPeriodData ? inboundSummary.receivedQuantity - previousInboundSummary.receivedQuantity : undefined;
                const relationshipSummaries = productSkus.map((sku) => classifySkuRelationship({
                  skuMasterId: sku.id,
                  skuCode: sku.internalSkuCode,
                  productFamilyKey,
                  period: selectedPeriod,
                  offerLinks: data.skuOfferLinks ?? [],
                  assignments: data.skuSupplierAssignments ?? [],
                  productSupplierAssignments: data.productSupplierAssignments ?? [],
                  inboundFacts: periodInboundSnapshots,
                }));
                const skuExceptionCount = relationshipSummaries.filter((summary) => summary.supplierRelationshipSource === "sku_assignment").length;
                const expanded = Boolean(expandedFamilies[group.familyKey]);
                const attention = getProductFamilyAttention({
                  pendingSkuCount: 0,
                  returnRate: metricSummary.returnRate,
                  currentSales: metricSummary.monthlySales,
                  previousSales: comparison.previous.monthlySales,
                  hasCurrentData: metricSummary.source !== "pending",
                });
                const operatingStatus = metricSummary.source === "pending"
                  ? "待补数据"
                  : attention[0] !== "当前无明显异常"
                    ? "需要关注"
                    : product?.portfolioStatus === "active"
                      ? "正常经营"
                      : product?.portfolioStatus === "optimize"
                        ? "需要优化"
                        : product?.portfolioStatus === "discontinued"
                          ? "淘汰"
                          : "观察";
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
                              {group.productName} <span className="font-normal text-slate-500">· {group.operatingProductCode}</span>
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-700">
                              {group.productName} <span className="font-normal text-slate-500">· {group.operatingProductCode}</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-1 pl-8 text-xs text-slate-400">
                          {product?.category || "待补类目"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center align-top font-medium">{productSkus.length}</td>
                      <td className="px-4 py-3 align-top text-left text-xs">
                        <ProductFamilySupplierAction relationships={relationshipSummaries} exceptionCount={skuExceptionCount} />
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        {operatingStatus}
                      </td>
                      <td className="px-4 py-3 text-center align-top text-xs text-slate-700">{metricSummary.monthlySales ?? "待采集"}</td>
                      <td className={`px-4 py-3 text-center align-top text-xs font-medium ${comparison.delta.monthlySales != null && comparison.delta.monthlySales < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {comparison.delta.monthlySales == null ? "—" : `${comparison.delta.monthlySales >= 0 ? "+" : ""}${comparison.delta.monthlySales}`}
                      </td>
                      <td className="px-4 py-3 text-center align-top text-xs text-slate-700">{hasInboundPeriodData ? inboundSummary.receivedQuantity : "待采集"}</td>
                      <td className={`px-4 py-3 text-center align-top text-xs font-medium ${inboundDelta != null && inboundDelta < 0 ? "text-red-600" : "text-emerald-700"}`}>{inboundDelta == null ? "—" : `${inboundDelta >= 0 ? "+" : ""}${inboundDelta}`}</td>
                      <td className="px-4 py-3 text-center align-top text-xs text-slate-700">{metricSummary.returnRate != null ? `${metricSummary.returnRate}%` : "待采集"}</td>
                      <td className="px-4 py-3 text-center align-top text-xs text-slate-700">{metricSummary.erpCostPrice != null ? metricSummary.erpCostPrice : "待采集"}</td>
                      <td className="px-4 py-3 align-top text-left text-xs">
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
                      const skuHasPreviousInbound = (data.monthlyInboundSnapshots ?? []).some((snapshot) => snapshot.skuMasterId === sku.id && snapshot.period === previousPeriod);
                      const skuPreviousInbound = (data.monthlyInboundSnapshots ?? []).filter((snapshot) => snapshot.skuMasterId === sku.id && snapshot.period === previousPeriod).reduce((total, snapshot) => total + (snapshot.receivedQuantity ?? 0), 0);
                      const skuInboundDelta = skuHasInbound && skuHasPreviousInbound ? skuInboundSummary.receivedQuantity - skuPreviousInbound : undefined;
                      const skuIsComposite = isCompositeSalesSku(`${sku.productName} ${sku.specification}`);
                      const skuSupplierSummary = buildProductInboundSupplierSummary([sku], data.monthlyInboundSnapshots ?? [], selectedPeriod);
                      const skuRelationship = classifySkuRelationship({
                        skuMasterId: sku.id,
                        skuCode: sku.internalSkuCode,
                        productFamilyKey,
                        period: selectedPeriod,
                        offerLinks: data.skuOfferLinks ?? [],
                        assignments: data.skuSupplierAssignments ?? [],
                        productSupplierAssignments: data.productSupplierAssignments ?? [],
                        inboundFacts: periodInboundSnapshots,
                      });
                      const skuRelationshipLabel = formatSkuRelationshipStatus(skuRelationship);
                      const skuSupplierDisplay = buildProductSupplierDisplay(
                        [skuRelationship],
                        skuSupplierSummary.suppliers,
                      );
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
                            <div className="mt-0.5 text-[11px] text-slate-400">原始 SKU 明细</div>
                          </td>
                          <td className="px-4 py-2 text-slate-400">—</td>
                          <td className="px-4 py-2 text-slate-500">
                            <div>{skuSupplierDisplay.label}：{skuSupplierDisplay.names.join("、")}</div>
                            <div className={skuSupplierDisplay.note.includes("异常") ? "mt-1 text-amber-700" : "mt-1 text-slate-400"}>{skuSupplierDisplay.note}</div>
                            <div className="mt-1 text-[11px] text-slate-600">{skuRelationshipLabel.supplyLabel}</div>
                            <div className="mt-1 text-[11px] text-slate-400" title={skuRelationship.reason}>供应关系依据：{skuRelationship.reason}</div>
                            <SkuSupplierExceptionEditor
                              skuCode={sku.internalSkuCode}
                              suppliers={data.suppliers}
                              currentPeriod={selectedPeriod}
                              onSaved={() => setMessage(`${sku.internalSkuCode} 的 SKU 例外关系已保存`)}
                            />
                          </td>
                          <td className="px-4 py-2 text-slate-400">—</td>
                          <td className="px-4 py-2">
                            <CompactMetricInput ariaLabel={`${sku.internalSkuCode} 实发数量`} value={draft.monthlySales} onChange={(value) => updateDraft(sku.id, "monthlySales", value)} />
                          </td>
                          <td className={`px-4 py-2 font-medium ${skuDelta != null && skuDelta < 0 ? "text-red-600" : "text-emerald-700"}`}>{skuDelta == null ? "—" : `${skuDelta >= 0 ? "+" : ""}${skuDelta}`}</td>
                          <td className={`px-4 py-2 ${skuHasInbound ? "text-slate-700" : skuIsComposite ? "text-slate-500" : "text-slate-700"}`}>{skuHasInbound ? skuInboundSummary.receivedQuantity : skuIsComposite ? "销售组合装，暂不纳入入仓对比" : "待采集"}</td>
                          <td className={`px-4 py-2 font-medium ${skuInboundDelta != null && skuInboundDelta < 0 ? "text-red-600" : "text-emerald-700"}`}>{skuInboundDelta == null ? "—" : `${skuInboundDelta >= 0 ? "+" : ""}${skuInboundDelta}`}</td>
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
          {productPageCount > 1 ? (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-slate-500">
              <span>按当前周期经营数据排序 · 共 {sortedInboundGroups.length} 个产品族</span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded border border-line px-2 py-1 disabled:opacity-40"
                  disabled={safeProductPage <= 1}
                  onClick={() => setProductPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  上一页
                </button>
                <span>{safeProductPage} / {productPageCount}</span>
                <button
                  className="rounded border border-line px-2 py-1 disabled:opacity-40"
                  disabled={safeProductPage >= productPageCount}
                  onClick={() => setProductPage((current) => Math.min(productPageCount, current + 1))}
                  type="button"
                >
                  下一页
                </button>
              </div>
            </div>
          ) : null}
        </div>
        </section>
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

function DecisionCount({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "red" }) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-full px-2.5 py-1 ${colors[tone]}`}>{label} {value}</span>;
}

function decisionPriority(row: { decision: string; returnRate?: number }) {
  if (row.decision === "confirm_supplier") return 300;
  if (row.decision === "review_split") return 200;
  if (row.decision === "review_quality") return 100 + (row.returnRate ?? 0);
  return 0;
}

function ProductFamilySupplierAction({ relationships, exceptionCount }: { relationships: SkuRelationshipSummary[]; exceptionCount: number }) {
  const assignedRelationships = relationships.filter((summary) => summary.supplyStatus === "assigned" && summary.supplierName);
  const familyPrimaryRelationships = assignedRelationships.filter(
    (summary) => summary.supplierRelationshipSource === "family_assignment" && summary.role === "primary",
  );
  const suppliers = Array.from(new Map(
    (familyPrimaryRelationships.length ? familyPrimaryRelationships : assignedRelationships)
      .map((summary) => [summary.supplierId ?? summary.supplierName!, summary]),
  ).values());
  const evidencedSupplier = relationships.find(
    (summary) => summary.supplyStatus === "evidenced" && summary.supplierName,
  );

  if (suppliers.length === 0) {
    if (evidencedSupplier?.supplierId) {
      return (
        <div className="space-y-1 text-[11px]">
          <div className="whitespace-nowrap text-slate-700">待确认：<Link className="text-action hover:underline" href={`/suppliers/${evidencedSupplier.supplierId}#supplier-relationship`}>{evidencedSupplier.supplierName}</Link></div>
          <Link className="block text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-900" href={`/suppliers/${evidencedSupplier.supplierId}#supplier-relationship`}>确认关系</Link>
          {exceptionCount > 0 ? <div className="text-slate-500">异常 SKU {exceptionCount}，仅例外核对</div> : null}
        </div>
      );
    }
    return (
      <div className="space-y-1 text-[11px]">
        <div className="whitespace-nowrap text-amber-700">待确认供应商</div>
        <Link className="block text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-900" href="/suppliers">维护关系</Link>
        {exceptionCount > 0 ? <div className="text-slate-500">异常 SKU {exceptionCount}，仅例外核对</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-[11px] text-slate-700">
      <div className="whitespace-nowrap"><span className="font-medium">{familyPrimaryRelationships.length ? "主供：" : "供应商："}</span>{suppliers.map((summary, index) => (
        <Fragment key={`${summary.supplierId ?? summary.supplierName}-${index}`}>
          {index > 0 ? "、" : null}
          {summary.supplierId ? (
            <Link className="text-action hover:underline" href={`/suppliers/${summary.supplierId}#supplier-relationship`}>
              {summary.supplierName}
            </Link>
          ) : summary.supplierName}
        </Fragment>
      ))}
      </div>
      <div className="text-slate-500">{exceptionCount > 0 ? `异常 SKU ${exceptionCount}，仅例外核对` : "关系持续有效"}</div>
    </div>
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
