"use client";

import { useEffect, useState } from "react";
import { loadWorkbenchData } from "@/features/workbench/local-store";

export function DataSyncLoader() {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        // 从 Supabase 拉取最新数据，成功后会自动调用 setWorkbenchSnapshot 更新全局 store
        await loadWorkbenchData();
      } catch {
        // 同步失败不影响使用，页面会使用 localStorage 中的数据
      } finally {
        if (!cancelled) setSynced(true);
      }
    }

    sync();

    // 定期从云端拉取最新数据（每 30 秒），确保多端数据一致
    const interval = setInterval(sync, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // 同步完成前显示一个轻量的加载指示
  if (!synced) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm transition-opacity">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-action border-t-transparent" />
          <span className="text-sm text-muted">正在同步数据...</span>
        </div>
      </div>
    );
  }

  return null;
}
