"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadWorkbenchData } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import { getDashboardView } from "@/features/workbench/dashboard";
import { KnowledgeCalendar } from "@/components/workbench/knowledge-calendar";
import {
  Zap,
  CheckSquare,
  Lightbulb,
  Users
} from "lucide-react";

export default function DashboardPage() {
  const data = useWorkbenchData();
  const [view, setView] = useState<ReturnType<typeof getDashboardView> | null>(null);

  useEffect(() => {
    loadWorkbenchData();
  }, []);

  useEffect(() => {
    setView(getDashboardView(data));
  }, [data]);

  if (!view) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-action border-t-transparent" />
        <span className="ml-3 text-sm text-muted">正在加载工作台...</span>
      </div>
    );
  }

  const inProgress = data.products.filter(
    (p) => p.lifecycleStage && p.lifecycleStage !== "archived" && p.lifecycleStage !== "discontinued"
  ).length;

  const pendingCount = view.openTasks.length;
  const supplierCount = data.suppliers.length;

  const ports = [
    { href: "/intake", icon: Zap, label: "快速录入", color: "text-action", bg: "bg-action-soft" },
    { href: "/tasks", icon: CheckSquare, label: "待办提醒", count: pendingCount, countColor: "bg-warning", color: "text-warning", bg: "bg-warning-soft" },
    { href: "/suppliers", icon: Users, label: "供应商档案", count: supplierCount, countColor: "bg-success", color: "text-success", bg: "bg-success-soft" },
    { href: "/products", icon: Lightbulb, label: "产品进程", count: inProgress, countColor: "bg-action", color: "text-action", bg: "bg-action-soft" }
  ];

  return (
    <div className="space-y-6">
      {/* 思维模型卡片 */}
      <KnowledgeCalendar />

      {/* 4个小卡片式端口 */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {ports.map((port) => (
          <Link
            key={port.label}
            href={port.href}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-all hover:shadow-sm hover:-translate-y-0.5"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${port.bg}`}>
              <port.icon className={`h-4.5 w-4.5 ${port.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-ink truncate">{port.label}</div>
              {port.count !== undefined && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[10px] text-white px-1.5 rounded-full ${port.countColor}`}>{port.count}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
