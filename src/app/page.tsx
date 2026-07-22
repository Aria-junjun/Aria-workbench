"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadWorkbenchData,
  loadLocalWorkbenchData,
  type LocalWorkbenchData
} from "@/features/workbench/local-store";
import {
  getDashboardView,
  type DashboardItem,
  type DashboardView
} from "@/features/workbench/dashboard";
import {
  Zap,
  CheckSquare,
  BarChart3,
  ArrowRight,
  Clock,
  Pin,
  ChevronRight,
  Flower2,
  AlertCircle,
  TrendingUp,
  Heart,
  MessageSquare,
  Scale,
  Building2,
  Package,
  BookOpen,
  Lightbulb,
  CircleCheck,
  Circle,
  Calendar
} from "lucide-react";

const kindLabels: Record<DashboardItem["kind"], string> = {
  supplier: "供应商",
  offer: "货盘",
  product: "产品知识",
  knowledge: "商业知识",
  communication: "沟通",
  decision: "决策"
};

const kindColors: Record<DashboardItem["kind"], { bg: string; text: string; border: string }> = {
  supplier: { bg: "bg-action-soft", text: "text-action", border: "border-action/15" },
  offer: { bg: "bg-warning-soft", text: "text-warning", border: "border-warning/15" },
  product: { bg: "bg-success-soft", text: "text-success", border: "border-success/15" },
  knowledge: { bg: "bg-action-soft", text: "text-action", border: "border-action/15" },
  communication: { bg: "bg-paper-warm", text: "text-muted", border: "border-line-soft" },
  decision: { bg: "bg-warning-soft", text: "text-warning", border: "border-warning/15" }
};

const priorityConfig: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  high: { label: "高", bg: "bg-danger-soft", text: "text-danger", border: "border-danger/20", dot: "bg-danger" },
  medium: { label: "中", bg: "bg-warning-soft", text: "text-warning", border: "border-warning/20", dot: "bg-warning" },
  low: { label: "低", bg: "bg-success-soft", text: "text-success", border: "border-success/20", dot: "bg-success" }
};

const quickLinks = [
  { href: "/intake", label: "快速录入", description: "粘贴沟通、截图或报价文件", icon: Zap, color: "action" },
  { href: "/tasks", label: "待办", description: "查看需要跟进的事情", icon: CheckSquare, color: "warning" },
  { href: "/offers", label: "报价对比", description: "选择货盘生成对比表", icon: BarChart3, color: "success" }
];

const colorMap: Record<string, { bg: string; text: string; soft: string; border: string }> = {
  action: { bg: "bg-action", text: "text-action", soft: "bg-action-soft", border: "border-action/15" },
  warning: { bg: "bg-warning", text: "text-warning", soft: "bg-warning-soft", border: "border-warning/15" },
  success: { bg: "bg-success", text: "text-success", soft: "bg-success-soft", border: "border-success/15" }
};

