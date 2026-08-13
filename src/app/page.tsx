"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadWorkbenchData
} from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import {
  getDashboardView
} from "@/features/workbench/dashboard";
import { KnowledgeCalendar } from "@/components/workbench/knowledge-calendar";
import { getStageMeta, getAllStages } from "@/features/workbench/stage-checklist-template";
import {
  Zap,
  CheckSquare,
  ArrowRight,
  Lightbulb,
  Package,
  ChevronRight,
  AlertCircle,
  Truck,
  Factory,
  PlayCircle,
  PauseCircle,
  HelpCircle,
  BarChart3,
  ClipboardList,
  Users,
  ShoppingCart
} from "lucide-react";

const stageColors: Record<string, { bg: string; text: string; soft: string; hex: string }> = {
  signal: { bg: "bg-slate-400", text: "text-slate-600", soft: "bg-slate-100", hex: "#94a3b8" },
  validated: { bg: "bg-blue-400", text: "text-blue-600", soft: "bg-blue-50", hex: "#60a5fa" },
  defined: { bg: "bg-indigo-400", text: "text-indigo-600", soft: "bg-indigo-50", hex: "#818cf8" },
  supply_locked: { bg: "bg-amber-400", text: "text-amber-600", soft: "bg-amber-50", hex: "#fbbf24" },
  listing: { bg: "bg-emerald-400", text: "text-emerald-600", soft: "bg-emerald-50", hex: "#34d399" },
  evaluating: { bg: "bg-purple-400", text: "text-purple-600", soft: "bg-purple-50", hex: "#c084fc" },
  archived: { bg: "bg-green-500", text: "text-green-600", soft: "bg-green-50", hex: "#22c55e" },
  discontinued: { bg: "bg-red-400", text: "text-red-600", soft: "bg-red-50", hex: "#f87171" }
};

