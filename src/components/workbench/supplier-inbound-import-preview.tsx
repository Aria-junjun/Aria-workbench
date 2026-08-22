"use client";

import { useMemo, useState } from "react";
import type { LocalSkuMaster, LocalSupplier } from "@/features/workbench/local-store";
import type { SupplierInboundImportResult } from "@/features/workbench/supplier-inbound-import";

export type ConfirmedInboundRow = {
  skuMasterId: string;
  period: string;
  receivedQuantity: number;
  supplierId?: string;
  supplierName?: string;
  sourceFileName: string;
  sourceSheetName: string;
  importedAt: string;
};

type Props = {
  result: SupplierInboundImportResult;
  period: string;
  fileName: string;
  sheetName: string;
  skuMasters: LocalSkuMaster[];
  suppliers: LocalSupplier[];
  onCancel: () => void;
  onConfirm: (rows: ConfirmedInboundRow[]) => void;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s*×xX·＋+\-_/（）()]/g, "");
}

export function suggestInboundSku(row: { supplierProductName: string; supplierSpec: string }, skuMasters: LocalSkuMaster[]) {
  const product = normalize(row.supplierProductName);
  const spec = normalize(row.supplierSpec);
  return skuMasters.find((sku) => normalize(sku.productName) === product && normalize(sku.specification) === spec)?.id;
}

export function SupplierInboundImportPreview({ result, period, fileName, sheetName, skuMasters, suppliers, onCancel, onConfirm }: Props) {
  const initialMatches = useMemo(() => Object.fromEntries(result.rows.map((row) => [row.rowNumber, suggestInboundSku(row, skuMasters)])), [result.rows, skuMasters]);
  const [matches, setMatches] = useState<Record<number, string | undefined>>(initialMatches);
  const [supplierId, setSupplierId] = useState(() => {
    const embeddedName = result.rows.find((row) => row.supplierName)?.supplierName;
    return suppliers.find((supplier) => supplier.name === embeddedName)?.id ?? "";
  });
  const supplierFromFile = result.rows.find((row) => row.supplierName)?.supplierName;
  const matchedCount = result.rows.filter((row) => matches[row.rowNumber]).length;

  function confirm() {
    const supplier = suppliers.find((item) => item.id === supplierId);
    onConfirm(result.rows.flatMap((row) => {
      const skuMasterId = matches[row.rowNumber];
      if (!skuMasterId) return [];
      return [{
        skuMasterId,
        period,
        receivedQuantity: row.receivedQuantity,
        supplierId: supplier?.id,
        supplierName: supplier?.name ?? supplierFromFile,
        sourceFileName: row.sourceFileName,
        sourceSheetName: row.sourceSheetName,
        importedAt: row.importedAt
      }];
    }));
  }

  return (
    <section className="space-y-3 rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-800">供应商月度实际入仓预览</h2>
          <p className="mt-1 text-xs text-slate-500">{fileName} · {sheetName} · 保存月份 {period}</p>
        </div>
        <div className="text-xs text-slate-600">识别 {result.rows.length} 行 · 已匹配 {matchedCount} 行 · 待确认 {result.rows.length - matchedCount} 行</div>
      </div>
      <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
        本次只保存表格明确证明的实际入仓数量。没有供应商名称时，请先为整张表选择供应商；未匹配 SKU 的行不会写入。
      </div>
      {!supplierFromFile ? (
        <label className="block text-xs text-slate-600">
          本批对账供应商
          <select className="mt-1 w-full rounded border border-line px-2 py-2 text-sm" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">请选择供应商</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
      ) : <p className="text-xs text-slate-600">表格供应商：{supplierFromFile}</p>}
      {result.errors.length ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{result.errors.map((item) => `第${item.rowNumber}行：${item.message}`).join("；")}</p> : null}
      <div className="max-h-96 overflow-auto rounded-lg border border-line">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-paper-warm text-slate-500"><tr><th className="px-3 py-2">供应商商品</th><th className="px-3 py-2">供应商规格</th><th className="px-3 py-2">实际入仓</th><th className="px-3 py-2">对应内部 SKU</th></tr></thead>
          <tbody className="divide-y divide-line">
            {result.rows.map((row) => <tr key={row.rowNumber}>
              <td className="px-3 py-2">{row.supplierProductName}</td>
              <td className="px-3 py-2">{row.supplierSpec}</td>
              <td className="px-3 py-2">{row.receivedQuantity}{row.unit ? ` ${row.unit}` : ""}</td>
              <td className="px-3 py-2">
                <select aria-label={`第${row.rowNumber}行对应内部SKU`} className="w-full rounded border border-line px-2 py-1" value={matches[row.rowNumber] ?? ""} onChange={(event) => setMatches((current) => ({ ...current, [row.rowNumber]: event.target.value || undefined }))}>
                  <option value="">暂不关联</option>
                  {skuMasters.filter((sku) => sku.status !== "archived").map((sku) => <option key={sku.id} value={sku.id}>{sku.internalSkuCode} · {sku.productName} · {sku.specification}</option>)}
                </select>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <button className="rounded-md border border-line px-3 py-2 text-sm" onClick={onCancel} type="button">取消</button>
        <button className="rounded-md bg-action px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!matchedCount || (!supplierFromFile && !supplierId)} onClick={confirm} type="button">确认保存 {matchedCount} 行</button>
      </div>
    </section>
  );
}
