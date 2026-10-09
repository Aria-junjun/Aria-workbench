"use client";

import React, { useState } from "react";
import { loadLocalWorkbenchData, saveLocalWorkbenchData } from "@/features/workbench/local-store";
import { applySafeSupplierDelete, buildSafeSupplierDeletePreview, type SafeSupplierDeletePreview } from "@/features/workbench/safe-supplier-delete";

/** Safety-gated action; deliberately not mounted on supplier pages. */
export function SafeSupplierDeleteAction({ supplierId, supplierName, onDeleted }: { supplierId: string; supplierName: string; onDeleted: () => void }) {
  const [preview, setPreview] = useState<SafeSupplierDeletePreview | null>(null);
  const [typedName, setTypedName] = useState("");
  const [secondConfirmed, setSecondConfirmed] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [error, setError] = useState("");

  function open() {
    setError("");
    setTypedName("");
    setSecondConfirmed(false);
    setBackupDownloaded(false);
    try {
      setPreview(buildSafeSupplierDeletePreview(loadLocalWorkbenchData(), supplierId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法核对供应商引用");
    }
  }

  function downloadBackup() {
    if (!preview) return;
    const url = URL.createObjectURL(new Blob([preview.backupJson], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `供应商删除前完整备份-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupDownloaded(true);
  }

  function confirmDelete() {
    if (!preview || !backupDownloaded || !secondConfirmed || typedName !== supplierName) return;
    try {
      const current = loadLocalWorkbenchData();
      const next = applySafeSupplierDelete(current, {
        supplierId,
        expectedRevision: preview.revision,
        typedName,
        secondConfirmed,
        backupDownloaded,
      });
      saveLocalWorkbenchData(next);
      setPreview(null);
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除前核对失败，未修改数据");
    }
  }

  return <div>
    <button type="button" onClick={open}>永久删除</button>
    {preview && <div role="dialog" aria-label="永久删除供应商">
      {preview.totalReferences > 0 ? <p>仍有 {preview.totalReferences} 条引用，请使用合并供应商或停用供应商，不能直接删除。</p> : <>
        <p>仅无引用的供应商档案可以永久删除。此操作不可恢复。</p>
        <button type="button" onClick={downloadBackup}>下载完整 JSON 备份</button>
        <label>输入供应商名称确认<input aria-label="输入供应商名称确认" value={typedName} onChange={(event) => setTypedName(event.target.value)} /></label>
        <label><input type="checkbox" aria-label="我确认永久删除且不可恢复" checked={secondConfirmed} onChange={(event) => setSecondConfirmed(event.target.checked)} />我确认永久删除且不可恢复</label>
        <button type="button" disabled={!backupDownloaded || !secondConfirmed || typedName !== supplierName} onClick={confirmDelete}>确认永久删除</button>
      </>}
      <button type="button" onClick={() => setPreview(null)}>取消</button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
