"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Pin, PinOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { includesQuery, loadLocalWorkbenchData, saveLocalWorkbenchData, type LocalTask } from "@/features/workbench/local-store";
import { labelPriority, labelTaskType } from "@/features/workbench/display-labels";

type SortField = "createdAt" | "priority";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "status" | "supplier" | "priority";

export default function TasksPage() {
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<LocalTask>>({});
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "done">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    title: "",
    dueText: "",
    priority: "medium" as "high" | "medium" | "low",
    type: "follow_up" as string,
    supplierId: ""
  });

  const data = loadLocalWorkbenchData();
  const tasks = data.tasks;
  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => { if (t.supplierId && t.supplierName) map.set(t.supplierId, t.supplierName); });
    return [...map.entries()];
  }, [tasks]);

  const filtered = useMemo(() => {
    let result = tasks.filter((task) => {
      const matchesQuery = includesQuery([task.title, task.dueText, task.priority, task.type, task.status], query);
      const matchesSupplier = !filterSupplier || task.supplierId === filterSupplier;
      const matchesStatus = filterStatus === "all" || task.status === filterStatus;
      return matchesQuery && matchesSupplier && matchesStatus;
    });

    // 置顶优先
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

  const grouped = useMemo(() => {
    if (groupBy === "none") return { "": filtered };
    const groups: Record<string, LocalTask[]> = {};
    filtered.forEach((task) => {
      let key = "";
      if (groupBy === "status") key = task.status === "done" ? "已完成" : "待处理";
      if (groupBy === "supplier") key = task.supplierName || "未关联供应商";
      if (groupBy === "priority") key = labelPriority(task.priority);
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    return groups;
  }, [filtered, groupBy]);

  function updateTaskStatus(taskId: string, status: "open" | "done") {
    saveLocalWorkbenchData({
      ...data,
      tasks: data.tasks.map((task) => (task.id === taskId ? { ...task, status } : task))
    });
    setVersion((current) => current + 1);
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
    const newTask: LocalTask = {
      id: crypto.randomUUID(),
      title: createDraft.title.trim(),
      dueText: createDraft.dueText || undefined,
      priority: createDraft.priority,
      type: createDraft.type || "follow_up",
      status: "open",
      createdAt: new Date().toISOString(),
      supplierId: supplier?.id,
      supplierName: supplier?.name
    };
    saveLocalWorkbenchData({ ...data, tasks: [newTask, ...data.tasks] });
    setCreateDraft({ title: "", dueText: "", priority: "medium", type: "follow_up", supplierId: "" });
    setShowCreate(false);
    setVersion((v) => v + 1);
  }

  function cancelCreate() {
    setShowCreate(false);
    setCreateDraft({ title: "", dueText: "", priority: "medium", type: "follow_up", supplierId: "" });
  }

  const groupOrder = groupBy === "status" ? ["待处理", "已完成"] : Object.keys(grouped).sort();

  return (
    <div className="space-y-5" data-version={version}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">待办提醒</h1>
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
            className="w-full rounded-md border border-line px-3 py-2 text-sm sm:w-72"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索待办、时间、优先级、状态"
            value={query}
          />
        </div>
      </div>

      {/* 新建待办弹窗 */}
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
            </div>
            <div className="flex gap-2">
              <button className="rounded-xl bg-action px-4 py-2 text-sm font-semibold text-white" onClick={saveCreate} type="button">保存</button>
              <button className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:text-ink" onClick={cancelCreate} type="button">取消</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 筛选与排序工具栏 */}
      {tasks.length > 0 ? (
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

          <select
            className="rounded-md border border-line bg-white px-2 py-1.5 text-xs"
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            value={groupBy}
          >
            <option value="none">不分组</option>
            <option value="status">按状态分组</option>
            <option value="supplier">按供应商分组</option>
            <option value="priority">按优先级分组</option>
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
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState title="还没有待办" description="确认报价、跟进样品、复盘供应商等事项会从沟通中生成。" actionHref="/intake" actionLabel="录入沟通" />
      ) : (
        <div className="space-y-4">
          {groupOrder.map((groupKey) => (
            <div key={groupKey}>
              {groupBy !== "none" && grouped[groupKey] ? (
                <div className="mb-2 flex items-center gap-2">
                  <ChevronDown className="h-4 w-4 text-muted" />
                  <span className="text-sm font-medium text-muted">{groupKey}</span>
                  <span className="text-xs text-muted-light">({grouped[groupKey].length})</span>
                </div>
              ) : null}
              <div className="grid gap-3">
                {(grouped[groupKey] || []).map((task) => (
                  <div className={`rounded-lg border border-line bg-white p-4 ${task.status === "done" ? "opacity-65" : ""} ${task.pinned ? "border-warning/30" : ""}`} key={task.id}>
                    {editingId === task.id ? (
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
                          <button className="rounded-md bg-action px-3 py-1.5 text-xs text-white" onClick={() => saveEdit(task.id)} type="button">保存</button>
                          <button className="rounded-md border border-line px-3 py-1.5 text-xs" onClick={cancelEdit} type="button">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            {task.pinned ? <Pin className="h-3.5 w-3.5 text-warning shrink-0" /> : null}
                            <div className={task.status === "done" ? "font-medium line-through" : "font-medium"}>{task.title}</div>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                              task.priority === "high" ? "bg-danger-soft text-danger" : task.priority === "medium" ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
                            }`}>
                              {labelPriority(task.priority)}
                            </span>
                            <span>{task.status === "done" ? "已完成" : "待处理"}</span>
                            {task.dueText ? <span>{task.dueText}</span> : null}
                            {task.type ? <span className="text-slate-500">{labelTaskType(task.type)}</span> : null}
                            {task.supplierName ? (
                              <Link className="text-action hover:underline" href={`/suppliers/${task.supplierId}`}>{task.supplierName}</Link>
                            ) : null}
                            {task.offerName ? (
                              <Link className="text-action hover:underline" href={`/offers/${task.offerId}`}>{task.offerName}</Link>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {task.status === "done" ? (
                            <button className="rounded-md border border-line p-2 text-sm text-muted hover:text-ink" onClick={() => updateTaskStatus(task.id, "open")} title="恢复" type="button">
                              <Check className="h-4 w-4" />
                            </button>
                          ) : (
                            <button className="rounded-md bg-action p-2 text-sm text-white" onClick={() => updateTaskStatus(task.id, "done")} title="完成" type="button">
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button className="rounded-md border border-line p-2 text-sm text-muted hover:text-ink" onClick={() => startEdit(task)} title="编辑" type="button">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className={`rounded-md border border-line p-2 text-sm ${task.pinned ? "text-warning" : "text-muted hover:text-warning"}`} onClick={() => togglePin(task.id)} title={task.pinned ? "取消置顶" : "置顶"} type="button">
                            {task.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                          </button>
                          <button className="rounded-md border border-line p-2 text-sm text-muted hover:text-danger" onClick={() => deleteTask(task.id)} title="删除" type="button">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 ? <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">没有匹配结果。</div> : null}
        </div>
      )}
    </div>
  );
}
