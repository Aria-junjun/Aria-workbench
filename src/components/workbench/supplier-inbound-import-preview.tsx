"use client";

import { useEffect, useMemo, useState } from "react";
import type { LocalSkuMaster, LocalSupplier, LocalSupplierInboundProductMapping } from "@/features/workbench/local-store";
import { deriveOperatingProductCode, deriveProductFamilyKey } from "@/features/workbench/product-master";
import type { LocalProductSupplierAssignment } from "@/features/workbench/local-store";
import type { SupplierInboundImportResult } from "@/features/workbench/supplier-inbound-import";
import { summarizeImportQuality } from "@/features/workbench/import-data-quality";

export type ConfirmedInboundRow = {
  skuMasterId: string;
  productFamilyKey?: string;
  operatingProductCode?: string;
  mappingLevel?: "sku" | "operating_product";
  period: string;
  receivedQuantity: number;
  settlementUnitPrice?: number;
  settlementAmount?: number;
  supplierId?: string;
  supplierName?: string;
  supplierProductName: string;
  supplierSpec: string;
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
  savedMappings?: LocalSupplierInboundProductMapping[];
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
  savedMappings?: LocalSupplierInboundProductMapping[];
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
  | { kind: "operating_product"; productFamilyKey: string; operatingProductCode: string; skuMasterId: string };

/** 有唯一有效供应关系时，先按规格定位经营产品，再合并其普通 SKU 与组合 SKU。 */
export function suggestInboundMapping(
  row: { supplierProductName: string; supplierSpec: string },
  skuMasters: LocalSkuMaster[],
  options: MatchingOptions = {},
): InboundMappingSuggestion | undefined {
  const saved = options.supplierId ? (options.savedMappings ?? []).filter((mapping) =>
    mapping.supplierId === options.supplierId
      && normalize(mapping.supplierProductName) === normalize(row.supplierProductName)
      && normalize(mapping.supplierSpec) === normalize(row.supplierSpec)) : [];
  if (saved.length === 1) {
    const mapping = saved[0];
    if (mapping.mappingLevel === "operating_product" && mapping.productFamilyKey && mapping.operatingProductCode) {
      const activeSkus = skuMasters.filter((item) => item.status !== "archived");
      const sku = activeSkus.find((item) => item.id === mapping.skuMasterId)
        ?? activeSkus.find((item) => deriveProductFamilyKey(item.productName, item.productFamilyKey) === mapping.productFamilyKey && deriveOperatingProductCode(item.internalSkuCode, item.productName, item.specification, activeSkus.map((skuItem) => skuItem.internalSkuCode)) === mapping.operatingProductCode);
      if (sku) return { kind: "operating_product", productFamilyKey: mapping.productFamilyKey, operatingProductCode: mapping.operatingProductCode, skuMasterId: sku.id };
    }
    if (mapping.mappingLevel === "sku") {
      const sku = skuMasters.find((item) => item.id === mapping.skuMasterId && item.status !== "archived");
      if (sku) return { kind: "sku", skuMasterId: sku.id };
    }
  }
  const supplierAssignments = (options.assignments ?? [])
    .filter((assignment) => assignment.status === "active")
    .filter((assignment) => !options.period || assignment.effectiveFrom <= options.period)
    .filter((assignment) => !options.period || !assignment.effectiveTo || assignment.effectiveTo >= options.period)
    .filter((assignment) => options.supplierId
      ? assignment.supplierId === options.supplierId
      : normalize(assignment.supplierName ?? "") === normalize(options.supplierName ?? ""));
  const familyKeys = [...new Set(supplierAssignments.map((assignment) => assignment.productFamilyKey).filter(Boolean))];
  const allCodes = skuMasters.map((sku) => sku.internalSkuCode);
  const familyCandidates = familyKeys.flatMap((familyKey) => {
    const familySkus = skuMasters.filter((sku) => deriveProductFamilyKey(sku.productName, sku.productFamilyKey) === familyKey);
    const operatingCodes = [...new Set(familySkus.map((sku) => deriveOperatingProductCode(sku.internalSkuCode, sku.productName, sku.specification, allCodes)))];
    const matchingCodes = familySkus.filter((sku) => {
      const normalizedSpec = normalize(row.supplierSpec);
      const signature = dimensionSignature(row.supplierSpec);
      return normalize(sku.specification) === normalizedSpec || (signature !== undefined && dimensionSignature(sku.specification) === signature);
    }).map((sku) => deriveOperatingProductCode(sku.internalSkuCode, sku.productName, sku.specification, allCodes));
    const targetCode = [...new Set(matchingCodes)].length === 1 ? [...new Set(matchingCodes)][0] : operatingCodes.length === 1 ? operatingCodes[0] : undefined;
    return targetCode && familySkus.length ? [{ familyKey, operatingProductCode: targetCode, skuMasterId: familySkus.find((sku) => deriveOperatingProductCode(sku.internalSkuCode, sku.productName, sku.specification, allCodes) === targetCode)!.id }] : [];
  });
  if (familyCandidates.length === 1) {
    return { kind: "operating_product", productFamilyKey: familyCandidates[0].familyKey, operatingProductCode: familyCandidates[0].operatingProductCode, skuMasterId: familyCandidates[0].skuMasterId };
  }
  const skuMasterId = suggestInboundSku(row, skuMasters, options);
  return skuMasterId ? { kind: "sku", skuMasterId } : undefined;
}

export function SupplierInboundImportPreview({ result, period, fileName, sheetName, skuMasters, suppliers, existingAssignments = [], savedMappings = [], onCancel, onConfirm }: Props) {
  const [supplierId, setSupplierId] = useState(() => {
    const embeddedName = result.rows.find((row) => row.supplierName)?.supplierName;
    const matches = suppliers.filter((supplier) => normalize(supplier.name) === normalize(embeddedName ?? ""));
    return matches.length === 1 ? matches[0].id : "";
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
      savedMappings,
    });
    return [row.rowNumber, suggestion?.kind === "operating_product" ? `operating:${suggestion.operatingProductCode}|${suggestion.productFamilyKey}` : suggestion?.skuMasterId];
  })), [result.rows, skuSignature, supplierId, supplierFromFile, period, assignmentSignature, savedMappings]);
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
      const operatingMatch = match.startsWith("operating:") ? match.slice("operating:".length) : undefined;
      const [operatingProductCode, familyKey] = operatingMatch?.split("|") ?? [];
      const skuMasterId = familyKey
        ? skuMasters.find((sku) => deriveProductFamilyKey(sku.productName, sku.productFamilyKey) === familyKey && deriveOperatingProductCode(sku.internalSkuCode, sku.productName, sku.specification, skuMasters.map((item) => item.internalSkuCode)) === operatingProductCode)?.id
        : match;
      if (!skuMasterId) return [];
      return [{
        skuMasterId,
        ...(familyKey ? { productFamilyKey: familyKey, operatingProductCode, mappingLevel: "operating_product" as const } : { mappingLevel: "sku" as const }),
        period,
        receivedQuantity: row.receivedQuantity,
        ...(row.unitPrice !== undefined ? { settlementUnitPrice: row.unitPrice } : {}),
        ...(row.amount !== undefined ? { settlementAmount: row.amount } : {}),
        supplierId: supplier?.id,
        supplierName: supplier?.name ?? supplierFromFile,
        supplierProductName: row.supplierProductName,
        supplierSpec: row.supplierSpec,
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
        已保存的供应商商品名 + 规格映射会优先自动匹配，之后可在本表逐行检核或修正；确认导入后，修正结果会保存供下次复用。新商品、规格变化或未匹配供应商仍需处理。未关联行不会写入。
      </div>
      <div className={`rounded-lg px-3 py-2 text-xs leading-5 ${quality.status === "ready" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
        <div className="font-medium">数据质量检查：{quality.headline}</div>
        <div className="mt-1">{quality.details.join(" · ")}。经营产品级关联会合并保存入仓总量，不会拆分或复制到每个 SKU。</div>
      </div>
      {!matchedCount && futureRelationshipCount > 0 ? <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
        已找到该供应商的供应关系，但关系生效月份晚于本次导入月份（{period}）。系统不会把未来关系倒灌到历史数据；请确认保存月份，或将关系生效月份修正为真实生效月份。
      </div> : null}
      {supplierFromFile ? <p className="text-xs text-slate-600">表格供应商：{supplierFromFile}</p> : null}
      <label className="block text-xs text-slate-600">
        {supplierFromFile ? "匹配供应商档案（用于复用商品映射，可留空）" : "本批对账供应商"}
        <select aria-label="本批对账供应商" className="mt-1 w-full rounded border border-line px-2 py-2 text-sm" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
          <option value="">{supplierFromFile ? "不关联档案" : "请选择供应商"}</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
      </label>
      {result.errors.length ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{result.errors.map((item) => `第${item.rowNumber}行：${item.message}`).join("；")}</p> : null}
      <div className="max-h-96 overflow-auto rounded-lg border border-line">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-paper-warm text-slate-500"><tr><th className="px-3 py-2">供应商商品</th><th className="px-3 py-2">供应商规格</th><th className="px-3 py-2">实际入仓</th><th className="px-3 py-2">对应经营产品 / SKU</th></tr></thead>
          <tbody className="divide-y divide-line">
            {result.rows.map((row) => <tr key={row.rowNumber}>
              <td className="px-3 py-2">{row.supplierProductName}</td>
              <td className="px-3 py-2">{row.supplierSpec}</td>
              <td className="px-3 py-2">{row.receivedQuantity}{row.unit ? ` ${row.unit}` : ""}</td>
              <td className="px-3 py-2">
                <select aria-label={`第${row.rowNumber}行对应产品族或SKU`} className="w-full rounded border border-line px-2 py-1" value={matches[row.rowNumber] ?? ""} onChange={(event) => setMatches((current) => ({ ...current, [row.rowNumber]: event.target.value || undefined }))}>
                  <option value="">暂不关联</option>
        {[...new Map(skuMasters.filter((sku) => sku.status !== "archived").map((sku) => [deriveOperatingProductCode(sku.internalSkuCode, sku.productName, sku.specification, skuMasters.map((item) => item.internalSkuCode)), sku])).entries()].map(([operatingProductCode]) => <option key={`operating:${operatingProductCode}`} value={`operating:${operatingProductCode}|${deriveProductFamilyKey(skuMasters.find((sku) => deriveOperatingProductCode(sku.internalSkuCode, sku.productName, sku.specification, skuMasters.map((item) => item.internalSkuCode)) === operatingProductCode)!.productName, skuMasters.find((sku) => deriveOperatingProductCode(sku.internalSkuCode, sku.productName, sku.specification, skuMasters.map((item) => item.internalSkuCode)) === operatingProductCode)!.productFamilyKey)}`}>经营产品：{operatingProductCode}</option>)}
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
