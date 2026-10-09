"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { findDuplicateSuppliers, mergeSuppliers, sortPinnedFirst, togglePinned, createSupplier, archiveSupplier, restoreSupplier, type LocalSupplier } from "@/features/workbench/local-store";
import { deriveSupplierBusinessModes } from "@/features/workbench/dropship-decision-loop";
import { classifySupplierActivity } from "@/features/workbench/supplier-activity";
import { useWorkbenchData } from "@/features/workbench/workbench-store";

export default function SuppliersPage() {
  const data = useWorkbenchData();
  const [hydrated, setHydrated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [supplierToArchive, setSupplierToArchive] = useState<LocalSupplier | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [activityFilter, setActivityFilter] = useState<"active" | "low" | "all">("active");
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [duplicatePairs, setDuplicatePairs] = useState<ReturnType<typeof findDuplicateSuppliers>>([]);

  useEffect(() => setHydrated(true), []);
  const allSuppliers = hydrated ? (data?.suppliers ?? []) : [];
  const activeSuppliers = sortPinnedFirst(allSuppliers.filter((supplier) => !supplier.archivedAt));
  const archivedSuppliers = allSuppliers.filter((supplier) => supplier.archivedAt);
  const supplierActivity = hydrated && data ? classifySupplierActivity(data) : {};
  const activityCounts = {
    active: activeSuppliers.filter(supplier => supplierActivity[supplier.id]?.band !== "low").length,
    low: activeSuppliers.filter(supplier => supplierActivity[supplier.id]?.band === "low").length,
  };
  const visibleSuppliers = activeSuppliers.filter((supplier) => {
    const matchesActivity = activityFilter === "all" || (activityFilter === "low" ? supplierActivity[supplier.id]?.band === "low" : supplierActivity[supplier.id]?.band !== "low");
    const matchesQuery = `${supplier.name} ${supplier.shortName ?? ""} ${(supplier.categories ?? []).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesActivity && matchesQuery;
  });

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  function handleCreate() {
    if (!newName.trim()) return;
    createSupplier({ name: newName.trim(), location: newLocation.trim() || undefined });
    setNewName("");
    setNewLocation("");
    setShowCreate(false);
    refresh();
  }

  function handleArchive() {
    if (!supplierToArchive || !archiveReason.trim()) return;
    archiveSupplier(supplierToArchive.id, archiveReason);
    setSupplierToArchive(null);
    setArchiveReason("");
    refresh();
  }

  function handleDuplicateCheck() {
    setDuplicatePairs(findDuplicateSuppliers());
    setShowDuplicates(true);
  }

  function handleMerge(target: LocalSupplier, source: LocalSupplier) {
    if (!window.confirm(`确认将「${source.name}」合并到「${target.name}」吗？系统会迁移其关联资料，源档案随后移除。请先人工确认确为同一经营主体。`)) return;
    mergeSuppliers(target.id, source.id);
    setDuplicatePairs(findDuplicateSuppliers());
    refresh();
  }

  if (!hydrated) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-action border-t-transparent" /></div>;

  return <main className="space-y-5" data-refresh={refreshKey}>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs text-muted">供应商管理 · 档案</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">供应商档案</h1><p className="mt-1 text-sm text-muted">维护主体、联系人、合作范围与历史入口；业务绩效和跨供应商风险判断请到管理总览查看。</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Link className="inline-flex items-center gap-1 rounded border border-line px-3 py-2 text-xs hover:border-action" href="/supplier-lifecycle">管理总览 <span aria-hidden="true">→</span></Link>
        <button className="inline-flex items-center gap-1 rounded border border-line px-3 py-2 text-xs hover:border-action" onClick={handleDuplicateCheck} type="button"><span aria-hidden="true">↔</span>检测重复</button>
        {archivedSuppliers.length > 0 && <button className="rounded border border-line px-3 py-2 text-xs text-muted hover:border-action" onClick={() => setShowArchived(true)} type="button">已停用 {archivedSuppliers.length}</button>}
        <button className="inline-flex items-center gap-1 rounded border border-action bg-action px-3 py-2 text-xs text-white" onClick={() => setShowCreate(true)} type="button"><span aria-hidden="true">＋</span>新增供应商</button>
      </div>
    </header>

    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3"><div><h2 className="text-sm font-semibold">供应商名录 <span className="font-normal text-muted">{activityFilter === "low" ? activityCounts.low : activityFilter === "active" ? activityCounts.active : activeSuppliers.length} 家</span></h2><p className="mt-1 text-xs text-muted">代发按近30天统计周期内支付订单归类，少于30单列入低活跃；入仓供应商不套用代发门槛。低活跃只改变默认列表，不停用档案。</p></div><input aria-label="搜索供应商名称、简称或品类" className="w-full max-w-xs rounded border border-line px-3 py-2 text-sm" placeholder="搜索供应商名称、简称或品类" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2" aria-label="供应商活跃度筛选">{([["active", `常规名录 ${activityCounts.active}`], ["low", `低活跃 ${activityCounts.low}`], ["all", `全部 ${activeSuppliers.length}`]] as const).map(([key, label]) => <button aria-pressed={activityFilter === key} className={`rounded-full border px-3 py-1.5 text-xs ${activityFilter === key ? "border-action bg-action/10 text-action" : "border-line text-muted hover:border-action"}`} key={key} onClick={() => setActivityFilter(key)} type="button">{label}</button>)}</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] table-fixed text-sm"><colgroup><col className="w-[18%]"/><col className="w-[220px]"/><col className="w-[12%]"/><col className="w-[12%]"/><col className="w-[17%]"/><col className="w-[9%]"/><col className="w-[10%]"/></colgroup><thead className="bg-paper"><tr>{["供应商 / 简称", "操作", "实际业务归属", "联系人", "主营品类", "地区", "合作等级"].map((title) => <th className="border-b border-line px-3 py-3 text-left text-xs font-medium text-muted" key={title}>{title}</th>)}</tr></thead><tbody>
        {visibleSuppliers.map((supplier) => {
          const modes = deriveSupplierBusinessModes(data!, supplier.id);
          const activity = supplierActivity[supplier.id];
          return <tr className="border-b border-line last:border-0 hover:bg-paper/60" key={supplier.id}>
            <td className="px-3 py-3"><div className="font-medium">{supplier.shortName || supplier.name}</div>{supplier.shortName && <div className="mt-0.5 text-xs text-muted">{supplier.name}</div>}{activity?.band === "low" && <span className="mt-1 inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">低活跃 · {activity.paidOrders}单/30天</span>}</td>
            <td className="whitespace-nowrap px-3 py-3"><div className="flex items-center gap-2"><Link className="text-action hover:underline" href={`/suppliers/${supplier.id}`}>查看档案</Link><button aria-label={supplier.pinned ? "取消置顶" : "置顶"} className="text-xs text-muted hover:text-action" onClick={() => { togglePinned("suppliers", supplier.id); refresh(); }} type="button">{supplier.pinned ? "已置顶" : "置顶"}</button><button className="text-xs text-muted hover:text-danger" onClick={() => { setSupplierToArchive(supplier); setArchiveReason(""); }} type="button">停用</button></div></td>
            <td className="px-3 py-3"><div className="flex gap-1.5">{modes.includes("inbound") && <span className="rounded border border-line px-2 py-0.5 text-xs">入仓</span>}{modes.includes("dropship") && <span className="rounded border border-line px-2 py-0.5 text-xs">代发</span>}{!modes.length && <span className="text-xs text-muted">尚无已关联业务记录</span>}</div></td>
            <td className="px-3 py-3">{supplier.contactName || "—"}<div className="mt-0.5 text-xs text-muted">{supplier.contactMethod || ""}</div></td><td className="px-3 py-3">{supplier.categories?.join("、") || "—"}</td><td className="px-3 py-3">{supplier.location || "—"}</td><td className="px-3 py-3">{supplier.cooperationLevel || "未设等级"}</td>
          </tr>;
        })}
      </tbody></table>{!visibleSuppliers.length && <p className="px-4 py-10 text-center text-sm text-muted">{activeSuppliers.length ? activityFilter === "low" ? "暂无低活跃供应商" : "没有匹配的供应商" : "暂无供应商档案，可新增供应商开始维护"}</p>}</div>
      <div className="border-t border-line px-4 py-3 text-xs text-muted">档案负责主体与合作信息；订单 / 履约事实在业务台账维护，供应商间的风险与决策在<Link className="ml-1 text-action" href="/supplier-lifecycle">管理总览查看 →</Link></div>
    </section>

    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"><section aria-label="新增供应商" className="w-full max-w-md rounded-lg border border-line bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">新增供应商档案</h2><button aria-label="关闭新增供应商" className="text-muted" onClick={() => setShowCreate(false)} type="button">×</button></div><label className="mt-4 block text-xs text-muted">供应商全称<input autoFocus className="mt-1 w-full rounded border border-line px-3 py-2 text-sm" value={newName} onChange={(event) => setNewName(event.target.value)} /></label><label className="mt-3 block text-xs text-muted">地区（可选）<input className="mt-1 w-full rounded border border-line px-3 py-2 text-sm" value={newLocation} onChange={(event) => setNewLocation(event.target.value)} /></label><div className="mt-5 flex justify-end gap-2"><button className="rounded border border-line px-3 py-2 text-sm" onClick={() => setShowCreate(false)} type="button">取消</button><button className="rounded bg-action px-3 py-2 text-sm text-white disabled:opacity-50" disabled={!newName.trim()} onClick={handleCreate} type="button">保存档案</button></div></section></div>}
    {supplierToArchive && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"><section aria-label="停用供应商" className="w-full max-w-md rounded-lg border border-line bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">停用供应商</h2><button aria-label="关闭停用供应商" className="text-muted" onClick={() => setSupplierToArchive(null)} type="button">×</button></div><p className="mt-2 text-sm">确定停用「{supplierToArchive.shortName || supplierToArchive.name}」？档案及历史业务数据会保留，可之后恢复。</p><label className="mt-4 block text-xs text-muted">停用理由（必填）<textarea autoFocus className="mt-1 min-h-24 w-full resize-y rounded border border-line px-3 py-2 text-sm text-ink" maxLength={300} placeholder="例如：合作暂停、连续多个周期无业务、供应能力不匹配" value={archiveReason} onChange={event => setArchiveReason(event.target.value)} /></label><div className="mt-4 flex justify-end gap-2"><button className="rounded border border-line px-3 py-2 text-sm" onClick={() => setSupplierToArchive(null)} type="button">取消</button><button className="rounded bg-danger px-3 py-2 text-sm text-white disabled:opacity-50" disabled={!archiveReason.trim()} onClick={handleArchive} type="button">填写理由并停用</button></div></section></div>}
    {showArchived && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"><section aria-label="已停用供应商" className="w-full max-w-lg rounded-lg border border-line bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">已停用供应商</h2><p className="mt-1 text-xs text-muted">恢复后重新出现在当前名录，历史业务数据及最近一次停用理由保留。</p></div><button aria-label="关闭已停用供应商" className="text-muted" onClick={() => setShowArchived(false)} type="button">×</button></div><div className="mt-4 divide-y divide-line-soft border-y border-line-soft">{archivedSuppliers.map((supplier) => <div className="flex items-center justify-between gap-4 py-3" key={supplier.id}><div><span className="text-sm">{supplier.shortName || supplier.name}</span><p className="mt-1 text-xs text-muted">停用理由：{supplier.archiveReason || "历史停用原因未记录"}</p></div><button className="shrink-0 text-xs text-action" onClick={() => { restoreSupplier(supplier.id); setShowArchived(false); refresh(); }} type="button">恢复供应商</button></div>)}</div></section></div>}
    {showDuplicates && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"><section aria-label="重复供应商检测" className="w-full max-w-2xl rounded-lg border border-line bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">重复供应商检测</h2><p className="mt-1 text-xs text-muted">系统只提示疑似重复；合并前请人工核实是否同一经营主体。</p></div><button aria-label="关闭重复检测" className="text-muted" onClick={() => setShowDuplicates(false)} type="button">×</button></div>{duplicatePairs.length ? <div className="mt-4 space-y-2">{duplicatePairs.map((pair) => <div className="flex items-center justify-between gap-3 border border-line p-3" key={[pair.target.id,pair.source.id].sort().join("|")}><span className="text-sm">{pair.target.name} ↔ {pair.source.name}<span className="ml-2 text-xs text-muted">{pair.reason}</span></span><button className="text-xs text-action" onClick={() => handleMerge(pair.target,pair.source)} type="button">核实后合并</button></div>)}</div> : <p className="py-8 text-center text-sm text-muted">未发现明显重复项。</p>}</section></div>}
  </main>;
}
