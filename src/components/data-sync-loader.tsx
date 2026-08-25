"use client";

import { useEffect, useState } from "react";
import { loadWorkbenchData } from "@/features/workbench/local-store";
import { setWorkbenchSnapshot } from "@/features/workbench/workbench-store";

export function DataSyncLoader() {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let syncing = false;

    async function sync() {
      if (syncing) return;
      syncing = true;
      try {
        const data = await loadWorkbenchData();
        // 在调用方更新全局 store，避免 local-store → workbench-store 循环依赖
        if (!cancelled) {
          setWorkbenchSnapshot(data);
        }
      } catch {
        // 同步失败不影响使用，页面会使用 localStorage 中的数据
      } finally {
        syncing = false;
        if (!cancelled) setSynced(true);
      }
    }

    sync();

    // 每 30 秒轮询一次，确保多端数据一致
    const interval = setInterval(sync, 30000);

    // 窗口恢复聚焦时立即同步（从云端切换回本地时自动拉取）
    const handleFocus = () => sync();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // 同步完成前显示一个轻量的加载指示
  if (!synced) {
    return (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm transition-opacity">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-action border-t-transparent" />
          <span className="text-sm text-muted">正在同步数据...</span>
        </div>
      </div>
    );
  }

  return null;
}
