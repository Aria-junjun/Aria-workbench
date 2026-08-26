"use client";

import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import {
  saveProductSupplierAssignments,
  type LocalProductSupplierAssignment,
} from "@/features/workbench/local-store";

export type SupplierRelationshipEditorFamily = {
  key: string;
  label: string;
};

export type SupplierRelationshipEditorHandle = {
  save: () => boolean;
  reset: () => void;
};

type SupplierRelationshipEditorProps = {
  supplierId: string;
  supplierName: string;
  productFamilies: SupplierRelationshipEditorFamily[];
  currentPeriod: string;
  existingAssignments: LocalProductSupplierAssignment[];
  editable?: boolean;
  onSaved?: () => void;
};

export const SupplierRelationshipEditor = forwardRef<SupplierRelationshipEditorHandle, SupplierRelationshipEditorProps>(function SupplierRelationshipEditor({
  supplierId,
  supplierName,
  productFamilies,
  currentPeriod,
  existingAssignments,
  editable = true,
  onSaved,
}: SupplierRelationshipEditorProps, ref) {
  const [selectedFamilyKeys, setSelectedFamilyKeys] = useState<string[]>(productFamilies[0]?.key ? [productFamilies[0].key] : []);
  const [role, setRole] = useState<"primary" | "backup">("primary");
  const [effectiveFrom, setEffectiveFrom] = useState(currentPeriod);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const currentFamilyAssignments = useMemo(
    () => existingAssignments.filter((item) => selectedFamilyKeys.includes(item.productFamilyKey) && item.status === "active"),
    [existingAssignments, selectedFamilyKeys],
  );
  function save() {
    if (!selectedFamilyKeys.length || !effectiveFrom || !reason.trim() || !evidence.trim()) return false;
    saveProductSupplierAssignments(selectedFamilyKeys.map((productFamilyKey) => ({
        productFamilyKey,
        supplierId,
        supplierName,
        role,
        effectiveFrom,
        status: "active" as const,
        source: "manual" as const,
        reason: reason.trim(),
        evidence: evidence.trim(),
      })));
    setSavedMessage(`已保存 ${selectedFamilyKeys.length} 个产品族的供应关系，并保留了变更历史。`);
    onSaved?.();
    return true;
  }

  function reset() {
    setSelectedFamilyKeys(productFamilies[0]?.key ? [productFamilies[0].key] : []);
    setRole("primary");
    setEffectiveFrom(currentPeriod);
    setReason("");
    setEvidence("");
    setSavedMessage("");
  }

  useImperativeHandle(ref, () => ({ save, reset }));

  function toggleFamily(familyKey: string) {
    setSelectedFamilyKeys((current) => current.includes(familyKey) ? current.filter((key) => key !== familyKey) : [...current, familyKey]);
  }

  return (
    <section id="supplier-relationship" className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">维护供应关系</h2>
          <p className="mt-1 text-sm text-muted">一次选择多个产品族，统一建立主供或备供关系；产品族默认覆盖全部有效 SKU，个别 SKU 可在产品主表设置例外。</p>
        </div>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs text-brand">当前供应商：{supplierName}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="text-sm text-ink">
          <span className="mb-1 block text-muted">关系范围（可多选）</span>
          <details className={`relative ${editable ? "" : "pointer-events-none"}`} aria-label="关系范围选择器">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink">
              <span>{selectedFamilyKeys.length ? `已选择 ${selectedFamilyKeys.length} 个产品族` : "请选择产品族"}</span>
              <span className="text-muted">⌄</span>
            </summary>
            <div className="absolute left-0 right-0 top-12 z-10 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border bg-white p-3 shadow-lg">
              {productFamilies.length ? productFamilies.map((family) => (
                <label key={family.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" disabled={!editable} checked={selectedFamilyKeys.includes(family.key)} onChange={() => toggleFamily(family.key)} />
                  <span>{family.label}</span>
                </label>
              )) : <span className="text-muted">暂无可维护的产品族</span>}
            </div>
          </details>
          <span className="mt-1 block text-xs text-muted">已选择 {selectedFamilyKeys.length} 个产品族</span>
        </div>

        <label className="text-sm text-ink">
          <span className="mb-1 block text-muted">关系类型</span>
          <select disabled={!editable} className="w-full rounded-xl border border-border bg-surface px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70" value={role} onChange={(event) => setRole(event.target.value as "primary" | "backup")}>
            <option value="primary">设为主供</option>
            <option value="backup">设为备供</option>
          </select>
        </label>

        <label className="text-sm text-ink">
          <span className="mb-1 block text-muted">生效月份</span>
          <input disabled={!editable} className="w-full rounded-xl border border-border bg-surface px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70" type="month" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        </label>

        <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
          已选产品族关系：{currentFamilyAssignments.length ? currentFamilyAssignments.map((item) => `${item.role === "primary" ? "主供" : "备供"} ${item.supplierName ?? "未命名"}`).join("、") : "尚未建立"}
        </div>

        <label className="text-sm text-ink md:col-span-2">
          <span className="mb-1 block text-muted">变更原因</span>
          <input disabled={!editable} className="w-full rounded-xl border border-border bg-surface px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="例如：确认该供应商作为当前主供" />
        </label>

        <label className="text-sm text-ink md:col-span-2">
          <span className="mb-1 block text-muted">关系依据</span>
          <textarea disabled={!editable} className="min-h-20 w-full rounded-xl border border-border bg-surface px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="例如：2026-07 实际入仓记录、确认聊天记录或货盘报价" />
        </label>
      </div>

      {savedMessage ? <div className="mt-4 text-sm text-success">{savedMessage}</div> : <div className="mt-4 text-xs text-muted">供应关系将随页面右上角“保存”统一提交；货盘匹配不会自动改变主供关系。</div>}
    </section>
  );
});
