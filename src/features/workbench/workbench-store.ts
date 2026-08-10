"use client";

/**
 * 全局 WorkbenchStore —— 单例模式，配合 useSyncExternalStore
 *
 * 职责：
 * 1. 持有当前数据快照（懒加载，首次访问时从 localStorage 读取）
 * 2. saveLocalWorkbenchData 写入后通过 setWorkbenchSnapshot() 触发所有订阅者重新渲染
 * 3. loadWorkbenchData（异步从 Supabase 拉取）成功后通过 setWorkbenchSnapshot() 更新快照
 * 4. 提供 useWorkbenchData() hook，让所有页面订阅同一份数据
 */

import { useSyncExternalStore } from "react";
import type { LocalWorkbenchData } from "./local-store";

// ---- 全局单例状态 ----
let currentSnapshot: LocalWorkbenchData | null = null;
const listeners = new Set<() => void>();

/** 懒加载初始快照（避免循环依赖：不在模块级别调用 loadLocalWorkbenchData） */
function getSnapshotInternal(): LocalWorkbenchData {
  if (currentSnapshot) return currentSnapshot;
  // 延迟导入，避免循环依赖
  if (typeof window !== "undefined") {
    const { loadLocalWorkbenchData } = require("./local-store");
    currentSnapshot = loadLocalWorkbenchData();
  } else {
    currentSnapshot = { suppliers: [], communications: [], offers: [], products: [], tasks: [], knowledgeCards: [], knowledgeBooks: [], decisionTools: [], knowledgeApplications: [], decisionCases: [], researchReports: [] };
  }
  return currentSnapshot!;
}

/** 内部：更新快照并通知所有订阅者 */
export function setWorkbenchSnapshot(next: LocalWorkbenchData) {
  currentSnapshot = next;
  listeners.forEach((fn) => fn());
}

/** 获取当前快照（供 useSyncExternalStore 的 getSnapshot 使用） */
export function getWorkbenchSnapshot(): LocalWorkbenchData {
  return getSnapshotInternal()!;
}

/** 订阅数据变化（供 useSyncExternalStore 的 subscribe 使用） */
export function subscribeWorkbench(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * React Hook：订阅全局 workbench 数据
 *
 * 用法：
 *   // 之前
 *   const data = loadLocalWorkbenchData();
 *   // 之后
 *   const data = useWorkbenchData();
 *
 * 当 saveLocalWorkbenchData 或 loadWorkbenchData 更新数据后，
 * 所有使用此 hook 的组件会自动重新渲染。
 */
export function useWorkbenchData(): LocalWorkbenchData {
  return useSyncExternalStore(subscribeWorkbench, getWorkbenchSnapshot, getWorkbenchSnapshot);
}
