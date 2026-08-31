"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { parseSkuMasterRows, type SkuMasterImportResult } from "@/features/workbench/sku-master-import";
import { archiveSkuMaster, confirmSkuImportBatch, confirmSkuOfferLink, loadLocalWorkbenchData, revokeSkuOfferLink, saveProductSupplierAssignments, saveSkuMasterImport, updateSkuMaster, type LocalSkuMaster } from "@/features/workbench/local-store";
import { deriveOperatingProductCode, deriveProductFamilyKey } from "@/features/workbench/product-master";
import { findSkuOfferMatches } from "@/features/workbench/sku-master-matching";
import { useWorkbenchData } from "@/features/workbench/workbench-store";

export default function SkuMasterImportPage() {
  const [preview, setPreview] = useState<SkuMasterImportResult | null>(null);
  const [fileMeta, setFileMeta] = useState<{ fileName: string; sheetName: string } | null>(null);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const initialData = loadLocalWorkbenchData();
  const [skuMasters, setSkuMasters] = useState<LocalSkuMaster[]>(initialData.skuMasters ?? []);
  const [batches, setBatches] = useState(initialData.skuImportBatches ?? []);
  const [confirmedLinks, setConfirmedLinks] = useState(initialData.skuOfferLinks ?? []);
  const [manualSkuId, setManualSkuId] = useState(skuMasters[0]?.id ?? "");
  const [manualQuery, setManualQuery] = useState("");
  const [showSecondaryAssociationTools, setShowSecondaryAssociationTools] = useState(false);
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);
  const [batchFamilyKey, setBatchFamilyKey] = useState("");
  const [batchSupplierId, setBatchSupplierId] = useState("");
  const [batchMessage, setBatchMessage] = useState("");
  const activeSkuMasters = skuMasters.filter((item) => item.status !== "archived");
  const existingCount = activeSkuMasters.length;
  const workbench = useWorkbenchData();
  const offers = workbench.offers;
  const suppliers = workbench.suppliers;
  const allInternalSkuCodes = activeSkuMasters.map((item) => item.internalSkuCode);
  const productFamilies = [...new Set(activeSkuMasters.map((item) => deriveProductFamilyKey(item.productName, item.productFamilyKey)))].sort((left, right) => left.localeCompare(right, "zh-CN"));
  const matchSummary = useMemo(() => {
    const results = activeSkuMasters.map((item) => ({ item, matches: findSkuOfferMatches(item, offers) }));
    return {
      results,
      high: results.filter((result) => result.matches.some((match) => match.confidence === "high")).length,
      review: results.filter((result) => result.matches.length > 0 && !result.matches.some((match) => match.confidence === "high")).length,
      none: results.filter((result) => result.matches.length === 0).length
    };
  }, [activeSkuMasters, offers]);
  const manualOffers = useMemo(() => {
    const query = manualQuery.trim().toLowerCase();
    return offers.filter((offer) => !query || [offer.name, offer.productName, offer.supplierName, offer.category].filter(Boolean).some((value) => value!.toLowerCase().includes(query))).slice(0, 30);
  }, [manualQuery, offers]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setSavedMessage("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("文件没有可读取的工作表");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
      setPreview(parseSkuMasterRows(rows, {
        fileName: file.name,
        sheetName,
        importedAt: new Date().toISOString()
      }));
      setFileMeta({ fileName: file.name, sheetName });
    } catch (cause) {
      setPreview(null);
      setFileMeta(null);
      setError(cause instanceof Error ? cause.message : "文件读取失败，请确认是包含三列字段的 Excel 文件");
    }
  }

  function savePendingImport() {
    if (!preview || !fileMeta) return;
    const batch = saveSkuMasterImport({
      fileName: fileMeta.fileName,
      sheetName: fileMeta.sheetName,
      importedAt: new Date().toISOString(),
      rows: preview.rows,
      warningRows: preview.warnings.length,
      errorRows: preview.errors.length
    });
    const refreshed = loadLocalWorkbenchData();
    setSkuMasters(refreshed.skuMasters ?? []);
    setBatches(refreshed.skuImportBatches ?? []);
    setSavedMessage(`已保存到待确认区：${batch.importedRows} 条；原有货盘和报价未被修改。`);
    setPreview(null);
    setFileMeta(null);
  }

  function saveSpecification(item: LocalSkuMaster, specification: string) {
    updateSkuMaster(item.id, { specification, status: specification.trim() ? "ready" : "needs_spec" });
    setSkuMasters((current) => current.map((row) => row.id === item.id ? { ...row, specification, status: specification.trim() ? "ready" : "needs_spec" } : row));
  }

  function archiveSku(item: LocalSkuMaster) {
    if (!window.confirm(`确定停用 SKU ${item.internalSkuCode} 吗？历史经营数据、货盘关联和决策记录会保留。`)) return;
    archiveSkuMaster(item.id);
    setSkuMasters((current) => current.map((row) => row.id === item.id ? { ...row, status: "archived" as const } : row));
    setManualSkuId((current) => current === item.id ? (activeSkuMasters.find((row) => row.id !== item.id)?.id ?? "") : current);
    setSavedMessage(`已停用 ${item.internalSkuCode}；历史快照和关联记录仍保留。`);
  }

  function applyBatchSupplierMapping() {
    if (!selectedSkuIds.length || !batchFamilyKey || !batchSupplierId) return;
    const supplier = suppliers.find((item) => item.id === batchSupplierId);
    if (!supplier) return;
    saveProductSupplierAssignments([{
      productFamilyKey: batchFamilyKey,
      supplierId: supplier.id,
      supplierName: supplier.name,
      role: "primary",
      effectiveFrom: new Date().toISOString().slice(0, 7),
      status: "active",
      source: "manual",
      reason: "由产品编码表批量建立产品族供货关系",
      evidence: `已选择 ${selectedSkuIds.length} 个 SKU 作为产品族编码归并依据`,
    }]);
    setBatchMessage(`已将 ${selectedSkuIds.length} 个 SKU 归入产品族“${batchFamilyKey}”，主供供应商为“${supplier.name}”。经营产品编码按基础编码自动归并。`);
    setSelectedSkuIds([]);
  }

  function confirmLatestBatch() {
    const batch = batches[0];
    if (!batch) return;
    confirmSkuImportBatch(batch.id);
    setBatches((current) => current.map((row) => row.id === batch.id ? { ...row, status: "confirmed" as const } : row));
    setSavedMessage("产品主表已确认。下一步可以开始按内部编码关联货盘报价。");
  }

  function confirmCandidate(skuMasterId: string, offerId: string, offerSkuId?: string) {
    confirmSkuOfferLink(skuMasterId, offerId, offerSkuId);
    setConfirmedLinks(loadLocalWorkbenchData().skuOfferLinks ?? []);
  }

  function revokeCandidate(linkId: string) {
    revokeSkuOfferLink(linkId);
    setConfirmedLinks(loadLocalWorkbenchData().skuOfferLinks ?? []);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link className="text-sm text-action hover:underline" href="/offers">← 返回货盘库</Link>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">导入产品编码表</h1>
          <p className="mt-1 text-sm text-slate-500">先进入待确认区，用公司内部编码建立产品主表，不会覆盖现有货盘报价。</p>
        </div>
        <div className="rounded-2xl bg-paper-warm px-4 py-3 text-right text-xs text-slate-600">
          <div>当前主表 {existingCount} 条</div>
          <div className="mt-1 text-slate-400">数据源：商品编码 / 商品名称 / 颜色及规格</div>
        </div>
      </div>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-slate-900">选择 Excel 文件</h2>
            <p className="mt-1 text-sm text-slate-500">只读取第一个工作表的前三列，表头必须完全匹配。</p>
          </div>
          <label className="cursor-pointer rounded-xl bg-action px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            选择表格
            <input accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} type="file" />
          </label>
        </div>
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {savedMessage ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedMessage}</p> : null}
      </section>

      {preview ? (
        <section className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium text-slate-900">导入预览</h2>
              <p className="mt-1 text-sm text-slate-500">{fileMeta?.fileName} · {fileMeta?.sheetName}</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">可导入 {preview.rows.length}</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">待补规格 {preview.warnings.length}</span>
              <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">跳过 {preview.errors.length}</span>
            </div>
          </div>
          {preview.warnings.length > 0 ? <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">空规格仍会保留，但状态标记为“规格待补充”：{preview.warnings.map((item) => item.code).join("、")}</div> : null}
          {preview.errors.length > 0 ? <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">有 {preview.errors.length} 行未写入：{preview.errors.slice(0, 3).map((item) => `第${item.rowNumber}行${item.message}`).join("；")}</div> : null}
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-paper-warm text-left text-xs text-slate-500"><tr><th className="px-3 py-2">商品编码</th><th className="px-3 py-2">商品名称</th><th className="px-3 py-2">颜色及规格</th><th className="px-3 py-2">状态</th></tr></thead>
              <tbody className="divide-y divide-line">{preview.rows.slice(0, 12).map((row) => <tr key={`${row.internalSkuCode}-${row.rowNumber}`}><td className="px-3 py-2 font-medium">{row.internalSkuCode}</td><td className="px-3 py-2">{row.productName}</td><td className="px-3 py-2">{row.specification || "-"}</td><td className="px-3 py-2 text-xs">{row.status === "ready" ? "可用" : "规格待补充"}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2"><button className="rounded-xl border border-line px-4 py-2 text-sm" onClick={() => setPreview(null)} type="button">取消</button><button className="rounded-xl bg-action px-4 py-2 text-sm font-medium text-white" onClick={savePendingImport} type="button">保存到待确认区</button></div>
        </section>
      ) : null}

      {activeSkuMasters.length > 0 ? (
        <section className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium text-slate-900">待确认产品主表</h2>
              <p className="mt-1 text-sm text-slate-500">编码是内部产品键；这里暂不录入系统售价，也不要求供应商编码。</p>
            </div>
            {batches[0]?.status === "pending_review" ? <button className="rounded-xl bg-action px-4 py-2 text-sm font-medium text-white" onClick={confirmLatestBatch} type="button">确认主表</button> : <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">已确认</span>}
          </div>
          <div className="rounded-2xl bg-paper-warm p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-medium text-slate-900">批量归属产品族与供应商</h3><p className="mt-1 text-xs text-slate-500">先勾选同一产品族的 SKU，再统一选择产品族和主供供应商；不会改变销售数据的 SKU 编码。</p></div>
              <span className="text-xs text-slate-500">已选 {selectedSkuIds.length} 条</span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <select aria-label="批量选择产品族" className="rounded-xl border border-line bg-white px-3 py-2 text-sm" value={batchFamilyKey} onChange={(event) => setBatchFamilyKey(event.target.value)}><option value="">选择产品族</option>{productFamilies.map((family) => <option key={family} value={family}>{family}</option>)}</select>
              <select aria-label="批量选择供应商" className="rounded-xl border border-line bg-white px-3 py-2 text-sm" value={batchSupplierId} onChange={(event) => setBatchSupplierId(event.target.value)}><option value="">选择主供供应商</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
              <button className="rounded-xl bg-action px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!selectedSkuIds.length || !batchFamilyKey || !batchSupplierId} onClick={applyBatchSupplierMapping} type="button">保存归属</button>
            </div>
            {batchMessage ? <p className="mt-3 text-xs text-emerald-700">{batchMessage}</p> : null}
          </div>
          <div className="max-h-[520px] overflow-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-paper-warm text-left text-xs text-slate-500"><tr><th className="w-10 px-3 py-2"><input aria-label="全选 SKU" checked={selectedSkuIds.length === activeSkuMasters.length} onChange={(event) => setSelectedSkuIds(event.target.checked ? activeSkuMasters.map((item) => item.id) : [])} type="checkbox" /></th><th className="px-3 py-2">商品编码</th><th className="px-3 py-2">经营产品编码</th><th className="px-3 py-2">商品名称</th><th className="px-3 py-2">颜色及规格</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">操作</th></tr></thead>
              <tbody className="divide-y divide-line">{activeSkuMasters.map((item) => <SkuMasterRow item={item} key={item.id} checked={selectedSkuIds.includes(item.id)} operatingProductCode={deriveOperatingProductCode(item.internalSkuCode, item.productName, item.specification, allInternalSkuCodes)} matches={matchSummary.results.find((result) => result.item.id === item.id)?.matches.length ?? 0} onToggle={(checked) => setSelectedSkuIds((current) => checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))} onArchive={archiveSku} onSaveSpecification={saveSpecification} />)}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeSkuMasters.length > 0 ? (
        <section className="rounded-3xl border border-line bg-white p-4 shadow-sm">
          <button className="flex w-full items-center justify-between gap-4 text-left" onClick={() => setShowSecondaryAssociationTools((current) => !current)} type="button">
            <div>
              <h2 className="font-medium text-slate-900">关联记录与预检（次级区域）</h2>
              <p className="mt-1 text-sm text-slate-500">日常只看产品主表；这里保留已保存关联的审计、撤销和批量匹配复核。</p>
            </div>
            <span className="shrink-0 rounded-xl border border-line px-3 py-2 text-sm text-action">{showSecondaryAssociationTools ? "收起" : "展开"}</span>
          </button>
        </section>
      ) : null}

      {showSecondaryAssociationTools && confirmedLinks.some((link) => link.status === "confirmed") ? (
        <section className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div><h2 className="font-medium text-slate-900">已保存的规格对应关系</h2><p className="mt-1 text-sm text-slate-500">这张表是后续按内部编码比较供应商报价的依据；供应商规格保留原文，不会被内部编码覆盖。</p></div>
          <div className="overflow-x-auto rounded-2xl border border-line"><table className="w-full text-sm"><thead className="bg-paper-warm text-left text-xs text-slate-500"><tr><th className="px-3 py-2">内部编码</th><th className="px-3 py-2">内部规格</th><th className="px-3 py-2">供应商</th><th className="px-3 py-2">货盘</th><th className="px-3 py-2">供应商货盘规格</th><th className="px-3 py-2">供应商成本</th><th className="px-3 py-2">操作</th></tr></thead><tbody className="divide-y divide-line">{confirmedLinks.filter((link) => link.status === "confirmed").map((link) => { const sku = skuMasters.find((item) => item.id === link.skuMasterId); const offer = offers.find((item) => item.id === link.offerId); const offerSku = offer?.skus?.find((item) => item.id === link.offerSkuId); return <tr key={link.id}><td className="whitespace-nowrap px-3 py-2 font-medium">{sku?.internalSkuCode || "-"}</td><td className="px-3 py-2">{sku?.specification || "待补充"}</td><td className="px-3 py-2">{offer?.supplierName || "未关联供应商"}</td><td className="px-3 py-2">{offer?.name || "货盘已删除"}</td><td className="px-3 py-2">{offerSku ? `${offerSku.specName}${offerSku.specCode ? ` · ${offerSku.specCode}` : ""}` : "货盘级关联"}</td><td className="px-3 py-2">{offerSku?.unitPriceStr || (offerSku?.unitPrice != null ? `¥${offerSku.unitPrice}` : "未记录")}</td><td className="px-3 py-2"><button className="text-xs text-red-600 hover:underline" onClick={() => revokeCandidate(link.id)} type="button">撤销</button></td></tr>; })}</tbody></table></div>
        </section>
      ) : null}

      {activeSkuMasters.length > 0 && matchSummary.results.some((result) => result.matches.length > 0) ? (
        <section className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div><h2 className="font-medium text-slate-900">货盘关联确认表</h2><p className="mt-1 text-sm text-slate-500">确认后只新增独立关联记录，不修改原货盘名称、供应商报价或供应商编码。</p></div>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm"><thead className="bg-paper-warm text-left text-xs text-slate-500"><tr><th className="px-3 py-2">内部编码</th><th className="px-3 py-2">产品名称</th><th className="px-3 py-2">候选货盘</th><th className="px-3 py-2">供应商</th><th className="px-3 py-2">判断</th><th className="px-3 py-2">操作</th></tr></thead>
              <tbody className="divide-y divide-line">{matchSummary.results.flatMap((result) => result.matches.map((match) => {
                const linked = confirmedLinks.some((link) => link.status === "confirmed" && link.skuMasterId === result.item.id && link.offerId === match.offerId);
                return <tr key={`${result.item.id}-${match.offerId}`}><td className="whitespace-nowrap px-3 py-2 font-medium">{result.item.internalSkuCode}</td><td className="px-3 py-2">{result.item.productName}</td><td className="px-3 py-2">{match.offerName}</td><td className="px-3 py-2">{match.supplierName || "未关联供应商"}</td><td className="px-3 py-2 text-xs">{match.reason}</td><td className="px-3 py-2">{linked ? <span className="text-xs text-emerald-700">已确认</span> : <button className="rounded-lg border border-line px-2 py-1 text-xs text-action hover:bg-paper-warm" onClick={() => confirmCandidate(result.item.id, match.offerId)} type="button">确认关联</button>}</td></tr>;
              }))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeSkuMasters.length > 0 ? (
        <section className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div><h2 className="font-medium text-slate-900">手动关联货盘</h2><p className="mt-1 text-sm text-slate-500">用于历史货盘没有内部编码的情况。先选内部编码，再按货盘名称或供应商搜索，确认后建立关联。</p></div>
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)]">
            <select className="rounded-xl border border-line px-3 py-2 text-sm" onChange={(event) => setManualSkuId(event.target.value)} value={manualSkuId}><option value="">选择内部产品编码</option>{activeSkuMasters.map((item) => <option key={item.id} value={item.id}>{item.internalSkuCode} · {item.productName}</option>)}</select>
            <input className="rounded-xl border border-line px-3 py-2 text-sm" onChange={(event) => setManualQuery(event.target.value)} placeholder="搜索货盘名称、产品名称或供应商" value={manualQuery} />
          </div>
          <div className="max-h-96 overflow-auto rounded-2xl border border-line"><table className="w-full text-sm"><thead className="sticky top-0 bg-paper-warm text-left text-xs text-slate-500"><tr><th className="px-3 py-2">货盘</th><th className="px-3 py-2">产品名称</th><th className="px-3 py-2">供应商</th><th className="px-3 py-2">货盘 SKU / 操作</th></tr></thead><tbody className="divide-y divide-line">{manualOffers.map((offer) => { const offerLinks = confirmedLinks.filter((link) => link.status === "confirmed" && link.skuMasterId === manualSkuId && link.offerId === offer.id); const activeOfferLink = offerLinks.find((link) => !link.offerSkuId); return <tr key={offer.id}><td className="px-3 py-2">{offer.name}</td><td className="px-3 py-2">{offer.productName || "-"}</td><td className="px-3 py-2">{offer.supplierName || "-"}</td><td className="min-w-[260px] px-3 py-2">{offer.skus?.length ? <div className="space-y-1">{offer.skus.map((sku) => { const link = offerLinks.find((item) => item.offerSkuId === sku.id); return <div className="flex items-center justify-between gap-2" key={sku.id}><span className="truncate text-xs text-slate-600">{sku.specName}{sku.specCode ? ` · ${sku.specCode}` : ""}</span>{link ? <button className="shrink-0 text-xs text-red-600 hover:underline" onClick={() => revokeCandidate(link.id)} type="button">撤销</button> : <button className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs text-action hover:bg-paper-warm" disabled={!manualSkuId} onClick={() => confirmCandidate(manualSkuId, offer.id, sku.id)} type="button">关联</button>}</div>; })}</div> : activeOfferLink ? <button className="text-xs text-red-600 hover:underline" onClick={() => revokeCandidate(activeOfferLink.id)} type="button">已关联（撤销）</button> : <button className="rounded-lg border border-line px-2 py-1 text-xs text-action hover:bg-paper-warm" disabled={!manualSkuId} onClick={() => confirmCandidate(manualSkuId, offer.id)} type="button">关联货盘</button>}</td></tr>; })}</tbody></table></div>
        </section>
      ) : null}

      {showSecondaryAssociationTools && activeSkuMasters.length > 0 ? (
        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-medium text-slate-900">货盘关联预检</h2><p className="mt-1 text-sm text-slate-500">只生成候选，不会自动修改货盘。高匹配也需要你确认后才建立关联。</p></div>
            <div className="flex gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">高匹配 {matchSummary.high}</span><span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">待确认 {matchSummary.review}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">暂无候选 {matchSummary.none}</span></div>
          </div>
          <p className="mt-4 text-sm text-slate-600">下一步将把这些候选展开成“产品编码 → 货盘 → 供应商 → 成本报价”的确认表，确认后新报价即可按内部编码归集。</p>
        </section>
      ) : null}
    </div>
  );
}

function SkuMasterRow({ item, checked, operatingProductCode, matches, onToggle, onArchive, onSaveSpecification }: { item: LocalSkuMaster; checked: boolean; operatingProductCode: string; matches: number; onToggle: (checked: boolean) => void; onArchive: (item: LocalSkuMaster) => void; onSaveSpecification: (item: LocalSkuMaster, specification: string) => void }) {
  const [draft, setDraft] = useState(item.specification);
  const changed = draft !== item.specification;
  return <tr><td className="px-3 py-2"><input aria-label={`选择 ${item.internalSkuCode}`} checked={checked} onChange={(event) => onToggle(event.target.checked)} type="checkbox" /></td><td className="whitespace-nowrap px-3 py-2 font-medium">{item.internalSkuCode}</td><td className="whitespace-nowrap px-3 py-2 text-action">{operatingProductCode}</td><td className="px-3 py-2">{item.productName}</td><td className="min-w-[240px] px-3 py-2"><input className="w-full rounded-lg border border-line px-2 py-1 text-sm" onChange={(event) => setDraft(event.target.value)} value={draft} />{changed ? <button className="mt-1 text-xs text-action hover:underline" onClick={() => onSaveSpecification(item, draft)} type="button">保存规格</button> : null}</td><td className="whitespace-nowrap px-3 py-2 text-xs">{item.status === "ready" ? <span className="text-emerald-700">可用</span> : item.status === "archived" ? <span className="text-slate-500">已停用</span> : <span className="text-amber-700">规格待补充</span>}<div className="mt-1 text-slate-400">候选货盘 {matches}</div></td><td className="whitespace-nowrap px-3 py-2"><button className="text-xs text-red-600 hover:underline" onClick={() => onArchive(item)} type="button">停用</button></td></tr>;
}