function stuckForDays(enteredAt: string | undefined, days: number): boolean {
  if (!enteredAt) return false;
  const diff = Date.now() - new Date(enteredAt).getTime();
  return diff > days * 24 * 3600 * 1000;
}

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

  const openTasks = view.openTasks;
  const highPriorityTasks = openTasks.filter((t) => t.priority === "high");

  // Compute process overview stats
  const inProgress = data.products.filter(
    (p) => p.lifecycleStage && p.lifecycleStage !== "archived" && p.lifecycleStage !== "discontinued"
  ).length;
  const pendingDecision = data.products.filter(
    (p) => p.stageProgress?.some((sp) => sp.decisions && sp.decisions.length > 0 && sp.decisions[sp.decisions.length - 1].decision === "hold")
  ).length;
  const stuck = data.products.filter(
    (p) => {
      const progress = p.stageProgress?.find((sp) => sp.stage === p.lifecycleStage);
      if (!progress || !progress.checklist || progress.checklist.length === 0) return false;
      const completedRequired = progress.checklist.filter((c) => c.priority === "required" && c.checked).length;
      const requiredCount = progress.checklist.filter((c) => c.priority === "required").length;
      return requiredCount > 0 && completedRequired === 0 && stuckForDays(progress.enteredAt, 7);
    }
  ).length;

  const urgentCount = highPriorityTasks.length;
  const pendingCount = openTasks.length;

  const supplierFollows = data.suppliers.filter((s) => {
    const recentTasks = data.tasks.filter(
      (t) => t.supplierId === s.id && t.status !== "done"
    );
    return recentTasks.length > 0;
  }).length;

  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Left Column: Knowledge Insight Card */}
      <div className="lg:col-span-1 space-y-6">
        <KnowledgeCalendar />
      </div>

      {/* Right Column: Process Overview + Quick Actions + Tasks */}
      <div className="lg:col-span-1 space-y-6">
        {/* Product process overview */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-action" />
              <h2 className="font-semibold text-ink">进程概况</h2>
            </div>
            <Link href="/products" className="text-xs text-action hover:text-action-strong transition-colors flex items-center gap-0.5">
              全部产品
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Product process */}
            <div className="rounded-xl bg-paper-warm/50 p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-action" />
                <span className="text-xs font-semibold text-ink">产品进程</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-ink">{inProgress}</span>
                  <span className="text-[11px] text-muted">个在推进</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-warning">{pendingDecision}</span>
                  <span className="text-[11px] text-muted">个待决策</span>
                </div>
                {stuck > 0 && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-danger">{stuck}</span>
                    <span className="text-[11px] text-muted">个卡住</span>
                  </div>
                )}
              </div>
            </div>

            {/* Today's tasks */}
            <div className="rounded-xl bg-paper-warm/50 p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-warning" />
                <span className="text-xs font-semibold text-ink">今日待办</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-ink">{pendingCount}</span>
                  <span className="text-[11px] text-muted">项待处理</span>
                </div>
                {urgentCount > 0 ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-danger">{urgentCount}</span>
                    <span className="text-[11px] text-muted">项紧急</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted">暂无紧急项</div>
                )}
              </div>
            </div>

            {/* Suppliers */}
            <div className="rounded-xl bg-paper-warm/50 p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-success" />
                <span className="text-xs font-semibold text-ink">供应商</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-ink">{data.suppliers.length}</span>
                  <span className="text-[11px] text-muted">家合作</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-warning">{supplierFollows}</span>
                  <span className="text-[11px] text-muted">家待跟进</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid gap-3 grid-cols-3">
          <StatCard
            label="活跃产品"
            hint={`${inProgress} 个推进中`}
            value={inProgress}
            icon={Lightbulb}
            color="action"
            href="/products"
          />
          <StatCard
            label="供应商"
            hint={`${data.suppliers.length} 家合作`}
            value={data.suppliers.length}
            icon={Factory}
            color="warning"
            href="/suppliers"
          />
          <StatCard
            label="货盘"
            hint={`${data.offers.length} 个在盘`}
            value={data.offers.length}
            icon={ShoppingCart}
            color="success"
            href="/offers"
          />
        </div>

        {/* Quick action buttons */}
        <section className="animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-action" />
            <h2 className="font-semibold text-ink">快速入口</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickButton href="/intake" icon={Zap} label="快速录入" />
            <QuickButton href="/tasks" icon={CheckSquare} label="查看待办" badge={pendingCount} badgeColor="warning" />
            <QuickButton href="/products" icon={Lightbulb} label="产品进程" badge={inProgress} badgeColor="action" />
            <QuickButton href="/projects" icon={Package} label="品类项目" />
          </div>
        </section>

        {/* Segmented tasks */}
        <section className="animate-fade-up">
          <div className="rounded-3xl border border-warning/20 bg-gradient-to-br from-surface via-surface to-warning-soft/30 p-5 shadow-card transition-all md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-soft border border-warning/20 shadow-subtle">
                  <CheckSquare className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h2 className="font-semibold text-ink text-lg">待办事项</h2>
                  <p className="text-xs text-muted">
                    {openTasks.length > 0 ? (
                      <>还有 <span className="font-semibold text-warning">{openTasks.length}</span> 项待处理</>
                    ) : "当前没有待办事项"}
                  </p>
                </div>
              </div>
              <Link href="/tasks" className="flex items-center gap-1 text-sm font-medium text-action hover:text-action-strong transition-colors">
                全部待办
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {openTasks.length === 0 ? (
              <div className="rounded-2xl bg-paper-warm/60 border border-line-soft px-4 py-8 text-center">
                <CheckSquare className="mx-auto mb-3 h-9 w-9 text-muted-light" />
                <p className="text-sm text-muted">目前没有未完成待办，可以从快速录入开始。</p>
                <Link href="/intake" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-action hover:text-action-strong">
                  去录入一条沟通 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {highPriorityTasks.length > 0 && (
                  <TaskSegment title="紧急待办" color="danger" icon={AlertCircle} count={highPriorityTasks.length} tasks={highPriorityTasks.slice(0, 3)} />
                )}
                {openTasks.filter((t) => t.type === "product_stage").length > 0 && (
                  <TaskSegment title="产品阶段" color="action" icon={Lightbulb} count={openTasks.filter((t) => t.type === "product_stage").length} tasks={openTasks.filter((t) => t.type === "product_stage").slice(0, 5)} />
                )}
                {openTasks.filter((t) => t.supplierId || t.supplierName).length > 0 && (
                  <TaskSegment title="供应商跟进" color="warning" icon={Truck} count={openTasks.filter((t) => t.supplierId || t.supplierName).length} tasks={openTasks.filter((t) => t.supplierId || t.supplierName).slice(0, 5)} />
                )}
                {openTasks.filter((t) => !t.priority || t.priority === "low").length > 0 && (
                  <TaskSegment title="其他待办" color="muted" icon={CheckSquare} count={openTasks.filter((t) => !t.priority || t.priority === "low").length} tasks={openTasks.filter((t) => !t.priority || t.priority === "low").slice(0, 5)} />
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label, hint, value, icon: Icon, color, href
}: {
  label: string; hint: string; value: number; icon: React.ComponentType<{ className?: string }>;
  color: "action" | "warning" | "success"; href: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; soft: string; border: string }> = {
    action: { bg: "bg-action", text: "text-action", soft: "bg-action-soft", border: "border-action/20" },
    warning: { bg: "bg-warning", text: "text-warning", soft: "bg-warning-soft", border: "border-warning/20" },
    success: { bg: "bg-success", text: "text-success", soft: "bg-success-soft", border: "border-success/20" }
  };
  const cfg = colorMap[color];
  return (
    <Link href={href} className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex items-start justify-between relative">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.soft} border ${cfg.border}`}>
          <Icon className={`h-5 w-5 ${cfg.text}`} />
        </div>
        <ChevronRight className="h-4 w-4 text-muted-light transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-3 relative">
        <div className="text-2xl font-bold text-ink">{value}</div>
        <p className="text-xs text-muted mt-0.5">{label}</p>
        <p className="text-[11px] text-muted-light mt-0.5">{hint}</p>
      </div>
    </Link>
  );
}

function QuickButton({
  href, icon: Icon, label, badge, badgeColor
}: {
  href: string; icon: React.ComponentType<{ className?: string }>; label: string;
  badge?: number; badgeColor?: "action" | "warning" | "danger";
}) {
  const badgeColors: Record<string, string> = {
    action: "bg-action text-white",
    warning: "bg-warning text-white",
    danger: "bg-danger text-white"
  };
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-subtle transition-all hover:-translate-y-0.5 hover:border-action/30 hover:shadow-card"
    >
      <Icon className="h-4 w-4 text-action" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${badgeColors[badgeColor || "action"]}`}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function TaskSegment({
  title, color, icon: Icon, count, tasks
}: {
  title: string; color: "danger" | "action" | "warning" | "muted";
  icon: React.ComponentType<{ className?: string }>; count: number;
  tasks: Array<{ id: string; title: string; priority: string; dueText?: string; supplierName?: string; productId?: string; productName?: string }>;
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string; soft: string; dot: string }> = {
    danger: { bg: "bg-danger", text: "text-danger", border: "border-danger/20", soft: "bg-danger-soft/30", dot: "bg-danger" },
    action: { bg: "bg-action", text: "text-action", border: "border-action/20", soft: "bg-action-soft/30", dot: "bg-action" },
    warning: { bg: "bg-warning", text: "text-warning", border: "border-warning/20", soft: "bg-warning-soft/30", dot: "bg-warning" },
    muted: { bg: "bg-muted-light", text: "text-muted", border: "border-line", soft: "bg-paper-warm", dot: "bg-muted-light" }
  };
  const cfg = colorMap[color];

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.soft} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${cfg.bg} text-white`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-ink">{title}</span>
        </div>
        <span className="text-[11px] font-semibold text-muted">{count} 项</span>
      </div>
      <div className="space-y-1.5">
        {tasks.slice(0, 4).map((task) => (
          <Link
            key={task.id}
            href={task.productId ? `/products/${task.productId}` : "/tasks"}
            className="group flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-2 text-sm hover:bg-white transition-all cursor-pointer"
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${task.priority === "high" ? "bg-danger" : task.priority === "medium" ? "bg-warning" : "bg-muted-light"}`} />
            <span className="text-ink truncate flex-1">{task.title}</span>
            {task.dueText && <span className="text-[10px] text-muted-light shrink-0">{task.dueText}</span>}
            {task.productName && !task.dueText && <span className="text-[10px] text-muted-light shrink-0 truncate max-w-[60px]">{task.productName}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
