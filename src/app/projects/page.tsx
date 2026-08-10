"use client";

import Link from "next/link";
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
  type LocalWorkbenchData
} from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";

type CategorySummary = {
  category: string;
  productCount: number;
  supplierCount: number;
  offerCount: number;
  taskCount: number;
  caseCount: number;
};

function resolveCategory(product: { category?: string }): string {
  return product.category?.trim() || "未分类";
}

function buildCategorySummaries(data: LocalWorkbenchData): CategorySummary[] {
  const categoryProductIds = new Map<string, Set<string>>();

  for (const product of data.products) {
    const category = resolveCategory(product);
    if (!categoryProductIds.has(category)) categoryProductIds.set(category, new Set());
    categoryProductIds.get(category)!.add(product.id);
  }

  return [...categoryProductIds.entries()]
    .map(([category, productIds]): CategorySummary => {
      const categoryProducts = data.products.filter((p) => productIds.has(p.id));

      // 关联供应商：产品的 relatedSupplierIds + 供应商自身 categories 命中
      const supplierIds = new Set<string>();
      for (const product of categoryProducts) {
        for (const id of product.relatedSupplierIds ?? []) supplierIds.add(id);
      }
      for (const supplier of data.suppliers) {
        if (supplier.categories.includes(category)) supplierIds.add(supplier.id);
      }

      // 关联货盘：产品的 relatedOfferIds + 货盘 productId 命中 + 货盘 category 命中
      const offerIds = new Set<string>();
      for (const product of categoryProducts) {
        for (const id of product.relatedOfferIds ?? []) offerIds.add(id);
      }
      for (const offer of data.offers) {
        if (offer.productId && productIds.has(offer.productId)) offerIds.add(offer.id);
        else if (offer.category && offer.category === category) offerIds.add(offer.id);
      }

      // 关联待办：通过 supplierId 或 offerId 串联
      const taskCount = data.tasks.filter(
        (t) =>
          (Boolean(t.supplierId) && supplierIds.has(t.supplierId!)) ||
          (Boolean(t.offerId) && offerIds.has(t.offerId!))
      ).length;

      // 关联决策案例：productIds / supplierIds / offerIds 任一交集
      const caseCount = data.decisionCases.filter(
        (c) =>
          c.productIds.some((id) => productIds.has(id)) ||
          c.supplierIds.some((id) => supplierIds.has(id)) ||
          c.offerIds.some((id) => offerIds.has(id))
      ).length;

      return {
        category,
        productCount: categoryProducts.length,
        supplierCount: supplierIds.size,
        offerCount: offerIds.size,
        taskCount,
        caseCount
      };
    })
    .sort((a, b) => b.productCount - a.productCount || b.supplierCount - a.supplierCount);
}

export default function ProjectsPage() {
  const [summaries, setSummaries] = useState<CategorySummary[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const data = useWorkbenchData();

  useEffect(() => {
    setSummaries(buildCategorySummaries(data));
    setHydrated(true);
  }, [data]);

  return (
    <div className="space-y-5">
      <header className="border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-action" />
          <h1 className="text-xl font-semibold text-ink">品类项目</h1>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          按品类聚合调研报告、产品知识、供应商、货盘、待办与决策案例，一站查看每个品类的全貌。
        </p>
      </header>

      {!hydrated ? (
        <div className="rounded-lg border border-line bg-white p-6 text-sm text-slate-600">
          正在加载品类项目...
        </div>
      ) : summaries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-white p-6">
          <h2 className="text-base font-semibold">还没有品类项目</h2>
          <p className="mt-2 text-sm text-slate-600">
            先导入产品调研或录入供应商、货盘，系统会按品类自动归集。
          </p>
          <Link
            className="mt-4 inline-flex rounded-md bg-action px-3 py-2 text-sm text-white"
            href="/products/import"
          >
            导入产品调研
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summaries.map((item) => (
            <Link
              key={item.category}
              href={`/projects/${encodeURIComponent(item.category)}`}
              className="group rounded-lg border border-line bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:border-action/30"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium text-ink group-hover:text-action">{item.category}</h2>
                <ChevronRight className="h-4 w-4 text-muted-light transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                <Stat icon={<BookOpen className="mx-auto h-3.5 w-3.5" />} label="产品" value={item.productCount} />
                <Stat icon={<Building2 className="mx-auto h-3.5 w-3.5" />} label="供应商" value={item.supplierCount} />
                <Stat icon={<Package className="mx-auto h-3.5 w-3.5" />} label="货盘" value={item.offerCount} />
                <Stat icon={<ListChecks className="mx-auto h-3.5 w-3.5" />} label="待办" value={item.taskCount} />
                <Stat icon={<Scale className="mx-auto h-3.5 w-3.5" />} label="决策" value={item.caseCount} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md bg-paper-warm py-2">
      <div className="text-muted">{icon}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}
