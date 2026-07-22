"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Info, ListField, SectionActions, TextField } from "@/components/workbench/edit-fields";
import { deleteLocalItem, loadLocalWorkbenchData, updateLocalItem, type LocalSupplier } from "@/features/workbench/local-store";
import { labelSupplierType } from "@/features/workbench/display-labels";
import {
  AlertCircle,
  Building2,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  ListChecks,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Scale,
  Tag,
  TrendingUp,
  User,
  Zap
} from "lucide-react";

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = Array.isArray(params.supplierId) ? params.supplierId[0] : params.supplierId;
  const data = loadLocalWorkbenchData();
  const supplier = data.suppliers.find((item) => item.id === supplierId);
  const offers = data.offers.filter((offer) => offer.supplierId === supplierId || (!offer.supplierId && offer.supplierName === supplier?.name));
  const communications = data.communications.filter((item) => item.supplierId === supplierId || (!item.supplierId && item.supplierName === supplier?.name));
  const tasks = data.tasks.filter((item) => item.supplierId === supplierId || (!item.supplierId && item.supplierName === supplier?.name));
  const decisionCases = data.decisionCases.filter((item) => item.supplierIds.includes(supplierId || ""));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LocalSupplier | undefined>(supplier);

  if (!supplier || !draft) {
    return <div className="rounded-3xl border border-line bg-white p-4 text-sm text-slate-600">没有找到这个供应商。</div>;
  }

  function save() {
    if (!draft) return;
    updateLocalItem("suppliers", draft.id, draft);
    setEditing(false);
  }

  function remove() {
    if (!draft) return;
    if (!window.confirm("确认删除这个供应商吗？")) return;
    deleteLocalItem("suppliers", draft.id);
    router.push("/suppliers");
  }

  const typeLabel = labelSupplierType(supplier.supplierType);
  const typeColor = supplier.supplierType === "factory" ? "bg-success-soft text-success" : supplier.supplierType === "trader" ? "bg-warning-soft text-warning" : "bg-paper-warm text-muted";

  return (
    <div className="space-y-6">
      {/* 顶部导航 */}
      <Link className="inline-flex items-center gap-1 text-sm text-action" href="/suppliers">
        <ChevronRight className="h-4 w-4 rotate-180" />
        返回供应商库
      </Link>

      {/* 供应商名片 */}
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
        {editing ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-semibold">编辑供应商</h1>
              <SectionActions editing={editing} onCancel={() => { setDraft(supplier); setEditing(false); }} onDelete={remove} onEdit={() => setEditing(true)} onSave={save} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="供应商名称" onChange={(value) => setDraft({ ...draft, name: value })} value={draft.name} />
              <TextField label="地区" onChange={(value) => setDraft({ ...draft, location: value })} value={draft.location || ""} />
              <TextField label="店铺链接" onChange={(value) => setDraft({ ...draft, storeUrl: value })} value={draft.storeUrl || ""} />
              <TextField label="来源平台" onChange={(value) => setDraft({ ...draft, sourcePlatform: value })} value={draft.sourcePlatform || ""} />
              <TextField label="联系方式" onChange={(value) => setDraft({ ...draft, contactMethod: value })} value={draft.contactMethod || ""} />
              <label>
                <span className="text-xs text-slate-500">类型</span>
                <select className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm" onChange={(event) => setDraft({ ...draft, supplierType: event.target.value })} value={draft.supplierType || "unknown"}>
                  <option value="unknown">尚未判断</option>
                  <option value="factory">工厂</option>
                  <option value="trader">贸易商</option>
                </select>
              </label>
              <TextField label="联系人" onChange={(value) => setDraft({ ...draft, contactName: value })} value={draft.contactName || ""} />
              <TextField label="配合度" onChange={(value) => setDraft({ ...draft, cooperationLevel: value })} value={draft.cooperationLevel || ""} />
              <ListField label="主营产品，每行一个" onChange={(values) => setDraft({ ...draft, categories: values })} values={draft.categories} />
              <ListField label="风险标签，每行一个" onChange={(values) => setDraft({ ...draft, riskTags: values })} values={draft.riskTags} />
              <TextField label="备注" multiline onChange={(value) => setDraft({ ...draft, notes: value })} value={draft.notes || ""} />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                {/* 头像区 */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-action-soft border border-action/15">
                  <Building2 className="h-8 w-8 text-action" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold">{supplier.name}</h1>
                    <span className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${typeColor}`}>{typeLabel}</span>
                  </div>
                  {/* 标签行 */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {supplier.location ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-paper-warm px-2.5 py-1 text-xs text-muted border border-line">
                        <MapPin className="h-3 w-3" />
                        {supplier.location}
                      </span>
                    ) : null}
                    {supplier.sourcePlatform ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-paper-warm px-2.5 py-1 text-xs text-muted border border-line">
                        <ExternalLink className="h-3 w-3" />
                        {supplier.sourcePlatform}
                      </span>
                    ) : null}
                    {supplier.contactName ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-paper-warm px-2.5 py-1 text-xs text-muted border border-line">
                        <User className="h-3 w-3" />
                        {supplier.contactName}
                      </span>
                    ) : null}
                    {supplier.cooperationLevel ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-paper-warm px-2.5 py-1 text-xs text-muted border border-line">
                        <TrendingUp className="h-3 w-3" />
                        {supplier.cooperationLevel}
                      </span>
                    ) : null}
                  </div>
                  {/* 主营产品 */}
                  {supplier.categories.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {supplier.categories.map((cat, index) => (
                        <span className="rounded-md bg-action-soft px-2 py-0.5 text-xs text-action font-medium" key={index}>{cat}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <SectionActions editing={editing} onCancel={() => { setDraft(supplier); setEditing(false); }} onDelete={remove} onEdit={() => setEditing(true)} onSave={save} />
            </div>

            {/* 详细信息行 */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoCard icon={<Phone className="h-3.5 w-3.5" />} label="联系方式" value={supplier.contactMethod} />
              <InfoCard icon={<LinkIcon className="h-3.5 w-3.5" />} label="店铺链接" isLink value={supplier.storeUrl} />
              <InfoCard icon={<Tag className="h-3.5 w-3.5" />} label="风险标签" value={supplier.riskTags.join("、") || undefined} />
              <InfoCard icon={<FileText className="h-3.5 w-3.5" />} label="备注" value={supplier.notes} />
            </div>
          </>
        )}
      </section>

      {/* 快捷操作 */}
      <section className="grid gap-3 sm:grid-cols-3">
        <QuickActionCard
          href="/intake"
          icon={<MessageSquare className="h-5 w-5" />}
          label="添加沟通记录"
          description="录入与供应商的沟通"
        />
        <QuickActionCard
          href={`/offers?supplierId=${supplierId}`}
          icon={<Package className="h-5 w-5" />}
          label="添加货盘"
          description="录入该供应商的报价"
        />
        <QuickActionCard
          href={`/tasks?supplierId=${supplierId}`}
          icon={<ListChecks className="h-5 w-5" />}
          label="新建待办"
          description="跟进供应商相关事项"
        />
      </section>

      {/* 统计概览 */}
      <section className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={<MessageSquare className="h-4 w-4" />} label="沟通记录" value={communications.length} color="action" />
        <StatCard icon={<Package className="h-4 w-4" />} label="关联货盘" value={offers.length} color="warning" />
        <StatCard icon={<ListChecks className="h-4 w-4" />} label="关联待办" value={tasks.filter((t) => t.status === "open").length} suffix={`/ ${tasks.length}`} color="success" />
        <StatCard icon={<Scale className="h-4 w-4" />} label="关联决策" value={decisionCases.length} color="muted" />
      </section>

      {/* 沟通记录 */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-action" />
            <h2 className="font-semibold">沟通记录</h2>
          </div>
          <Link className="text-xs text-action hover:underline" href="/intake">+ 添加记录</Link>
        </div>
        {communications.length > 0 ? (
          <div className="space-y-3">
            {communications.map((item) => (
              <div className="rounded-xl border border-line bg-white p-4 transition-all hover:shadow-card" key={item.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-2 text-sm font-medium text-ink">{item.summary || "未填写沟通摘要"}</div>
                {item.promises.length > 0 ? (
                  <div className="mt-2 flex gap-2 text-sm">
                    <span className="shrink-0 rounded bg-success-soft px-1.5 py-0.5 text-[10px] text-success font-semibold">承诺</span>
                    <span className="text-slate-700">{item.promises.join("；")}</span>
                  </div>
                ) : null}
                {item.risks.length > 0 ? (
                  <div className="mt-1.5 flex gap-2 text-sm">
                    <span className="shrink-0 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] text-danger font-semibold">风险</span>
                    <span className="text-slate-700">{item.risks.join("；")}</span>
                  </div>
                ) : null}
                {item.nextActions.length > 0 ? (
                  <div className="mt-1.5 flex gap-2 text-sm">
                    <span className="shrink-0 rounded bg-action-soft px-1.5 py-0.5 text-[10px] text-action font-semibold">下一步</span>
                    <span className="text-slate-700">{item.nextActions.join("；")}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<MessageSquare className="h-8 w-8" />} label="暂无沟通记录" tip="去快速录入页面添加沟通记录" />
        )}
      </section>

      {/* 关联货盘 */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-warning" />
            <h2 className="font-semibold">关联货盘</h2>
          </div>
          <Link className="text-xs text-action hover:underline" href="/intake">+ 添加货盘</Link>
        </div>
        {offers.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {offers.map((offer) => (
              <Link className="group rounded-2xl border border-line bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:border-warning/30" href={`/offers/${offer.id}`} key={offer.id}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-action group-hover:underline line-clamp-1">{offer.name}</h3>
                  <span className="shrink-0 text-xs text-muted">{offer.category || "未分类"}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-paper-warm py-2">
                    <div className="text-xs text-muted">报价</div>
                    <div className="mt-0.5 text-sm font-semibold text-ink">{offer.quotedPrice || "—"}</div>
                  </div>
                  <div className="rounded-lg bg-paper-warm py-2">
                    <div className="text-xs text-muted">MOQ</div>
                    <div className="mt-0.5 text-sm font-semibold text-ink">{offer.moq || "—"}</div>
                  </div>
                  <div className="rounded-lg bg-paper-warm py-2">
                    <div className="text-xs text-muted">交期</div>
                    <div className="mt-0.5 text-sm font-semibold text-ink">{offer.leadTime || "—"}</div>
                  </div>
                </div>
                {offer.keySpecs ? (
                  <div className="mt-2 text-xs text-muted">{offer.keySpecs}</div>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Package className="h-8 w-8" />} label="暂无关联货盘" tip="去快速录入页面添加货盘" />
        )}
      </section>

      {/* 关联待办 */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-success" />
            <h2 className="font-semibold">关联待办</h2>
          </div>
          <Link className="text-xs text-action hover:underline" href="/tasks">+ 新建待办</Link>
        </div>
        {tasks.length > 0 ? (
          <div className="space-y-2">
            {tasks.map((task) => {
              const priorityColor = task.priority === "high" ? "bg-danger" : task.priority === "medium" ? "bg-warning" : "bg-success";
              return (
                <Link className={`group flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-all hover:border-success/30 hover:shadow-card ${task.status === "done" ? "opacity-50" : ""}`} href="/tasks" key={task.id}>
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${priorityColor}`} />
                  <span className={`flex-1 text-sm ${task.status === "done" ? "line-through text-muted" : "text-ink"}`}>{task.title}</span>
                  {task.dueText ? <span className="text-xs text-muted">{task.dueText}</span> : null}
                  {task.status === "done" ? <span className="rounded bg-success-soft px-1.5 py-0.5 text-[10px] text-success font-semibold">已完成</span> : null}
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<ListChecks className="h-8 w-8" />} label="暂无关联待办" tip="去待办页面新建事项" />
        )}
      </section>

      {/* 关联决策 */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Scale className="h-5 w-5 text-muted" />
          <h2 className="font-semibold">关联决策</h2>
        </div>
        {decisionCases.length > 0 ? (
          <div className="space-y-2">
            {decisionCases.map((item) => (
              <Link className="block rounded-xl border border-line bg-white p-4 transition-all hover:shadow-card hover:border-muted" href={`/knowledge/cases/${item.id}`} key={item.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">{item.title}</span>
                  <span className="shrink-0 text-xs text-muted">{item.cycles.length} 个决策轮次</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Scale className="h-8 w-8" />} label="暂无关联决策" tip="去商业知识页面创建问题档案" />
        )}
      </section>
    </div>
  );
}

/* ---------- 子组件 ---------- */

function InfoCard({ icon, label, value, isLink }: { icon: React.ReactNode; label: string; value?: string; isLink?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5">
      <span className="text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-muted">{label}</div>
        {isLink ? (
          <a className="block truncate text-xs text-action hover:underline" href={value} rel="noreferrer" target="_blank">{value}</a>
        ) : (
          <div className="truncate text-xs text-ink">{value}</div>
        )}
      </div>
    </div>
  );
}

function QuickActionCard({ href, icon, label, description }: { href: string; icon: React.ReactNode; label: string; description: string }) {
  return (
    <Link className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:border-action/30" href={href}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-action-soft text-action">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted">{description}</div>
      </div>
    </Link>
  );
}

function StatCard({ icon, label, value, suffix, color }: { icon: React.ReactNode; label: string; value: number; suffix?: string; color: "action" | "warning" | "success" | "muted" }) {
  const colorMap = {
    action: "text-action",
    warning: "text-warning",
    success: "text-success",
    muted: "text-muted"
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper-warm ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <div className="text-lg font-semibold text-ink">{value}{suffix || ""}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, label, tip }: { icon: React.ReactNode; label: string; tip: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-paper-warm border border-line-soft px-4 py-8 text-center">
      <div className="text-muted-light">{icon}</div>
      <p className="mt-2 text-sm text-muted">{label}</p>
      <p className="mt-1 text-xs text-muted-light">{tip}</p>
    </div>
  );
}
