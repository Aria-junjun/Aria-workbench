"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import * as XLSX from "xlsx";
import { unzipSync } from "fflate";
import { EmptyState } from "@/components/empty-state";
import { createInboundProductsFromSkuMasters, saveSkuOperatingSnapshots, type LocalSkuOperatingSnapshot } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import { buildSupplyPlan } from "@/features/workbench/supply-decision";
import { aggregateSkuMetrics, aggregateSkuSnapshots, groupSkuMastersByProduct, deriveProductFamilyKey, type SkuMetricInput } from "@/features/workbench/product-master";
import { parseJushuitanSalesRows, type JushuitanSalesImportResult } from "@/features/workbench/jushuitan-sales-import";

export default function ProductMasterPage() {
  const data = useWorkbenchData();
  const [message, setMessage] = useState("");
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const [draftMetrics, setDraftMetrics] = useState<Record<string, SkuMetricInput>>({});
  const [salesPreview, setSalesPreview] = useState<JushuitanSalesImportResult | null>(null);
  const [salesFileMeta, setSalesFileMeta] = useState<{ fileName: string; sheetName: string } | null>(null);
  const [salesImportError, setSalesImportError] = useState("");
  const skus = (data.skuMasters ?? []).filter((sku) => sku.status !== "archived");
  const snapshots = data.skuOperatingSnapshots ?? [];
  const productGroups = groupSkuMastersByProduct(skus);
  const inboundGroups = productGroups.filter((group) => data.products.some((product) => product.recordKind === "existing" && product.productMode !== "dropship" && (product.productFamilyKey === group.familyKey || deriveProductFamilyKey(product.name) === group.familyKey)));
  const previousPeriod = getPreviousPeriod(selectedPeriod);

  function snapshotFor(skuId: string, period: string): LocalSkuOperatingSnapshot | undefined {
    return snapshots.find((snapshot) => snapshot.skuMasterId === skuId && snapshot.period === period);
  }

  function metricsFor(sku: typeof skus[number], period: string): SkuMetricInput {
    const snapshot = snapshotFor(sku.id, period);
    if (snapshot) return pickMetricFields(snapshot);
    if (period === currentPeriod && snapshots.every((item) => item.skuMasterId !== sku.id)) {
      return pickMetricFields(sku);
    }
    return {};
  }

  function draftFor(sku: typeof skus[number]): SkuMetricInput {
    return draftMetrics[sku.id] ?? metricsFor(sku, selectedPeriod);
  }

  function updateDraft(skuId: string, key: keyof SkuMetricInput, value?: number) {
    setDraftMetrics((current) => ({ ...current, [skuId]: { ...current[skuId], [key]: value } }));
  }

  function saveSelectedPeriod() {
    const entries = skus.map((sku) => {
      const draft = draftFor(sku);
      return { skuMasterId: sku.id, period: selectedPeriod, metrics: pickMetricFields(draft) };
    });
    saveSkuOperatingSnapshots(entries);
    setDraftMetrics({});
    setMessage(`已保存 ${selectedPeriod}：${entries.length} 个 SKU 的月度经营快照，历史月份不会被覆盖。`);
  }

  function generateProducts() {
    const result = createInboundProductsFromSkuMasters();
    setMessage(`已生成/更新 ${result.createdProductIds.length} 个入仓产品，关联 ${result.linkedSkuCount} 条 SKU。`);
  }

  async function handleSalesFile(file: File | undefined) {
    if (!file) return;
    setSalesImportError("");
    try {
      const { rows, sheetName } = await readJushuitanWorkbook(file);
      setSalesPreview(parseJushuitanSalesRows(rows, { fileName: file.name, sheetName, importedAt: new Date().toISOString() }));
      setSalesFileMeta({ fileName: file.name, sheetName });
    } catch (cause) {
      setSalesPreview(null);
      setSalesFileMeta(null);
      setSalesImportError(cause instanceof Error ? cause.message : "聚水潭表格读取失败");
    }
  }

  function saveSalesImport() {
    if (!salesPreview) return;
    const skuByCode = new Map(skus.map((sku) => [sku.internalSkuCode, sku]));
    const entries = salesPreview.rows.flatMap((row) => {
      const sku = skuByCode.get(row.internalSkuCode);
      return sku ? [{ skuMasterId: sku.id, period: selectedPeriod, source: "imported" as const, metrics: {
        monthlySales: row.monthlySales,
        salesAmount: row.salesAmount,
        erpCostPrice: row.erpCostPrice,
        shippedQuantity: row.shippedQuantity,
        returnQuantity: row.returnQuantity,
        returnRate: row.returnRate
      } }] : [];
    });
    if (entries.length === 0) {
      setSalesImportError("没有匹配到有效的内部 SKU 编码，请先导入并确认产品编码表。");
      return;
    }
    saveSkuOperatingSnapshots(entries);
    const unmatched = salesPreview.rows.length - entries.length;
    setDraftMetrics({});
    setMessage(`已导入 ${selectedPeriod}：${entries.length} 个 SKU；${unmatched ? `有 ${unmatched} 个编码未匹配，未写入。` : "全部编码已匹配。"}`);
    setSalesPreview(null);
    setSalesFileMeta(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">入仓产品主表</h1>
          <p className="mt-1 text-sm text-slate-500">实际经营产品的结构化入口。产品机会仍在“产品进程”中保留研究和阶段信息。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 items-center rounded-md border border-line bg-white px-3 text-sm text-slate-600">统计月份<input aria-label="统计月份" className="ml-2 h-7 rounded border border-line px-2 text-sm text-slate-800" onChange={(event) => { setSelectedPeriod(event.target.value); setDraftMetrics({}); }} type="month" value={selectedPeriod} /></label>
          <button className="h-10 rounded-md bg-action px-3 text-sm font-medium text-white disabled:opacity-50" disabled={skus.length === 0} onClick={saveSelectedPeriod} type="button">保存本月快照</button>
          <Link className="inline-flex h-10 items-center rounded-md border border-line bg-white px-3 text-sm" href="/sku-master/import">管理 SKU 表</Link>
          <button className="h-10 rounded-md bg-action px-3 text-sm font-medium text-white disabled:opacity-50" disabled={skus.length === 0} onClick={generateProducts} type="button">从 SKU 表生成入仓产品</button>
        </div>
      </div>
      {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="入仓产品族" value={inboundGroups.length} />
        <Stat label="已导入 SKU" value={skus.length} />
        <Stat label="待关联 SKU" value={skus.filter((sku) => !sku.productId).length} />
      </div>
      <section className="rounded-xl border border-line bg-paper-warm/40 p-4 text-sm">
        <h2 className="font-medium text-slate-800">数据来源与汇总口径</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <SourceNote title="产品表现数据" detail="聚水潭月度表导入净销量、实退数量、退货率和 ERP 成本基准；不做财务利润核算。" />
          <SourceNote title="供应方案" detail="供应商报价、MOQ、交期和规格匹配留在货盘报价页，用于供应商决策。" />
          <SourceNote title="产品族汇总" detail="同一产品族的 SKU 自动汇总销量和退货表现，成本只显示 ERP 成本基准，不展示成本变化。" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <label className="cursor-pointer rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-700 hover:bg-paper-warm">
            导入聚水潭月度表
            <input accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => void handleSalesFile(event.target.files?.[0])} type="file" />
          </label>
          <span className="text-xs text-slate-500">使用右上角统计月份保存；只写入能匹配内部编码的 SKU。</span>
        </div>
      </section>
      {salesImportError ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{salesImportError}</p> : null}
      {salesPreview && salesFileMeta ? <section className="space-y-3 rounded-xl border border-line bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium text-slate-800">聚水潭导入预览</h2><p className="mt-1 text-xs text-slate-500">{salesFileMeta.fileName} · {salesFileMeta.sheetName} · 写入月份 {selectedPeriod}</p></div><div className="text-xs text-slate-600">可导入 {salesPreview.rows.filter((row) => skus.some((sku) => sku.internalSkuCode === row.internalSkuCode)).length} 条 · 未匹配 {salesPreview.rows.filter((row) => !skus.some((sku) => sku.internalSkuCode === row.internalSkuCode)).length} 条</div></div>{salesPreview.errors.length ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{salesPreview.errors.map((item) => `第${item.rowNumber}行：${item.message}`).join("；")}</p> : null}<div className="overflow-x-auto rounded-lg border border-line"><table className="min-w-full text-left text-xs"><thead className="bg-paper-warm text-slate-500"><tr><th className="px-3 py-2">商品编码</th><th className="px-3 py-2">净销量</th><th className="px-3 py-2">实退数量</th><th className="px-3 py-2">退货率</th><th className="px-3 py-2">ERP成本价</th></tr></thead><tbody className="divide-y divide-line">{salesPreview.rows.slice(0, 8).map((row) => <tr key={row.internalSkuCode}><td className="px-3 py-2 font-medium">{row.internalSkuCode}</td><td className="px-3 py-2">{row.monthlySales ?? "-"}</td><td className="px-3 py-2">{row.returnQuantity ?? "-"}</td><td className="px-3 py-2">{row.returnRate != null ? `${row.returnRate}%` : "-"}</td><td className="px-3 py-2">{row.erpCostPrice ?? "-"}</td></tr>)}</tbody></table></div><div className="flex justify-end gap-2"><button className="rounded-md border border-line px-3 py-2 text-sm" onClick={() => { setSalesPreview(null); setSalesFileMeta(null); }} type="button">取消</button><button className="rounded-md bg-action px-3 py-2 text-sm font-medium text-white" onClick={saveSalesImport} type="button">确认导入</button></div></section> : null}
      {inboundGroups.length === 0 ? <EmptyState title="还没有入仓产品主表" description={skus.length ? "点击右上角按钮，系统会按产品族归并 SKU，并保留原产品机会资料。" : "请先导入并确认内部 SKU 表。"} actionHref="/sku-master/import" actionLabel="进入 SKU 导入" /> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper-warm text-xs text-slate-500"><tr><th className="px-4 py-3">产品</th><th className="px-4 py-3">SKU数</th><th className="px-4 py-3">内部编码</th><th className="px-4 py-3">供应方案</th><th className="px-4 py-3">经营状态</th><th className="px-4 py-3">经营数据</th></tr></thead>
            <tbody className="divide-y divide-line">{inboundGroups.map((group) => {
              const product = data.products.find((item) => item.recordKind === "existing" && item.productMode !== "dropship" && (item.productFamilyKey === group.familyKey || deriveProductFamilyKey(item.name) === group.familyKey));
              const productSkus = skus.filter((sku) => group.skuIds.includes(sku.id));
              const currentRows = productSkus.map((sku) => draftFor(sku));
              const previousRows = productSkus.map((sku) => { const snapshot = snapshotFor(sku.id, previousPeriod); return snapshot ? pickMetricFields(snapshot) : {}; });
              const comparison = aggregateSkuSnapshots(currentRows, previousRows, selectedPeriod);
              const metricSummary = comparison.current;
              const plan = buildSupplyPlan({
                products: [{ id: product?.id ?? group.familyKey, name: group.productName, productFamilyKey: group.familyKey }],
                skuMasters: productSkus,
                suppliers: data.suppliers.map((item) => ({ id: item.id, name: item.name })),
                offers: data.offers,
                links: data.skuOfferLinks ?? [],
                decisions: data.supplierOfferDecisions ?? []
              }, product?.id ?? group.familyKey);
              const expanded = Boolean(expandedFamilies[group.familyKey]);
              return <Fragment key={group.familyKey}><tr className="hover:bg-paper-warm/50"><td className="px-4 py-3"><div className="flex items-center gap-2"><button aria-label={`${expanded ? "收起" : "展开"}${group.productName} SKU`} className="rounded border border-line px-1.5 py-0.5 text-xs text-slate-500" onClick={() => setExpandedFamilies((current) => ({ ...current, [group.familyKey]: !expanded }))} type="button">{expanded ? "−" : "+"}</button>{product ? <Link className="font-medium text-action hover:underline" href={`/products/${product.id}`}>{group.productName}</Link> : <span className="font-medium text-slate-700">{group.productName}</span>}</div><div className="mt-1 pl-8 text-xs text-slate-400">{product?.category || "待补类目"}</div></td><td className="px-4 py-3">{productSkus.length}</td><td className="max-w-56 px-4 py-3 text-xs text-slate-600">{productSkus.slice(0, 4).map((sku) => sku.internalSkuCode).join("、") || "待关联"}{productSkus.length > 4 ? "…" : ""}</td><td className="px-4 py-3 text-xs">主供 {plan.primarySuppliers.length} · 备供 {plan.backupSuppliers.length}<div className="mt-1 text-amber-700">待补 {plan.missingFields.length}</div></td><td className="px-4 py-3">{product?.portfolioStatus === "active" ? "继续经营" : product?.portfolioStatus === "optimize" ? "需要优化" : product?.portfolioStatus === "discontinued" ? "淘汰" : "观察"}</td><td className="px-4 py-3 text-xs text-slate-500">{metricSummary.source === "pending" ? "待采集" : `净销量 ${metricSummary.monthlySales ?? 0}`}<div className="mt-1">{metricSummary.erpCostPrice != null ? `ERP成本基准 ${metricSummary.erpCostPrice}` : "ERP成本待采集"}</div><div className="mt-1">{metricSummary.returnRate != null ? `退货率 ${metricSummary.returnRate}%` : "退货率待采集"}</div><div className="mt-1 text-[11px] text-slate-400">来源：{metricSummary.source === "pending" ? "待录入" : "聚水潭月度表"}</div>{comparison.delta.monthlySales != null ? <div className={`mt-1 text-[11px] ${comparison.delta.monthlySales >= 0 ? "text-emerald-700" : "text-red-600"}`}>较上月 {comparison.delta.monthlySales >= 0 ? "+" : ""}{comparison.delta.monthlySales}</div> : null}</td></tr>{expanded ? <tr className="bg-paper-warm/30"><td className="px-4 py-3" colSpan={6}><div className="mb-2 text-xs text-slate-500">录入 {selectedPeriod}；聚水潭导入数据保存为历史快照，产品主表不做财务利润核算。</div><div className="space-y-2">{productSkus.map((sku) => { const draft = draftFor(sku); return <div className="rounded border border-line bg-white px-3 py-2" key={sku.id}><div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-medium text-slate-800">{sku.internalSkuCode}</span><span className="text-slate-500">{sku.specification || "规格待补"}</span></div><div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><SkuMetricInput label="净销量" value={draft.monthlySales} onChange={(value) => updateDraft(sku.id, "monthlySales", value)} /><SkuMetricInput label="净销售额" value={draft.salesAmount} onChange={(value) => updateDraft(sku.id, "salesAmount", value)} /><SkuMetricInput label="ERP成本价" value={draft.erpCostPrice} onChange={(value) => updateDraft(sku.id, "erpCostPrice", value)} /><SkuMetricInput label="实退数量" value={draft.returnQuantity} onChange={(value) => updateDraft(sku.id, "returnQuantity", value)} /><SkuMetricInput label="退货率%" value={draft.returnRate} onChange={(value) => updateDraft(sku.id, "returnRate", value)} /></div></div>; })}</div></td></tr> : null}</Fragment>;
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-line bg-white p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div></div>;
}

function SourceNote({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-lg border border-line bg-white px-3 py-2"><div className="font-medium text-slate-700">{title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div></div>;
}

function SkuMetricInput({ label, value, onChange }: { label: string; value?: number; onChange: (value?: number) => void }) {
  return <label className="text-[11px] text-slate-500">{label}<input className="mt-1 w-full rounded border border-line px-2 py-1 text-xs text-slate-800" min="0" onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} type="number" value={value ?? ""} /></label>;
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
    returnRate: metrics.returnRate
  };
}

async function readJushuitanWorkbook(file: File): Promise<{ rows: unknown[][]; sheetName: string }> {
  const buffer = await file.arrayBuffer();
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("文件没有可读取的工作表");
    return { rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "" }), sheetName };
  } catch {
    return readXlsxXmlFallback(buffer);
  }
}

function readXlsxXmlFallback(buffer: ArrayBuffer): { rows: unknown[][]; sheetName: string } {
  const files = unzipSync(new Uint8Array(buffer));
  const sheetXml = files["xl/worksheets/sheet1.xml"];
  if (!sheetXml) throw new Error("文件没有可读取的第一张工作表");
  const xml = new TextDecoder().decode(sheetXml).replace(/^\uFEFF/, "");
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("Excel 工作表格式无法读取");
  const namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const rowNodes = Array.from(document.getElementsByTagNameNS(namespace, "row"));
  const rows: unknown[][] = [];
  for (const rowNode of rowNodes) {
    const values: unknown[] = [];
    for (const cell of Array.from(rowNode.getElementsByTagNameNS(namespace, "c"))) {
      const reference = cell.getAttribute("r") ?? "";
      const column = reference.match(/^[A-Z]+/)?.[0] ?? "A";
      const index = columnLettersToIndex(column);
      const inlineText = cell.getElementsByTagNameNS(namespace, "t")[0]?.textContent ?? "";
      const value = cell.getElementsByTagNameNS(namespace, "v")[0]?.textContent ?? "";
      values[index] = cell.getAttribute("t") === "inlineStr" ? inlineText : value;
    }
    rows.push(values);
  }
  return { rows, sheetName: "Sheet1" };
}

function columnLettersToIndex(value: string): number {
  return value.split("").reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}
