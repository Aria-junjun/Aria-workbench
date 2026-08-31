"use client";

import { useEffect, useMemo, useState } from "react";
import type { LocalSkuMaster, LocalSupplier } from "@/features/workbench/local-store";
import { deriveProductFamilyKey } from "@/features/workbench/product-master";
import type { LocalProductSupplierAssignment } from "@/features/workbench/local-store";
import type { SupplierInboundImportResult } from "@/features/workbench/supplier-inbound-import";
import { summarizeImportQuality } from "@/features/workbench/import-data-quality";

export type ConfirmedInboundRow = {
  skuMasterId: string;
  productFamilyKey?: string;
  mappingLevel?: "sku" | "product_family";
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
  existingAssignments?: LocalProductSupplierAssignment[];
  onCancel: () => void;
  onConfirm: (rows: ConfirmedInboundRow[]) => void;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s*×xX·＋+\-_/（）()]/g, "");
}

function dimensionSignature(value: string) {
  const numbers = value.match(/\d+(?:\.\d+)?/g) ?? [];
  return numbers.length >= 2 ? numbers.join("x") : undefined;
}

type MatchingOptions = {
  supplierId?: string;
  supplierName?: string;
  period?: string;
  assignments?: LocalProductSupplierAssignment[];
};

export function suggestInboundSku(
  row: { supplierProductName: string; supplierSpec: string },
  skuMasters: LocalSkuMaster[],
  options: MatchingOptions = {},
) {
  const product = normalize(row.supplierProductName);
  const spec = normalize(row.supplierSpec);
  const signature = dimensionSignature(row.supplierSpec);
  const dimensionMatches = skuMasters.filter((sku) => {
    const skuSpec = normalize(sku.specification);
    return skuSpec === spec || (signature !== undefined && dimensionSignature(sku.specification) === signature);
  });
  const namedCandidates = dimensionMatches.filter((sku) => normalize(sku.productName) === product);
  if (namedCandidates.length === 1) return namedCandidates[0].id;
  if (namedCandidates.length > 1) return undefined;

  const assignedFamilyKeys = new Set((options.assignments ?? [])
    .filter((assignment) => assignment.status === "active")
    .filter((assignment) => !options.period || assignment.effectiveFrom <= options.period)
    .filter((assignment) => !options.period || !assignment.effectiveTo || assignment.effectiveTo >= options.period)
    .filter((assignment) => options.supplierId ? assignment.supplierId === options.supplierId : normalize(assignment.supplierName ?? "") === normalize(options.supplierName ?? ""))
    .map((assignment) => assignment.productFamilyKey));
  if (assignedFamilyKeys.size === 0) return undefined;
  const relationshipCandidates = dimensionMatches.filter((sku) => assignedFamilyKeys.has(deriveProductFamilyKey(sku.productName, sku.productFamilyKey)));
  return relationshipCandidates.length === 1 ? relationshipCandidates[0].id : undefined;
}

export type InboundMappingSuggestion =
  | { kind: "sku"; skuMasterId: string }
  | { kind: "product_family"; productFamilyKey: string; skuMasterId: string };

/** 有唯一有效供应关系时按产品族归属，避免把一笔入仓量错误复制到多个 SKU。 */
export function suggestInboundMapping(
  row: { supplierProductName: string; supplierSpec: string },
  skuMasters: LocalSkuMaster[],
  options: MatchingOptions = {},
): InboundMappingSuggestion | undefined {
  const supplierAssignments = (options.assignments ?? [])
    .filter((assignment) => assignment.status === "active")
    .filter((assignment) => !options.period || assignment.effectiveFrom <= options.period)
    .filter((assignment) => !options.period || !assignment.effectiveTo || assignment.effectiveTo >= options.period)
    .filter((assignment) => options.supplierId
      ? assignment.supplierId === options.supplierId
      : normalize(assignment.supplierName ?? "") === normalize(options.supplierName ?? ""));
  const familyKeys = [...new Set(supplierAssignments.map((assignment) => assignment.productFamilyKey).filter(Boolean))];
  const familyCandidates = familyKeys.flatMap((familyKey) => {
    const familySkus = skuMasters.filter((sku) => deriveProductFamilyKey(sku.productName, sku.productFamilyKey) === familyKey);
    return familySkus.length ? [{ familyKey, skuMasterId: familySkus[0].id }] : [];
  });
  if (familyCandidates.length === 1) {
    return { kind: "product_family", productFamilyKey: familyCandidates[0].familyKey, skuMasterId: familyCandidates[0].skuMasterId };
  }
  const skuMasterId = suggestInboundSku(row, skuMasters, options);
  return skuMasterId ? { kind: "sku", skuMasterId } : undefined;
}

