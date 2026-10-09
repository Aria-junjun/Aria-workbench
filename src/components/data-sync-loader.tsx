"use client";

import { useEffect, useState } from "react";
import { loadLocalWorkbenchData } from "@/features/workbench/local-store";
import { setWorkbenchSnapshot } from "@/features/workbench/workbench-store";
import { bootstrapCloudWhenEmpty, commitCloudBackup, prepareCloudBackup, lastVerifiedAt, type BackupPreview } from "@/features/workbench/manual-cloud-sync";

export function DataSyncLoader() {
  const [status, setStatus] = useState<"local" | "pending" | "verified" | "conflict" | "error">("local");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);

  useEffect(() => {
    setWorkbenchSnapshot(loadLocalWorkbenchData());
    const refresh = () => setStatus(window.localStorage.getItem("personal-commercial-workbench:pending-sync") ? "pending" : lastVerifiedAt() ? "verified" : "local");
    refresh();
    if (!window.localStorage.getItem("personal-commercial-workbench") && !window.localStorage.getItem("personal-commercial-workbench:pending-sync")) {
      void bootstrapCloudWhenEmpty().then(result => {
        if (result) { setWorkbenchSnapshot(loadLocalWorkbenchData()); refresh(); }
      }).catch(() => { setStatus("error"); setMessage("云端暂不可读；未改动本地数据"); });
    }
    window.addEventListener("storage", refresh);
    window.addEventListener("workbench-local-change", refresh);
    const openBackup = () => void reviewBackup();
    window.addEventListener("workbench-open-cloud-backup", openBackup);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("workbench-local-change", refresh); window.removeEventListener("workbench-open-cloud-backup", openBackup); };
  }, []);

  async function reviewBackup() {
    setBusy(true);
    setMessage("");
    try {
      const next = await prepareCloudBackup();
      setPreview(next);
      if (next.status === "conflict") { setStatus("conflict"); setMessage(next.reason ?? "云端存在冲突，未写入"); }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "无法读取云端");
    } finally { setBusy(false); }
  }

  async function confirmBackup() {
    if (!preview || preview.status !== "ready") return;
    setBusy(true);
    const result = await commitCloudBackup(preview);
    setBusy(false);
    setPreview(null);
    setStatus(result.status === "verified" ? "verified" : result.status);
    setMessage(result.status === "verified" ? "云端回读核验通过" : result.reason ?? "未完成备份");
  }

  const label = busy ? "核对中…" : status === "verified" ? "云端已核验" : status === "pending" ? "待手动备份" : status === "conflict" ? "云端有冲突" : status === "error" ? "备份未完成" : "仅本地";

  return <>
    <button className="fixed right-4 top-4 z-40 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted shadow-sm hover:border-action hover:text-action" disabled={busy} onClick={() => void reviewBackup()} type="button" title={lastVerifiedAt() ? `上次核验：${lastVerifiedAt()}` : "尚未核验云端备份"}>
      {label}
    </button>
    {preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div role="dialog" aria-label="云端备份核对" className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">云端备份核对</h2>
        <p className="mt-3 text-sm">本地新增 {preview.added} 条、内容不同 {preview.changed} 条、仅云端 {preview.cloudOnly} 条。</p>
        <p className="mt-2 text-sm text-muted">仅云端记录存在时禁止覆盖；确认前请保留本地数据备份。</p>
        {message && <p role="alert" className="mt-3 text-sm text-red-700">{message}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => setPreview(null)} className="rounded border px-3 py-2">取消</button>
          <button type="button" disabled={busy || preview.status !== "ready"} onClick={() => void confirmBackup()} className="rounded bg-action px-3 py-2 text-white">确认备份到云端</button>
        </div>
      </div>
    </div>}
    {message && !preview && <div role="status" className="fixed right-4 top-14 z-40 rounded border bg-white px-3 py-2 text-xs shadow-sm">{message}</div>}
  </>;
}
