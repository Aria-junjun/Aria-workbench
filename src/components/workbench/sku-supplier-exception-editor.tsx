"use client";

import { useState } from "react";
import { saveSkuSupplierAssignments, type LocalSupplier } from "@/features/workbench/local-store";

type SkuSupplierExceptionEditorProps = {
  skuCode: string;
  suppliers: LocalSupplier[];
  currentPeriod: string;
  onSaved?: () => void;
};

export function SkuSupplierExceptionEditor({ skuCode, suppliers, currentPeriod, onSaved }: SkuSupplierExceptionEditorProps) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(currentPeriod);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [message, setMessage] = useState("");

  function save() {
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier || !effectiveFrom || !reason.trim() || !evidence.trim()) return;
    saveSkuSupplierAssignments([{
      skuCode,
      supplierId: supplier.id,
      supplierName: supplier.name,
      effectiveFrom,
      status: "active",
      source: "manual",
      note: `${reason.trim()}｜依据：${evidence.trim()}`,
    }]);
    setMessage("已保存 SKU 例外关系");
    setOpen(false);
    onSaved?.();
  }

  if (!open) {
    return <button type="button" className="mt-1 text-[11px] text-action hover:underline" onClick={() => setOpen(true)}>设置 SKU 例外</button>;
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-action/20 bg-white p-2 text-[11px] text-slate-600">
      <div className="font-medium text-slate-700">SKU 例外供应关系</div>
      <select className="w-full rounded border border-line bg-white px-2 py-1" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
        <option value="">选择供应商</option>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
      </select>
      <label className="block">生效月份<input className="mt-1 w-full rounded border border-line px-2 py-1" type="month" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
      <label className="block">变更原因<input className="mt-1 w-full rounded border border-line px-2 py-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="为什么与产品族默认关系不同" /></label>
      <label className="block">关系依据<textarea className="mt-1 min-h-12 w-full rounded border border-line px-2 py-1" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="入仓记录、确认记录等" /></label>
      <div className="flex items-center gap-2">
        <button type="button" className="rounded bg-action px-2 py-1 text-white disabled:opacity-50" disabled={!supplierId || !reason.trim() || !evidence.trim()} onClick={save}>保存</button>
        <button type="button" className="rounded border border-line px-2 py-1" onClick={() => setOpen(false)}>取消</button>
        {message ? <span className="text-success">{message}</span> : null}
      </div>
    </div>
  );
}