export function SupplierInboundImportPreview({ result, period, fileName, sheetName, skuMasters, suppliers, existingAssignments = [], onCancel, onConfirm }: Props) {
  const [supplierId, setSupplierId] = useState(() => {
    const embeddedName = result.rows.find((row) => row.supplierName)?.supplierName;
    return suppliers.find((supplier) => supplier.name === embeddedName)?.id ?? "";
  });
  const supplierFromFile = result.rows.find((row) => row.supplierName)?.supplierName;
  const skuSignature = skuMasters.map((sku) => `${sku.id}:${sku.productName}:${sku.specification}:${sku.productFamilyKey ?? ""}`).join("|");
  const assignmentSignature = existingAssignments.map((assignment) => `${assignment.id}:${assignment.productFamilyKey}:${assignment.supplierId ?? ""}:${assignment.supplierName ?? ""}:${assignment.effectiveFrom}:${assignment.effectiveTo ?? ""}:${assignment.status}`).join("|");
  const initialMatches = useMemo(() => Object.fromEntries(result.rows.map((row) => {
    const suggestion = suggestInboundMapping(row, skuMasters, {
    supplierId,
    supplierName: supplierFromFile,
    period,
    assignments: existingAssignments,
    });
    return [row.rowNumber, suggestion?.kind === "product_family" ? `family:${suggestion.productFamilyKey}` : suggestion?.skuMasterId];
  })), [result.rows, skuSignature, supplierId, supplierFromFile, period, assignmentSignature]);
  const [matches, setMatches] = useState<Record<number, string | undefined>>(initialMatches);
  useEffect(() => setMatches(initialMatches), [initialMatches]);
  const matchedCount = result.rows.filter((row) => matches[row.rowNumber]).length;
  const futureRelationshipCount = existingAssignments.filter((assignment) => {
    const supplierMatches = supplierId
      ? assignment.supplierId === supplierId
      : normalize(assignment.supplierName ?? "") === normalize(supplierFromFile ?? "");
    return supplierMatches && assignment.status === "active" && assignment.effectiveFrom > period;
  }).length;
  const quality = summarizeImportQuality({
    sourceLabel: "入仓表",
    totalRows: result.summary.rawRowCount ?? result.rows.length,
    validRows: result.rows.length,
    matchedRows: matchedCount,
    issueRows: result.errors.length,
    duplicateRows: 0,
    mergedRows: Math.max(0, (result.summary.rawRowCount ?? result.rows.length) - result.rows.length),
    period,
  });

  function confirm() {
    const supplier = suppliers.find((item) => item.id === supplierId);
    onConfirm(result.rows.flatMap((row) => {
      const match = matches[row.rowNumber];
      if (!match) return [];
      const familyKey = match.startsWith("family:") ? match.slice("family:".length) : undefined;
      const skuMasterId = familyKey
        ? skuMasters.find((sku) => deriveProductFamilyKey(sku.productName, sku.productFamilyKey) === familyKey)?.id
        : match;
      if (!skuMasterId) return [];
      return [{
        skuMasterId,
        ...(familyKey ? { productFamilyKey: familyKey, mappingLevel: "product_family" as const } : { mappingLevel: "sku" as const }),
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
        <div className="text-xs text-slate-600">原始 {result.summary.rawRowCount ?? result.rows.length} 行 · 合并后 {result.rows.length} 行 · 已关联 {matchedCount} 行 · 待确认 {result.rows.length - matchedCount} 行</div>
      </div>
      <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
        本次只保存表格明确证明的实际入仓数量。若该供应商与一个产品族存在唯一有效关系，系统会自动按产品族归属并合并入仓量；没有唯一关系时才回退到 SKU 匹配。未关联行不会写入；没有供应商名称时，请先为整张表选择供应商。
      </div>
      <div className={`rounded-lg px-3 py-2 text-xs leading-5 ${quality.status === "ready" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
        <div className="font-medium">数据质量检查：{quality.headline}</div>
        <div className="mt-1">{quality.details.join(" · ")}。产品族级关联会合并保存入仓总量，不会拆分或复制到每个 SKU。</div>
      </div>
      {!matchedCount && futureRelationshipCount > 0 ? <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
        已找到该供应商的供应关系，但关系生效月份晚于本次导入月份（{period}）。系统不会把未来关系倒灌到历史数据；请确认保存月份，或将关系生效月份修正为真实生效月份。
      </div> : null}
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
                <select aria-label={`第${row.rowNumber}行对应产品族或SKU`} className="w-full rounded border border-line px-2 py-1" value={matches[row.rowNumber] ?? ""} onChange={(event) => setMatches((current) => ({ ...current, [row.rowNumber]: event.target.value || undefined }))}>
                  <option value="">暂不关联</option>
                  {[...new Map(skuMasters.filter((sku) => sku.status !== "archived").map((sku) => [deriveProductFamilyKey(sku.productName, sku.productFamilyKey), sku])).entries()].map(([familyKey, sku]) => <option key={`family:${familyKey}`} value={`family:${familyKey}`}>产品族：{familyKey}</option>)}
                  {skuMasters.filter((sku) => sku.status !== "archived").map((sku) => <option key={sku.id} value={sku.id}>SKU：{sku.internalSkuCode} · {sku.productName} · {sku.specification}</option>)}
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
