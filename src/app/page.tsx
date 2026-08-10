"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadWorkbenchData,
  type LocalWorkbenchData
} from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
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
  Lightbulb,
  Calendar,
  FolderKanban,
  Sparkles,
  CircleCheck,
  Circle,
  Flame
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

const colorMap: Record<string, { bg: string; text: string; soft: string; border: string; hex: string }> = {
  action: { bg: "bg-action", text: "text-action", soft: "bg-action-soft", border: "border-action/15", hex: "#c4716b" },
  warning: { bg: "bg-warning", text: "text-warning", soft: "bg-warning-soft", border: "border-warning/15", hex: "#d4a35a" },
  success: { bg: "bg-success", text: "text-success", soft: "bg-success-soft", border: "border-success/15", hex: "#7fb069" }
};

function GreetingBlock() {
  const hour = new Date().getHours();
  const greeting = hour < 6 ? "凌晨好" : hour < 12 ? "早安" : hour < 18 ? "午安" : "晚安";
  const date = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`;
  return { greeting, dateStr };
}

export default function DashboardPage() {
  const data = useWorkbenchData();
  const [view, setView] = useState<DashboardView | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    loadWorkbenchData();
  }, []);

  useEffect(() => {
    setView(getDashboardView(data));
  }, [data]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  if (!view) {
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
  const openTasks = view.openTasks;
  const highPriorityTasks = openTasks.filter((t) => t.priority === "high");

  const stats = [
    {
      label: "待办事项",
      hint: `${openTasks.length} 项待处理`,
      value: openTasks.length,
      icon: CheckSquare,
      color: "warning",
      href: "/tasks",
      progress: taskProgress,
      progressLabel: totalTasks > 0 ? `${completedTasks}/${totalTasks} 完成` : ""
    },
    {
      label: "供应商",
      hint: `${data.suppliers.length} 家合作`,
      value: data.suppliers.length,
      icon: Building2,
      color: "action",
      href: "/suppliers"
    },
    {
      label: "货盘",
      hint: `${data.offers.length} 个在盘`,
      value: data.offers.length,
      icon: Package,
      color: "warning",
      href: "/offers"
    },
    {
      label: "知识沉淀",
      hint: `${data.knowledgeCards.length + data.products.length} 条记录`,
      value: data.knowledgeCards.length + data.products.length,
      icon: Lightbulb,
      color: "success",
      href: "/knowledge"
    }
  ];

  const quickLinks = [
    { href: "/intake", label: "快速录入", description: "粘贴沟通、截图或报价文件", icon: Zap, color: "action" },
    { href: "/tasks", label: "待办", description: "查看需要跟进的事情", icon: CheckSquare, color: "warning" },
    { href: "/offers", label: "报价对比", description: "选择货盘生成对比表", icon: BarChart3, color: "success" },
    { href: "/projects", label: "品类项目", description: "按品类查看关联全貌", icon: FolderKanban, color: "action" }
  ];

  const { greeting, dateStr } = GreetingBlock();

  return (
    <div className="space-y-6">
      {/* Hero Greeting + Quick Actions */}
      <header className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface via-surface to-paper-warm p-6 shadow-card md:p-8">
        {/* decorative blobs */}
        <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-action/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-warning/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success/5 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-action/20 bg-action-soft px-3 py-1 text-xs font-medium text-action">
              <Flower2 className="h-3.5 w-3.5" />
              <span>{dateStr}</span>
            </div>
            <h1 className="font-display text-3xl font-bold leading-tight text-ink md:text-4xl">
              {greeting}，<span className="bg-gradient-to-r from-action to-action-strong bg-clip-text text-transparent">今天也要稳稳推进</span>
            </h1>
            <p className="mt-2 text-sm text-muted md:text-base">
              先处理要行动的事情，再回看最近的沉淀与决策。
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/tasks"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-action to-action-strong px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <CheckSquare className="h-4 w-4" />
                查看待办 {openTasks.length > 0 ? `(${openTasks.length})` : ""}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/intake"
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink backdrop-blur transition-all hover:-translate-y-0.5 hover:border-action/40 hover:text-action"
              >
                <Zap className="h-4 w-4" />
                快速录入
              </Link>
            </div>
          </div>

          {/* Today's Focus Card */}
          <div className="shrink-0 rounded-2xl border border-line bg-white/70 p-5 shadow-card backdrop-blur md:min-w-[280px]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
              <Flame className="h-3.5 w-3.5 text-warning" />
              <span>今日焦点</span>
            </div>
            {openTasks.length === 0 ? (
              <div className="mt-3 text-sm text-muted">
                <p>没有待办事项 🎉</p>
                <p className="mt-1 text-xs">从快速录入开始新的一天吧。</p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {highPriorityTasks.slice(0, 2).map((t) => (
                  <div key={t.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                    <span className="text-ink leading-snug line-clamp-2">{t.title}</span>
                  </div>
                ))}
                {highPriorityTasks.length === 0 && openTasks[0] ? (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                    <span className="text-ink leading-snug line-clamp-2">{openTasks[0].title}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between pt-2 border-t border-line-soft text-xs">
                  <span className="text-muted">剩余 {openTasks.length} 项</span>
                  <Link href="/tasks" className="font-medium text-action hover:text-action-strong inline-flex items-center gap-0.5">
                    前往处理 <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
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
              className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:border-line-soft"
            >
              <div
                className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-60 pointer-events-none"
                style={{ backgroundColor: cfg.hex }}
              />
              <div className="flex items-start justify-between relative">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.soft} border ${cfg.border}`}>
                  <Icon className={`h-5 w-5 ${cfg.text}`} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-light transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3 relative">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-ink">{s.value}</span>
                </div>
                <p className="text-xs text-muted mt-0.5">{s.label}</p>
                <p className="text-[11px] text-muted-light mt-0.5">{s.hint}</p>
              </div>
              {s.progress != null ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted mb-1">
                    <span>进度</span>
                    <span className="font-medium text-ink">{s.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-warm">
                    <div
                      className={`h-full rounded-full ${cfg.bg} transition-all`}
                      style={{ width: `${s.progress}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </Link>
          );
        })}
      </section>

      {/* 待处理事项 - 前置突出 */}
      <section className="relative animate-fade-up">
        <div className="absolute -left-4 top-6 h-full w-1 rounded-full bg-gradient-to-b from-warning to-warning/30 hidden md:block" />
        <section className="rounded-3xl border border-warning/20 bg-gradient-to-br from-surface via-surface to-warning-soft/30 p-5 shadow-card transition-all hover:shadow-card-hover md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-soft border border-warning/20 shadow-subtle">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h2 className="font-semibold text-ink text-lg">待处理事项</h2>
                <p className="text-xs text-muted">
                  {openTasks.length > 0 ? (
                    <>还有 <span className="font-semibold text-warning">{openTasks.length}</span> 项待办 · 高优先级 <span className="font-semibold text-danger">{highPriorityTasks.length}</span> 项</>
                  ) : "当前没有待办事项"}
                </p>
              </div>
            </div>
            <Link href="/tasks" className="flex items-center gap-1 text-sm font-medium text-action hover:text-action-strong transition-colors">
              查看全部
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {openTasks.length === 0 ? (
            <div className="rounded-2xl bg-paper-warm/60 border border-line-soft px-4 py-8 text-center">
              <CheckSquare className="mx-auto mb-3 h-9 w-9 text-muted-light" />
              <p className="text-sm text-muted">目前没有未完成待办，可以先从快速录入开始。</p>
              <Link href="/intake" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-action hover:text-action-strong">
                去录入一条沟通 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {openTasks.slice(0, 6).map((task) => {
                const cfg = priorityConfig[task.priority] || { label: "待处理", bg: "bg-paper-warm", text: "text-muted", border: "border-line-soft", dot: "bg-muted-light" };
                const isHigh = task.priority === "high";
                return (
                  <Link
                    key={task.id}
                    href="/tasks"
                    className={`group flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 transition-all border ${isHigh ? "border-danger/20 bg-danger-soft/20 hover:bg-danger-soft/40" : "border-transparent hover:bg-paper-warm/60 hover:border-line-soft"}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bg} border ${cfg.border}`}>
                        <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-ink truncate block">{task.title}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted">
                          {task.supplierName ? (
                            <span className="inline-flex items-center rounded-md bg-paper-warm px-1.5 py-0.5 border border-line-soft">
                              {task.supplierName}
                            </span>
                          ) : null}
                          {task.dueText ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {task.dueText}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-light transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
              {openTasks.length > 6 ? (
                <Link href="/tasks" className="block text-center rounded-xl py-2.5 text-sm text-muted hover:text-action transition-colors">
                  还有 {openTasks.length - 6} 项，点击查看全部 →
                </Link>
              ) : null}
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
            <Link href="/suppliers" className="flex items-center gap-1 text-sm font-medium text-action hover:text-action-strong transition-colors">
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
            <Link href="/knowledge/cases" className="flex items-center gap-1 text-sm font-medium text-action hover:text-action-strong transition-colors">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-light transition-transform group-hover:translate-x-0.5" />
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
