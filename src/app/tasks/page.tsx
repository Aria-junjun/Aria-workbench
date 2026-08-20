"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Pin, PinOff, Pencil, Plus, Trash2, X, AlertCircle, Lightbulb, Package, Truck, CheckSquare } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { applyTaskReviewToProduct, includesQuery, saveLocalWorkbenchData, type LocalTask } from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import { labelPriority, labelReviewOutcome, labelTaskType } from "@/features/workbench/display-labels";
import { getStageMeta } from "@/features/workbench/stage-checklist-template";
import { randomId } from "@/lib/random-id";

type SortField = "createdAt" | "priority";
type SortDir = "asc" | "desc";
type ReviewOutcome = "success" | "partial" | "failure" | "cancelled";
type SegmentKey = "urgent" | "product" | "supplier" | "other";

const segmentConfig: Record<SegmentKey, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; soft: string; dot: string; border: string }> = {
  urgent: { label: "紧急待办", icon: AlertCircle, color: "text-danger", soft: "bg-danger-soft", dot: "bg-danger", border: "border-danger/20" },
  product: { label: "产品阶段", icon: Lightbulb, color: "text-action", soft: "bg-action-soft", dot: "bg-action", border: "border-action/20" },
  supplier: { label: "供应商跟进", icon: Truck, color: "text-warning", soft: "bg-warning-soft", dot: "bg-warning", border: "border-warning/20" },
  other: { label: "其他待办", icon: CheckSquare, color: "text-muted", soft: "bg-paper-warm", dot: "bg-muted-light", border: "border-line" }
};

const stageColors: Record<string, { bg: string; text: string }> = {
  signal: { bg: "bg-slate-400", text: "text-slate-600" },
  validated: { bg: "bg-blue-400", text: "text-blue-600" },
  defined: { bg: "bg-indigo-400", text: "text-indigo-600" },
  supply_locked: { bg: "bg-amber-400", text: "text-amber-600" },
  listing: { bg: "bg-emerald-400", text: "text-emerald-600" },
  evaluating: { bg: "bg-purple-400", text: "text-purple-600" },
  archived: { bg: "bg-green-500", text: "text-green-600" },
  discontinued: { bg: "bg-red-400", text: "text-red-600" }
};

function classifyTaskSegment(task: LocalTask): SegmentKey {
  if (task.priority === "high" && task.status !== "done") return "urgent";
  if (task.type === "product_stage" || task.productId) return "product";
  if (task.supplierId || task.supplierName) return "supplier";
  return "other";
}