export default function DashboardPage() {
  const [view, setView] = useState<DashboardView | null>(null);
  const [data, setData] = useState<LocalWorkbenchData | null>(null);

  useEffect(() => {
    loadWorkbenchData().then((d: LocalWorkbenchData) => {
      setData(d);
      setView(getDashboardView(d));
    });
  }, []);

  if (!view || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-action border-t-transparent" />
        <span className="ml-3 text-sm text-muted">正在加载工作台...</span>
      </div>
    );
  }

  const totalTasks = data.tasks.length;
  const completedTasks = data.tasks.filter((t) => t.status === "done").length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const stats = [
    {
      label: "供应商",
      value: data.suppliers.length,
      icon: Building2,
      color: "action",
      href: "/suppliers"
    },
    {
      label: "货盘",
      value: data.offers.length,
      icon: Package,
      color: "warning",
      href: "/offers"
    },
    {
      label: "待办",
      value: view.openTasks.length,
      icon: CheckSquare,
      color: "success",
      suffix: totalTasks > 0 ? `/${totalTasks}` : "",
      href: "/tasks",
      progress: taskProgress
    },
    {
      label: "知识",
      value: data.knowledgeCards.length + data.products.length,
      icon: Lightbulb,
      color: "action",
      href: "/knowledge"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card md:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-action/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-warning/5 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Flower2 className="h-4 w-4 text-action" />
              <span className="text-xs font-semibold uppercase tracking-widest text-action">
                个人供应链行动入口
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">
              工作台
            </h1>
            <p className="mt-2 text-sm text-muted md:text-base">
              先处理要行动的事情，再回看最近沉淀。
            </p>
          </div>
          <Link
            href="/intake"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-action to-action-strong px-6 py-3 text-sm font-semibold text-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <Zap className="h-4 w-4" />
            快速录入
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* 统计概览 */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const cfg = colorMap[s.color];
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.soft} border ${cfg.border}`}>
                  <Icon className={`h-5 w-5 ${cfg.text}`} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-light transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-ink">{s.value}</span>
                  {s.suffix ? <span className="text-sm text-muted">{s.suffix}</span> : null}
                </div>
                <p className="text-xs text-muted">{s.label}</p>
              </div>
              {s.progress != null ? (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-paper-warm">
                  <div
                    className={`h-full rounded-full ${cfg.bg} transition-all`}
                    style={{ width: `${s.progress}%` }}
                  />
                </div>
              ) : null}
            </Link>
          );
        })}
      </section>

      {/* 待处理事项 */}
      <section className="animate-fade-up">
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-card transition-all hover:shadow-card-hover">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-soft border border-warning/15">
                <AlertCircle className="h-4 w-4 text-warning" />
              </div>
              <div>
                <h2 className="font-semibold text-ink">待处理事项</h2>
                <p className="text-xs text-muted">
                  {view.openTasks.length > 0 ? `还有 ${view.openTasks.length} 项待办` : "没有待办"}
                </p>
              </div>
            </div>
            <Link href="/tasks" className="flex items-center gap-1 text-sm text-action hover:text-action-strong transition-colors font-medium">
              查看全部
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {view.openTasks.length === 0 ? (
            <div className="rounded-2xl bg-paper-warm border border-line-soft px-4 py-6 text-center">
              <CheckSquare className="mx-auto mb-2 h-8 w-8 text-muted-light" />
              <p className="text-sm text-muted">目前没有未完成待办，可以先从快速录入开始。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {view.openTasks.slice(0, 5).map((task) => {
                const cfg = priorityConfig[task.priority] || { label: "待处理", bg: "bg-paper-warm", text: "text-muted", border: "border-line-soft", dot: "bg-muted-light" };
                return (
                  <Link
                    key={task.id}
                    href="/tasks"
                    className="group flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-all hover:bg-paper-warm border border-transparent hover:border-line-soft"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-2 w-2 rounded-full ${cfg.dot} shrink-0`} />
                      <span className="text-sm text-ink truncate">{task.title}</span>
                      {task.supplierName ? (
                        <span className="hidden sm:inline-flex shrink-0 rounded-md bg-paper-warm px-2 py-0.5 text-[11px] text-muted border border-line-soft">
                          {task.supplierName}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.dueText ? (
                        <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted">
                          <Calendar className="h-3 w-3" />
                          {task.dueText}
                        </span>
                      ) : null}
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-light transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {/* 双栏：置顶 + 最近 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 置顶 */}
        <section className="animate-fade-up delay-100 rounded-3xl border border-line bg-surface p-5 shadow-card transition-all hover:shadow-card-hover">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-action-soft border border-action/15">
                <Pin className="h-4 w-4 text-action" />
              </div>
              <div>
                <h2 className="font-semibold text-ink">当前置顶</h2>
                <p className="text-xs text-muted">常看的内容快速访问</p>
              </div>
            </div>
          </div>

          {view.pinnedItems.length === 0 ? (
            <div className="rounded-2xl bg-paper-warm border border-line-soft px-4 py-6 text-center">
              <Pin className="mx-auto mb-2 h-8 w-8 text-muted-light" />
              <p className="text-sm text-muted">还没有置顶内容，可以在各模块中置顶常用记录。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {view.pinnedItems.slice(0, 6).map((item) => {
                const colors = kindColors[item.kind];
                return (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-paper-warm border border-transparent hover:border-line-soft"
                  >
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink truncate">{item.title}</span>
                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {kindLabels[item.kind]}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted">{item.summary}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-light shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* 最近沉淀 */}
        <section className="animate-fade-up delay-200 rounded-3xl border border-line bg-surface p-5 shadow-card transition-all hover:shadow-card-hover">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper-warm border border-line-soft">
                <Clock className="h-4 w-4 text-muted" />
              </div>
              <div>
                <h2 className="font-semibold text-ink">最近沉淀</h2>
                <p className="text-xs text-muted">最新录入的信息</p>
              </div>
            </div>
          </div>

          {view.recentItems.length === 0 ? (
            <div className="rounded-2xl bg-paper-warm border border-line-soft px-4 py-6 text-center">
              <Clock className="mx-auto mb-2 h-8 w-8 text-muted-light" />
              <p className="text-sm text-muted">还没有沉淀记录，先录入一条供应商沟通或报价。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {view.recentItems.slice(0, 6).map((item) => {
                const colors = kindColors[item.kind];
                return (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-paper-warm border border-transparent hover:border-line-soft"
                  >
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink truncate">{item.title}</span>
                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {kindLabels[item.kind]}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted">{item.summary}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-light shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 双栏：沟通 + 决策 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 最近沟通 */}
        <section className="animate-fade-up delay-150 rounded-3xl border border-line bg-surface p-5 shadow-card transition-all hover:shadow-card-hover">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper-warm border border-line-soft">
                <MessageSquare className="h-4 w-4 text-muted" />
              </div>
              <div>
                <h2 className="font-semibold text-ink">最近沟通</h2>
                <p className="text-xs text-muted">最新录入的沟通记录</p>
              </div>
            </div>
            <Link href="/suppliers" className="flex items-center gap-1 text-sm text-action hover:text-action-strong transition-colors font-medium">
              查看全部
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {view.recentCommunications.length === 0 ? (
            <div className="rounded-2xl bg-paper-warm border border-line-soft px-4 py-6 text-center">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-light" />
              <p className="text-sm text-muted">还没有沟通记录，从快速录入开始。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {view.recentCommunications.map((item) => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-paper-warm border border-transparent hover:border-line-soft"
                >
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-ink truncate">{item.title}</span>
                    <p className="truncate text-xs text-muted">{item.summary}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-light shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 最近决策 */}
        <section className="animate-fade-up delay-200 rounded-3xl border border-line bg-surface p-5 shadow-card transition-all hover:shadow-card-hover">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-soft border border-warning/15">
                <Scale className="h-4 w-4 text-warning" />
              </div>
              <div>
                <h2 className="font-semibold text-ink">最近决策</h2>
                <p className="text-xs text-muted">知识工具驱动的决策记录</p>
              </div>
            </div>
            <Link href="/knowledge/cases" className="flex items-center gap-1 text-sm text-action hover:text-action-strong transition-colors font-medium">
              查看全部
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {view.recentDecisions.length === 0 ? (
            <div className="rounded-2xl bg-paper-warm border border-line-soft px-4 py-6 text-center">
              <Scale className="mx-auto mb-2 h-8 w-8 text-muted-light" />
              <p className="text-sm text-muted">还没有决策记录，去商业知识中尝试做决策分析。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {view.recentDecisions.map((item) => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-paper-warm border border-transparent hover:border-line-soft"
                >
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-ink truncate">{item.title}</span>
                    <p className="truncate text-xs text-muted">{item.summary}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-light shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 快速操作 */}
      <section className="animate-fade-up delay-300">
        <h2 className="mb-4 font-semibold text-ink flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-action" />
          快速操作
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            const cfg = colorMap[item.color];
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover hover:border-line-soft"
              >
                <div className={`absolute inset-0 ${cfg.soft} opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none`} />
                <div className="relative">
                  <div className={`mb-3 inline-flex rounded-xl ${cfg.bg} p-2.5 shadow-subtle`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="font-semibold text-ink">{item.label}</div>
                  <p className="mt-1 text-xs text-muted leading-relaxed">{item.description}</p>
                  <ArrowRight className="absolute bottom-0 right-0 h-4 w-4 text-muted-light transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 pb-4 text-xs text-muted-light">
        <Heart className="h-3 w-3 text-action/60" />
        <span>用心经营，温暖前行</span>
      </div>
    </div>
  );
}
