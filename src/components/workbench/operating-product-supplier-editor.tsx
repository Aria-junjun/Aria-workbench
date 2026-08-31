"use client";

import { useState } from "react";
import {
  getActiveProductSupplierAssignments,
} from "@/features/workbench/relationship-rules";
import {
  saveProductSupplierAssignments,
  type LocalProductSupplierAssignment,
  type LocalSupplier,
} from "@/features/workbench/local-store";

type OperatingProductSupplierEditorProps = {
  productFamilyKey: string;
  period: string;
  suppliers: LocalSupplier[];
  assignments: LocalProductSupplierAssignment[];
  onSaved?: () => void;
};

export function OperatingProductSupplierEditor({
  productFamilyKey,
  period,
  suppliers,
  assignments,
  onSaved,
}: OperatingProductSupplierEditorProps) {
  const active = getActiveProductSupplierAssignments(assignments, productFamilyKey, period);
  const primary = active.find((item) => item.role === "primary");
  const backup = active.find((item) => item.role === "backup");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"primary" | "backup">("primary");
  const [supplierId, setSupplierId] = useState(primary?.supplierId ?? suppliers[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [message, setMessage] = useState("");

  function save() {
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier || !reason.trim() || !evidence.trim()) return;
    saveProductSupplierAssignments([{
      productFamilyKey,
      supplierId: supplier.id,
      supplierName: supplier.name,
      role,
      effectiveFrom: period,
      status: "active",
      source: "manual",
      reason: reason.trim(),
      evidence: evidence.trim(),
    }]);
    setMessage(`已保存${role === "primary" ? "主供" : "备供"}关系`);
    setOpen(false);
    onSaved?.();
  }

  if (!open) {
    return (
      <button
        className="mt-1 text-[11px] text-action hover:underline"
        onClick={() => setOpen(true)}
        type="button"
      >
        调整供应关系
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-action/20 bg-white p-2 text-[11px] text-slate-600">
      <div className="font-medium text-slate-700">产品族供应关系调整</div>
      <div className="text-slate-500">当前主供：{primary?.supplierName || "未设置"} · 备供：{backup?.supplierName || "未设置"}</div>
      <select aria-label="选择主供或备供" className="w-full rounded border border-line bg-white px-2 py-1" value={role} onChange={(event) => setRole(event.target.value as "primary" | "backup")}>
        <option value="primary">主供</option>
        <option value="backup">备供</option>
      </select>
      <select aria-label="选择供应商" className="w-full rounded border border-line bg-white px-2 py-1" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
        <option value="">选择供应商</option>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
      </select>
      <label className="block">变更原因<input aria-label="变更原因" className="mt-1 w-full rounded border border-line px-2 py-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="例如：原主供暂停供货" /></label>
      <label className="block">关系依据<textarea aria-label="关系依据" className="mt-1 min-h-12 w-full rounded border border-line px-2 py-1" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="入仓记录、确认记录或沟通记录" /></label>
      <div className="flex items-center gap-2">
        <button className="rounded bg-action px-2 py-1 text-white disabled:opacity-50" disabled={!supplierId || !reason.trim() || !evidence.trim()} onClick={save} type="button">保存</button>
        <button className="rounded border border-line px-2 py-1" onClick={() => setOpen(false)} type="button">取消</button>
        {message ? <span className="text-success">{message}</span> : null}
      </div>
    </div>
  );
}