export default function TasksPage() {
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<LocalTask>>({});
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "done">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [activeSegment, setActiveSegment] = useState<SegmentKey>("urgent");
  const [collapsedSegments, setCollapsedSegments] = useState<Record<SegmentKey, boolean>>({ urgent: false, product: false, supplier: false, other: false });
  const [createDraft, setCreateDraft] = useState({
    title: "",
    dueText: "",
    priority: "medium" as "high" | "medium" | "low",
    type: "follow_up" as string,
    supplierId: "",
    productId: ""
  });
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<{ note: string; outcome: ReviewOutcome }>({ note: "", outcome: "success" });

  const data = useWorkbenchData();
  const tasks = data.tasks;
  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => { if (t.supplierId && t.supplierName) map.set(t.supplierId, t.supplierName); });
    return [...map.entries()];
  }, [tasks]);

  const filtered = useMemo(() => {
    let result = tasks.filter((task) => {
      const matchesQuery = includesQuery([task.title, task.dueText, task.priority, task.type, task.status, task.productName, task.productStage], query);
      const matchesSupplier = !filterSupplier || task.supplierId === filterSupplier;
      const matchesStatus = filterStatus === "all" || task.status === filterStatus;
      return matchesQuery && matchesSupplier && matchesStatus;
    });

    result.sort((a, b) => {
      const aPin = a.pinned ? 1 : 0;
      const bPin = b.pinned ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      if (sortField === "createdAt") {
        return sortDir === "asc"
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortField === "priority") {
        const priorityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const diff = (priorityMap[a.priority] || 0) - (priorityMap[b.priority] || 0);
        return sortDir === "asc" ? diff : -diff;
      }
      return 0;
    });

    return result;
  }, [tasks, query, filterSupplier, filterStatus, sortField, sortDir]);

  const segmentedTasks = useMemo(() => {
    const grouped: Record<SegmentKey, LocalTask[]> = { urgent: [], product: [], supplier: [], other: [] };
    for (const task of filtered) {
      const seg = classifyTaskSegment(task);
      grouped[seg].push(task);
    }
    return grouped;
  }, [filtered]);

  const segmentStats = useMemo(() => {
    const stats: Record<SegmentKey, { total: number; done: number }> = {
      urgent: { total: 0, done: 0 },
      product: { total: 0, done: 0 },
      supplier: { total: 0, done: 0 },
      other: { total: 0, done: 0 }
    };
    for (const task of filtered) {
      const seg = classifyTaskSegment(task);
      stats[seg].total += 1;
      if (task.status === "done") stats[seg].done += 1;
    }
    return stats;
  }, [filtered]);

  function updateTaskStatus(taskId: string, status: "open" | "done") {
    saveLocalWorkbenchData({
      ...data,
      tasks: data.tasks.map((task) => (task.id === taskId ? { ...task, status } : task))
    });
    setVersion((current) => current + 1);
  }

  function startReview(task: LocalTask) {
    setReviewingTaskId(task.id);
    setReviewDraft({
      note: task.reviewNote || "",
      outcome: (task.reviewOutcome as ReviewOutcome) || "success"
    });
  }

  function submitReview(taskId: string) {
    const now = new Date().toISOString();
    const patch: Partial<LocalTask> = {
      status: "done",
      reviewNote: reviewDraft.note.trim() || undefined,
      reviewOutcome: reviewDraft.outcome,
      reviewedAt: now
    };
    saveLocalWorkbenchData({
      ...data,
      tasks: data.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } as LocalTask : task))
    });
    applyTaskReviewToProduct(taskId);
    setReviewingTaskId(null);
    setReviewDraft({ note: "", outcome: "success" });
    setVersion((current) => current + 1);
  }

  function cancelReview() {
    setReviewingTaskId(null);
    setReviewDraft({ note: "", outcome: "success" });
  }

  function togglePin(taskId: string) {
    saveLocalWorkbenchData({
      ...data,
      tasks: data.tasks.map((task) => (task.id === taskId ? { ...task, pinned: !task.pinned } : task))
    });
    setVersion((current) => current + 1);
  }

  function deleteTask(taskId: string) {
    if (!window.confirm("确认删除这条待办吗？")) return;
    saveLocalWorkbenchData({
      ...data,
      tasks: data.tasks.filter((task) => task.id !== taskId)
    });
    setVersion((current) => current + 1);
  }

  function startEdit(task: LocalTask) {
    setEditingId(task.id);
    setEditDraft({ title: task.title, priority: task.priority, dueText: task.dueText, type: task.type });
  }

  function saveEdit(taskId: string) {
    saveLocalWorkbenchData({
      ...data,
      tasks: data.tasks.map((task) =>
        task.id === taskId ? { ...task, ...editDraft } as LocalTask : task
      )
    });
    setEditingId(null);
    setEditDraft({});
    setVersion((current) => current + 1);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({});
  }

  function saveCreate() {
    if (!createDraft.title.trim()) return;
    const supplier = data.suppliers.find((s) => s.id === createDraft.supplierId);
    const product = data.products.find((p) => p.id === createDraft.productId);
    const newTask: LocalTask = {
      id: randomId(),
      title: createDraft.title.trim(),
      dueText: createDraft.dueText || undefined,
      priority: createDraft.priority,
      type: createDraft.type || "follow_up",
      status: "open",
      createdAt: new Date().toISOString(),
      supplierId: supplier?.id,
      supplierName: supplier?.name,
      productId: product?.id,
      productName: product?.name,
      pinned: false
    };
    saveLocalWorkbenchData({ ...data, tasks: [newTask, ...data.tasks] });
    setCreateDraft({ title: "", dueText: "", priority: "medium", type: "follow_up", supplierId: "", productId: "" });
    setShowCreate(false);
    setVersion((v) => v + 1);
  }

  function cancelCreate() {
    setShowCreate(false);
    setCreateDraft({ title: "", dueText: "", priority: "medium", type: "follow_up", supplierId: "", productId: "" });
  }

  function toggleSegmentCollapse(key: SegmentKey) {
    setCollapsedSegments((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const products = data.products;
  const openFiltered = filtered.filter((t) => t.status !== "done");
  const doneFiltered = filtered.filter((t) => t.status === "done");

  return (
    <div className="space-y-5" data-version={version}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">待办提醒</h1>
          <p className="mt-1 text-xs text-muted">
            {openFiltered.length > 0
              ? <>待处理 <span className="font-semibold text-warning">{openFiltered.length}</span> 项 · 已完成 {doneFiltered.length} 项</>
              : "当前没有待办事项"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-action px-4 py-2 text-sm font-semibold text-white shadow-subtle hover:shadow-card transition-all"
            onClick={() => setShowCreate(true)}
            type="button"
          >
            <Plus className="h-4 w-4" />
            新建待办
          </button>
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm sm:w-72"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索待办、时间、优先级、产品"
            value={query}
          />
        </div>
      </div>

      {showCreate ? (
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-ink">新建待办</h2>
            <button className="rounded-md p-1 text-muted hover:text-ink" onClick={cancelCreate} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-action/20 focus:border-action"
              onChange={(e) => setCreateDraft({ ...createDraft, title: e.target.value })}
              placeholder="待办标题，例如：找京东防油贴新品货源"
              value={createDraft.title}
            />
            <div className="flex flex-wrap gap-3">
              <select
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
                onChange={(e) => setCreateDraft({ ...createDraft, priority: e.target.value as "high" | "medium" | "low" })}
                value={createDraft.priority}
              >
                <option value="high">高优先级</option>
                <option value="medium">中优先级</option>
                <option value="low">低优先级</option>
              </select>
              <input
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
                onChange={(e) => setCreateDraft({ ...createDraft, dueText: e.target.value })}
                placeholder="截止时间，如：本周五"
                value={createDraft.dueText}
              />
              <select
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
                onChange={(e) => setCreateDraft({ ...createDraft, type: e.target.value })}
                value={createDraft.type}
              >
                <option value="follow_up">跟进</option>
                <option value="confirm_quote">确认报价</option>
                <option value="follow_sample">跟踪样品</option>
                <option value="confirm_moq">确认MOQ</option>
                <option value="confirm_lead_time">确认交期</option>
                <option value="supplement_product_knowledge">补充产品知识</option>
                <option value="review_supplier">复盘供应商</option>
              </select>
              <select
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
                onChange={(e) => setCreateDraft({ ...createDraft, supplierId: e.target.value })}
                value={createDraft.supplierId}
              >
                <option value="">不关联供应商</option>
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
                onChange={(e) => setCreateDraft({ ...createDraft, productId: e.target.value })}
                value={createDraft.productId}
              >
                <option value="">不关联产品</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="rounded-xl bg-action px-4 py-2 text-sm font-semibold text-white" onClick={saveCreate} type="button">保存</button>
              <button className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:text-ink" onClick={cancelCreate} type="button">取消</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Segmented view */}
      {filtered.length === 0 ? (
        <EmptyState title="还没有待办" description="确认报价、跟进样品、复盘供应商等事项会从沟通中生成。" actionHref="/intake" actionLabel="录入沟通" />
      ) : (
        <div className="space-y-4">
          {/* Segment tabs */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2">
            {(["urgent", "product", "supplier", "other"] as SegmentKey[]).map((seg) => {
              const cfg = segmentConfig[seg];
              const Icon = cfg.icon;
              const isActive = activeSegment === seg;
              const stats = segmentStats[seg];
              return (
                <button
                  key={seg}
                  onClick={() => setActiveSegment(seg)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    isActive
                      ? `${cfg.soft} ${cfg.color} border ${cfg.border}`
                      : "text-muted hover:bg-paper-warm"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{cfg.label}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? "bg-white/60" : "bg-paper-warm"}`}>
                    {stats.total - stats.done}/{stats.total}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active segment */}
          <SegmentPanel
            segmentKey={activeSegment}
            tasks={segmentedTasks[activeSegment]}
            products={products}
            collapsed={collapsedSegments[activeSegment]}
            onToggleCollapse={() => toggleSegmentCollapse(activeSegment)}
            editingId={editingId}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onUpdateStatus={updateTaskStatus}
            onStartReview={startReview}
            reviewingTaskId={reviewingTaskId}
            reviewDraft={reviewDraft}
            setReviewDraft={setReviewDraft}
            onSubmitReview={submitReview}
            onCancelReview={cancelReview}
            onTogglePin={togglePin}
            onDelete={deleteTask}
            data={data}
          />

          {/* Other segments collapsed */}
          {(["product", "supplier", "other"] as SegmentKey[])
            .filter((seg) => seg !== activeSegment && segmentedTasks[seg].length > 0)
            .map((seg) => {
              const cfg = segmentConfig[seg];
              const Icon = cfg.icon;
              const stats = segmentStats[seg];
              const isCollapsed = collapsedSegments[seg];
              return (
                <div key={seg} className={`rounded-2xl border ${cfg.border} bg-surface shadow-card overflow-hidden`}>
                  <button
                    onClick={() => toggleSegmentCollapse(seg)}
                    className="flex w-full items-center justify-between px-4 py-3 hover:bg-paper-warm/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted rotate-180" />}
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${cfg.soft}`}>
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <span className="font-semibold text-ink">{cfg.label}</span>
                      <span className="text-xs text-muted">
                        待 {stats.total - stats.done} / 共 {stats.total}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-paper-warm">
                        <div
                          className={`h-full ${cfg.dot}`}
                          style={{ width: `${stats.total > 0 ? ((stats.total - stats.done) / stats.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="border-t border-line bg-white/50 p-3 space-y-1.5">
                      {segmentedTasks[seg].slice(0, 3).map((task) => (
                        <div key={task.id} className="rounded-lg bg-paper-warm/40 px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${task.priority === "high" ? "bg-danger" : task.priority === "medium" ? "bg-warning" : "bg-muted-light"}`} />
                            <span className="text-ink truncate flex-1">{task.title}</span>
                            {task.productName && <span className="text-[10px] text-muted-light">· {task.productName}</span>}
                            {task.dueText && <span className="text-[10px] text-muted-light">· {task.dueText}</span>}
                          </div>
                        </div>
                      ))}
                      {segmentedTasks[seg].length > 3 && (
                        <button
                          onClick={() => setActiveSegment(seg)}
                          className="w-full rounded-lg py-1.5 text-xs text-action hover:bg-action-soft/30 transition-colors"
                        >
                          查看全部 {segmentedTasks[seg].length} 项 →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Filter toolbar */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3">
            <select
              className="rounded-md border border-line bg-white px-2 py-1.5 text-xs"
              onChange={(e) => setFilterStatus(e.target.value as "all" | "open" | "done")}
              value={filterStatus}
            >
              <option value="all">全部状态</option>
              <option value="open">待处理</option>
              <option value="done">已完成</option>
            </select>

            <select
              className="rounded-md border border-line bg-white px-2 py-1.5 text-xs"
              onChange={(e) => setFilterSupplier(e.target.value)}
              value={filterSupplier}
            >
              <option value="">全部供应商</option>
              {suppliers.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>

            <div className="mx-1 h-5 w-px bg-line" />

            <button
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${sortField === "priority" ? "bg-action-soft text-action font-medium" : "text-muted"}`}
              onClick={() => { setSortField("priority"); setSortDir((d) => d === "asc" ? "desc" : "asc"); }}
              type="button"
            >
              优先级 {sortField === "priority" ? (sortDir === "asc" ? "↑" : "↓") : null}
            </button>
            <button
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${sortField === "createdAt" ? "bg-action-soft text-action font-medium" : "text-muted"}`}
              onClick={() => { setSortField("createdAt"); setSortDir((d) => d === "asc" ? "desc" : "asc"); }}
              type="button"
            >
              时间 {sortField === "createdAt" ? (sortDir === "asc" ? "↑" : "↓") : null}
            </button>
          </div>

          {filtered.length === 0 ? <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">没有匹配结果。</div> : null}
        </div>
      )}
    </div>
  );
}

interface SegmentPanelProps {
  segmentKey: SegmentKey;
  tasks: LocalTask[];
  products: LocalTask[] extends never ? never : ReturnType<typeof useWorkbenchData>["products"];
  collapsed: boolean;
  onToggleCollapse: () => void;
  editingId: string | null;
  editDraft: Partial<LocalTask>;
  setEditDraft: (d: Partial<LocalTask>) => void;
  onStartEdit: (t: LocalTask) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onUpdateStatus: (id: string, status: "open" | "done") => void;
  onStartReview: (t: LocalTask) => void;
  reviewingTaskId: string | null;
  reviewDraft: { note: string; outcome: ReviewOutcome };
  setReviewDraft: (d: { note: string; outcome: ReviewOutcome }) => void;
  onSubmitReview: (id: string) => void;
  onCancelReview: () => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  data: ReturnType<typeof useWorkbenchData>;
}

function SegmentPanel(props: SegmentPanelProps) {
  const {
    segmentKey,
    tasks,
    products,
    collapsed,
    onToggleCollapse,
    editingId,
    editDraft,
    setEditDraft,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onUpdateStatus,
    onStartReview,
    reviewingTaskId,
    reviewDraft,
    setReviewDraft,
    onSubmitReview,
    onCancelReview,
    onTogglePin,
    onDelete,
    data
  } = props;

  const cfg = segmentConfig[segmentKey];
  const Icon = cfg.icon;
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={`rounded-2xl border ${cfg.border} bg-surface shadow-card`}>
      <button
        onClick={onToggleCollapse}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-paper-warm/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted rotate-180" />}
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cfg.soft}`}>
            <Icon className={`h-5 w-5 ${cfg.color}`} />
          </div>
          <div className="text-left">
            <div className="font-semibold text-ink">{cfg.label}</div>
            <div className="text-xs text-muted">
              待 {total - done} · 已完成 {done} · 共 {total}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-ink">{progressPct}%</div>
            <div className="text-[11px] text-muted">完成率</div>
          </div>
          <div className="h-10 w-32 overflow-hidden rounded-full bg-paper-warm">
            <div
              className={`h-full transition-all duration-500 ${cfg.dot}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </button>

      {!collapsed && tasks.length > 0 && (
        <div className="border-t border-line bg-white/30 p-3 space-y-2">
          {tasks.map((task) => {
            const isEditing = editingId === task.id;
            const isReviewing = reviewingTaskId === task.id;
            const stage = task.productStage;
            const stageMeta = stage ? getStageMeta(stage as never) : null;
            const stageColor = stage ? stageColors[stage] : null;
            const product = task.productId ? products.find((p) => p.id === task.productId) : null;
            const progress = product && stage ? product.stageProgress?.find((sp) => sp.stage === stage) : null;
            const checklist = progress?.checklist ?? [];
            const completedRequired = checklist.filter((c) => c.priority === "required" && c.checked).length;
            const requiredCount = checklist.filter((c) => c.priority === "required").length;

            return (
              <div
                key={task.id}
                className={`rounded-xl border bg-white p-3 ${task.status === "done" ? "opacity-70" : ""} ${task.pinned ? "border-warning/40" : "border-line-soft"}`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-md border border-line px-3 py-2 text-sm"
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      value={editDraft.title || ""}
                    />
                    <div className="flex flex-wrap gap-3">
                      <select
                        className="rounded-md border border-line bg-white px-2 py-1.5 text-xs"
                        onChange={(e) => setEditDraft({ ...editDraft, priority: e.target.value })}
                        value={editDraft.priority || "medium"}
                      >
                        <option value="high">高优先级</option>
                        <option value="medium">中优先级</option>
                        <option value="low">低优先级</option>
                      </select>
                      <input
                        className="rounded-md border border-line px-2 py-1.5 text-xs"
                        onChange={(e) => setEditDraft({ ...editDraft, dueText: e.target.value })}
                        placeholder="截止时间"
                        value={editDraft.dueText || ""}
                      />
                      <input
                        className="rounded-md border border-line px-2 py-1.5 text-xs"
                        onChange={(e) => setEditDraft({ ...editDraft, type: e.target.value })}
                        placeholder="类型"
                        value={editDraft.type || ""}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-md bg-action px-3 py-1.5 text-xs text-white" onClick={() => onSaveEdit(task.id)} type="button">保存</button>
                      <button className="rounded-md border border-line px-3 py-1.5 text-xs" onClick={onCancelEdit} type="button">取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {task.pinned ? <Pin className="h-3.5 w-3.5 text-warning shrink-0" /> : null}
                          <span className={`font-medium ${task.status === "done" ? "line-through text-muted" : "text-ink"}`}>{task.title}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                            task.priority === "high" ? "bg-danger-soft text-danger" : task.priority === "medium" ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
                          }`}>
                            {labelPriority(task.priority)}
                          </span>
                          <span className={task.status === "done" ? "text-success" : "text-muted"}>
                            {task.status === "done" ? "已完成" : "待处理"}
                          </span>
                          {task.dueText ? <span className="text-muted">{task.dueText}</span> : null}
                          {task.type ? <span className="text-slate-500">{labelTaskType(task.type)}</span> : null}
                          {task.supplierName ? (
                            <Link className="text-action hover:underline flex items-center gap-0.5" href={`/suppliers/${task.supplierId}`}>
                              <Truck className="h-3 w-3" /> {task.supplierName}
                            </Link>
                          ) : null}
                          {task.productName ? (
                            <Link className="text-action hover:underline flex items-center gap-0.5" href={`/products/${task.productId}`}>
                              <Package className="h-3 w-3" /> {task.productName}
                            </Link>
                          ) : null}
                        </div>

                        {/* Product stage progress card */}
                        {segmentKey === "product" && stage && stageMeta && stageColor && !task.status.startsWith("done") && (
                          <div className="mt-2 rounded-lg border border-line-soft bg-paper-warm/40 p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${stageColor.bg} text-white`}>
                                  {stageMeta.title}
                                </span>
                                <span className="text-[10px] text-muted">产品阶段</span>
                              </div>
                              <span className="text-[11px] font-semibold text-muted">
                                {completedRequired}/{requiredCount} 强制项
                              </span>
                            </div>
                            {requiredCount > 0 && (
                              <div className="h-1 w-full overflow-hidden rounded-full bg-paper-warm">
                                <div
                                  className={`h-full rounded-full ${stageColor.bg} transition-all`}
                                  style={{ width: `${requiredCount > 0 ? (completedRequired / requiredCount) * 100 : 0}%` }}
                                />
                              </div>
                            )}
                            {progress?.decisions && progress.decisions.length > 0 && (
                              <div className="mt-1.5 text-[10px] text-muted flex items-center gap-1">
                                <span>{progress.decisions.length} 条决策记录</span>
                                {progress.completedAt && (
                                  <span>· 完成于 {new Date(progress.completedAt).toLocaleDateString()}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {task.status === "done" ? (
                          <button className="rounded-md border border-line p-2 text-sm text-muted hover:text-ink" onClick={() => onUpdateStatus(task.id, "open")} title="恢复" type="button">
                            <Check className="h-4 w-4" />
                          </button>
                        ) : (
                          <button className="rounded-md bg-action p-2 text-sm text-white" onClick={() => onStartReview(task)} title="标记完成并复盘" type="button">
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button className="rounded-md border border-line p-2 text-sm text-muted hover:text-ink" onClick={() => onStartEdit(task)} title="编辑" type="button">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className={`rounded-md border border-line p-2 text-sm ${task.pinned ? "text-warning" : "text-muted hover:text-warning"}`} onClick={() => onTogglePin(task.id)} title={task.pinned ? "取消置顶" : "置顶"} type="button">
                          {task.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </button>
                        <button className="rounded-md border border-line p-2 text-sm text-muted hover:text-danger" onClick={() => onDelete(task.id)} title="删除" type="button">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {isReviewing ? (
                      <div className="mt-3 rounded-lg border border-action/30 bg-action-soft/20 p-3">
                        <div className="mb-2 text-sm font-medium text-ink">完成复盘</div>
                        <textarea
                          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action/20 focus:border-action"
                          onChange={(e) => setReviewDraft({ ...reviewDraft, note: e.target.value })}
                          placeholder="实际结果 / 发现 / 教训（可选）"
                          rows={3}
                          value={reviewDraft.note}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            className="rounded-md border border-line bg-white px-2 py-1.5 text-xs"
                            onChange={(e) => setReviewDraft({ ...reviewDraft, outcome: e.target.value as ReviewOutcome })}
                            value={reviewDraft.outcome}
                          >
                            <option value="success">成功</option>
                            <option value="partial">部分达成</option>
                            <option value="failure">失败</option>
                            <option value="cancelled">取消</option>
                          </select>
                          <button className="rounded-md bg-action px-3 py-1.5 text-xs text-white" onClick={() => onSubmitReview(task.id)} type="button">提交复盘</button>
                          <button className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink" onClick={onCancelReview} type="button">取消</button>
                        </div>
                      </div>
                    ) : null}

                    {task.status === "done" && task.reviewedAt ? (
                      <div className="mt-3 rounded-md bg-paper p-2.5 text-xs text-slate-600">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium text-ink">复盘</span>
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 ${
                            task.reviewOutcome === "success" ? "bg-success-soft text-success"
                              : task.reviewOutcome === "partial" ? "bg-warning-soft text-warning"
                              : task.reviewOutcome === "failure" ? "bg-danger-soft text-danger"
                              : "bg-paper-warm text-muted"
                          }`}>
                            {labelReviewOutcome(task.reviewOutcome)}
                          </span>
                          <span className="text-muted">{new Date(task.reviewedAt).toLocaleString()}</span>
                        </div>
                        {task.reviewNote ? <div className="mt-1 whitespace-pre-wrap text-slate-700">{task.reviewNote}</div> : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Silence unused warning */}
      {false && <span className="sr-only">{data.tasks.length}</span>}
    </div>
  );
}
