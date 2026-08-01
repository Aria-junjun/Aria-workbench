"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  ChevronRight,
  FolderKanban,
  ListChecks,
  Package,
  Scale
} from "lucide-react";
import {
  loadLocalWorkbenchData,
  type LocalWorkbenchData
} from "@/features/workbench/local-store";
import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

type CategoryDetail = {
  category: string;
  products: ProductKnowledgeV2[];
  suppliers: LocalWorkbenchData["suppliers"];
  offers: LocalWorkbenchData["offers"];
  tasks: LocalWorkbenchData["tasks"];
  decisionCases: LocalWorkbenchData["decisionCases"];
};

function resolveCategory(product: { category?: string }): string {
  return product.category?.trim() || "未分类";
}

function buildCategoryDetail(data: LocalWorkbenchData, category: string): CategoryDetail {
  const products = data.products.filter((p) => resolveCategory(p) === category);
  const productIds = new Set(products.map((p) => p.id));

  // 关联供应商：产品的 relatedSupplierIds + 供应商自身 categories 命中
  const supplierIds = new Set<string>();
  for (const product of products) {
    for (const id of product.relatedSupplierIds ?? []) supplierIds.add(id);
  }
  for (const supplier of data.suppliers) {
    if (supplier.categories.includes(category)) supplierIds.add(supplier.id);
  }

  // 关联货盘：产品的 relatedOfferIds + 货盘 productId 命中 + 货盘 category 命中
  const offerIds = new Set<string>();
  for (const product of products) {
    for (const id of product.relatedOfferIds ?? []) offerIds.add(id);
  }
  for (const offer of data.offers) {
    if (offer.productId && productIds.has(offer.productId)) offerIds.add(offer.id);
    else if (offer.category && offer.category === category) offerIds.add(offer.id);
  }

  // 关联待办：通过 supplierId 或 offerId 串联
  const tasks = data.tasks.filter(
    (t) =>
      (Boolean(t.supplierId) && supplierIds.has(t.supplierId!)) ||
      (Boolean(t.offerId) && offerIds.has(t.offerId!))
  );

  // 关联决策案例：productIds / supplierIds / offerIds 任一交集
  const decisionCases = data.decisionCases.filter(
    (c) =>
      c.productIds.some((id) => productIds.has(id)) ||
      c.supplierIds.some((id) => supplierIds.has(id)) ||
      c.offerIds.some((id) => offerIds.has(id))
  );

  return {
    category,
    products,
    suppliers: data.suppliers.filter((s) => supplierIds.has(s.id)),
    offers: data.offers.filter((o) => offerIds.has(o.id)),
    tasks,
    decisionCases
  };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const rawCategory = Array.isArray(params.category) ? params.category[0] : params.category;
  const category = decodeURIComponent(rawCategory ?? "");

  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDetail(buildCategoryDetail(loadLocalWorkbenchData(), category));
    setHydrated(true);
  }, [category]);

  if (!hydrated || !detail) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-sm text-slate-600">
        正在加载品类项目...
      </div>
    );
  }

  if (detail.products.length === 0 && detail.suppliers.length === 0 && detail.offers.length === 0) {
    return (
      <div className="space-y-5">
        <BackLink />
        <div className="rounded-lg border border-dashed border-line bg-white p-6">
          <h2 className="text-base font-semibold">没有找到这个品类项目</h2>
          <p className="mt-2 text-sm text-slate-600">
            「{detail.category}」下还没有产品知识、供应商或货盘。
          </p>
          <Link className="mt-4 inline-flex rounded-md bg-action px-3 py-2 text-sm text-white" href="/projects">
            返回品类项目
          </Link>
        </div>
      </div>
    );
  }

  const openTasks = detail.tasks.filter((t) => t.status !== "done");
  const doneTasks = detail.tasks.filter((t) => t.status === "done");
  const researchReports = detail.products.filter((p) => p.researchDepth === "category");
  const productCards = detail.products.filter((p) => p.researchDepth !== "category");

  return (
    <div className="space-y-6">
      <BackLink />

      {/* 顶部：品类名称 + 统计摘要 */}
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-action-soft border border-action/15">
            <FolderKanban className="h-7 w-7 text-action" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-ink">{detail.category}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {detail.products.length} 份调研/产品 · {detail.suppliers.length} 家供应商 ·{" "}
              {detail.offers.length} 个货盘 · {detail.tasks.length} 个待办 ·{" "}
              {detail.decisionCases.length} 个决策案例
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={<BookOpen className="h-4 w-4" />} label="调研/产品" value={detail.products.length} color="action" />
          <StatCard icon={<Building2 className="h-4 w-4" />} label="供应商" value={detail.suppliers.length} color="action" />
          <StatCard icon={<Package className="h-4 w-4" />} label="货盘" value={detail.offers.length} color="warning" />
          <StatCard icon={<ListChecks className="h-4 w-4" />} label="待办" value={detail.tasks.length} color="success" />
          <StatCard icon={<Scale className="h-4 w-4" />} label="决策案例" value={detail.decisionCases.length} color="muted" />
        </div>
      </section>

      {/* Section 1: 调研报告与产品知识 */}
      <DetailSection icon={<BookOpen className="h-5 w-5 text-action" />} title="调研报告与产品知识">
        {detail.products.length === 0 ? (
          <SectionEmpty label="暂无" />
        ) : (
          <div className="space-y-2">
            {researchReports.length > 0 && (
              <GroupLabel text={`调研报告（${researchReports.length}）`} />
            )}
            {researchReports.map((product) => (
              <ProductRow key={product.id} product={product} kind="research" />
            ))}
            {productCards.length > 0 && (
              <GroupLabel text={`产品卡（${productCards.length}）`} />
            )}
            {productCards.map((product) => (
              <ProductRow key={product.id} product={product} kind="product" />
            ))}
          </div>
        )}
      </DetailSection>

      {/* Section 2: 供应商 */}
      <DetailSection icon={<Building2 className="h-5 w-5 text-action" />} title="供应商">
        {detail.suppliers.length === 0 ? (
          <SectionEmpty label="暂无" />
        ) : (
          <div className="space-y-2">
            {detail.suppliers.map((supplier) => (
              <Link
                key={supplier.id}
                href={`/suppliers/${supplier.id}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-all hover:border-action/30 hover:shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink group-hover:text-action">{supplier.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {supplier.categories.join(" / ") || "未分类"}
                    {supplier.location ? ` · ${supplier.location}` : ""}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-light transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </DetailSection>

      {/* Section 3: 货盘 */}
      <DetailSection icon={<Package className="h-5 w-5 text-warning" />} title="货盘">
        {detail.offers.length === 0 ? (
          <SectionEmpty label="暂无" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {detail.offers.map((offer) => (
              <Link
                key={offer.id}
                href={`/offers/${offer.id}`}
                className="group rounded-2xl border border-line bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:border-warning/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-ink group-hover:text-action line-clamp-1">{offer.name}</h3>
                  <span className="shrink-0 text-xs text-muted">{offer.supplierName || "未关联供应商"}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="报价" value={offer.quotedPrice} />
                  <MiniStat label="MOQ" value={offer.moq} />
                  <MiniStat label="交期" value={offer.leadTime} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </DetailSection>

      {/* Section 4: 待办（按状态分组） */}
      <DetailSection icon={<ListChecks className="h-5 w-5 text-success" />} title="待办">
        {detail.tasks.length === 0 ? (
          <SectionEmpty label="暂无" />
        ) : (
          <div className="space-y-4">
            <div>
              <GroupLabel text={`进行中（${openTasks.length}）`} />
              {openTasks.length === 0 ? (
                <SectionEmpty label="暂无" />
              ) : (
                <div className="space-y-2">
                  {openTasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <GroupLabel text={`已完成（${doneTasks.length}）`} />
              {doneTasks.length === 0 ? (
                <SectionEmpty label="暂无" />
              ) : (
                <div className="space-y-2">
                  {doneTasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DetailSection>

      {/* Section 5: 决策案例 */}
      <DetailSection icon={<Scale className="h-5 w-5 text-muted" />} title="决策案例">
        {detail.decisionCases.length === 0 ? (
          <SectionEmpty label="暂无" />
        ) : (
          <div className="space-y-2">
            {detail.decisionCases.map((item) => (
              <Link
                key={item.id}
                href={`/knowledge/cases/${item.id}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-all hover:border-muted hover:shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink group-hover:text-action line-clamp-1">{item.title}</div>
                  <div className="mt-0.5 text-xs text-muted">{item.cycles.length} 个决策轮次</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-light transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  );
}

/* ---------- 子组件 ---------- */

function BackLink() {
  return (
    <Link className="inline-flex items-center gap-1 text-sm text-action" href="/projects">
      <ChevronRight className="h-4 w-4 rotate-180" />
      返回品类项目
    </Link>
  );
}

function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function GroupLabel({ text }: { text: string }) {
  return <div className="text-xs font-semibold text-muted">{text}</div>;
}

function SectionEmpty({ label }: { label: string }) {
  return <div className="rounded-xl bg-paper-warm border border-line-soft px-4 py-6 text-center text-sm text-muted">{label}</div>;
}

function ProductRow({ product, kind }: { product: ProductKnowledgeV2; kind: "research" | "product" }) {
  const isResearch = kind === "research";
  const badgeClass = isResearch
    ? "bg-action-soft text-action border-action/15"
    : "bg-success-soft text-success border-success/15";
  const badgeText = isResearch ? "调研报告" : "产品卡";
  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-all hover:border-action/30 hover:shadow-card"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink group-hover:text-action truncate">{product.name}</span>
          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
            {badgeText}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {product.decision.summary || product.coreUse || product.targetUsers || "未记录摘要"}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-light shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function TaskRow({ task }: { task: LocalWorkbenchData["tasks"][number] }) {
  const priorityColor = task.priority === "high" ? "bg-danger" : task.priority === "medium" ? "bg-warning" : "bg-success";
  const isDone = task.status === "done";
  return (
    <Link
      href="/tasks"
      className={`group flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-all hover:border-success/30 hover:shadow-card ${isDone ? "opacity-50" : ""}`}
    >
      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${priorityColor}`} />
      <span className={`flex-1 text-sm ${isDone ? "line-through text-muted" : "text-ink"}`}>{task.title}</span>
      {task.supplierName ? (
        <span className="hidden sm:inline shrink-0 rounded-md bg-paper-warm px-2 py-0.5 text-[11px] text-muted border border-line-soft">
          {task.supplierName}
        </span>
      ) : null}
      {task.dueText ? <span className="shrink-0 text-xs text-muted">{task.dueText}</span> : null}
      {isDone ? <span className="shrink-0 rounded bg-success-soft px-1.5 py-0.5 text-[10px] text-success font-semibold">已完成</span> : null}
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg bg-paper-warm py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{value || "—"}</div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: "action" | "warning" | "success" | "muted" }) {
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
        <div className="text-lg font-semibold text-ink">{value}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}
