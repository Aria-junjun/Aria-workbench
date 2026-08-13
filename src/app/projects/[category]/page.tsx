"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  ChevronRight,
  FolderKanban,
  Package,
  Plus,
  ScanSearch,
  Scale,
  Sparkles,
  X,
  Zap
} from "lucide-react";
import {
  type LocalWorkbenchData,
  saveLocalWorkbenchData,
  saveProductKnowledge,
  removeOfferFromProduct,
  removeSupplierFromProduct,
  addOfferToProduct,
  addSupplierToProduct
} from "@/features/workbench/local-store";
import { getWorkbenchSnapshot } from "@/features/workbench/workbench-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";
import {
  activateSignal,
  scanDormantSignals,
  type ActivationMatch
} from "@/features/workbench/product-knowledge";
import {
  labelLifecycleStage,
  labelSignalStatus,
  labelDormantReason
} from "@/features/workbench/display-labels";

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

  // 所有 hooks 必须在任何条件 return 之前声明（React hooks 规则）
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const data = useWorkbenchData();

  // 休眠智能唤醒扫描
  const [activationMatches, setActivationMatches] = useState<ActivationMatch[]>([]);
  const [scanning, setScanning] = useState(false);
  const [activatedCount, setActivatedCount] = useState(0);

  useEffect(() => {
    setDetail(buildCategoryDetail(data, category));
    setHydrated(true);
  }, [data, category]);

  const productCards = detail ? detail.products.filter((p) => p.researchDepth !== "category") : [];

  // 产品阶段分组（按漏斗顺序）
  const groupedProductCards = useMemo(() => {
    const groups: Record<string, ProductKnowledgeV2[]> = {
      signal_active: [],    // 活跃信号
      signal_dormant: [],   // 休眠信号
      in_progress: [],      // 执行中（验证→评估）
      archived: [],         // 成功闭环·归档
      discontinued: [],     // 淘汰
      unset: []             // 未分阶段
    };
    for (const p of productCards) {
      const stage = p.lifecycleStage;
      if (!stage) {
        groups.unset.push(p);
        continue;
      }
      if (stage === "signal") {
        if (p.signalStatus === "dormant") groups.signal_dormant.push(p);
        else groups.signal_active.push(p);
        continue;
      }
      if (["validated", "defined", "supply_locked", "listing", "evaluating"].includes(stage)) {
        groups.in_progress.push(p);
        continue;
      }
      if (stage === "archived") { groups.archived.push(p); continue; }
      if (stage === "discontinued") { groups.discontinued.push(p); continue; }
      groups.unset.push(p);
    }
    return groups;
  }, [productCards]);

  function runScan() {
    if (!detail) return;
    setScanning(true);
    try {
      const matches = scanDormantSignals(detail.products, {
        suppliers: detail.suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          categories: s.categories,
          cooperationLevel: undefined // 当前类型未直接暴露，保持 undefined 不触发等级判定
        }))
      });
      setActivationMatches(matches);
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    if (detail) runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  function handleActivate(match: ActivationMatch) {
    if (!detail) return;
    const product = detail.products.find((p) => p.id === match.productId);
    if (!product) return;
    saveProductKnowledge(activateSignal(product));
    setActivatedCount((x) => x + 1);
  }

  // 添加/删除关联
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [searchSupplier, setSearchSupplier] = useState("");
  const [searchOffer, setSearchOffer] = useState("");

  function handleRemoveSupplier(supplierId: string) {
    if (!detail) return;
    const snapshot = getWorkbenchSnapshot();
    for (const product of detail.products) {
      if ((product.relatedSupplierIds ?? []).includes(supplierId)) {
        const updated = removeSupplierFromProduct(snapshot, product.id, supplierId);
        saveLocalWorkbenchData(updated);
        break;
      }
    }
  }

  function handleRemoveOffer(offerId: string) {
    if (!detail) return;
    const snapshot = getWorkbenchSnapshot();
    for (const product of detail.products) {
      if ((product.relatedOfferIds ?? []).includes(offerId)) {
        const updated = removeOfferFromProduct(snapshot, product.id, offerId);
        saveLocalWorkbenchData(updated);
        break;
      }
    }
  }

  function handleAddSupplier(supplierId: string) {
    if (!detail || detail.products.length === 0) return;
    const snapshot = getWorkbenchSnapshot();
    const productId = detail.products[0].id;
    const updated = addSupplierToProduct(snapshot, productId, supplierId);
    saveLocalWorkbenchData(updated);
    setShowAddSupplier(false);
    setSearchSupplier("");
  }

  function handleAddOffer(offerId: string) {
    if (!detail || detail.products.length === 0) return;
    const snapshot = getWorkbenchSnapshot();
    const productId = detail.products[0].id;
    const updated = addOfferToProduct(snapshot, productId, offerId);
    saveLocalWorkbenchData(updated);
    setShowAddOffer(false);
    setSearchOffer("");
  }

  const availableSuppliers = data.suppliers.filter(
    (s) => !detail?.suppliers.some((ds) => ds.id === s.id) &&
    (searchSupplier ? s.name.toLowerCase().includes(searchSupplier.toLowerCase()) : true)
  );
  const availableOffers = data.offers.filter(
    (o) => !detail?.offers.some((do_) => do_.id === o.id) &&
    (searchOffer ? o.name.toLowerCase().includes(searchOffer.toLowerCase()) : true)
  );

  // ===== 以下才允许提前 return =====

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

  const researchReports = detail.products.filter((p) => p.researchDepth === "category");

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
              {detail.offers.length} 个货盘 · {detail.decisionCases.length} 个决策案例
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<BookOpen className="h-4 w-4" />} label="调研/产品" value={detail.products.length} color="action" />
          <StatCard icon={<Building2 className="h-4 w-4" />} label="供应商" value={detail.suppliers.length} color="action" />
          <StatCard icon={<Package className="h-4 w-4" />} label="货盘" value={detail.offers.length} color="warning" />
          <StatCard icon={<Scale className="h-4 w-4" />} label="决策案例" value={detail.decisionCases.length} color="muted" />
        </div>
      </section>

      {/* 智能唤醒：匹配当前供应商的休眠机会 */}
      <section className="rounded-3xl border border-action/15 bg-gradient-to-br from-action-soft/40 via-white to-white p-5 shadow-card ring-1 ring-inset ring-action/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-inset ring-action/15">
              <Sparkles className="h-5 w-5 text-action" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">机会唤醒扫描</h2>
              <p className="mt-1 text-sm text-slate-600">
                根据当前供应商积累、硬成本和季节，系统可自动识别休眠中"可以开始做了"的机会。
              </p>
              {activatedCount > 0 && (
                <p className="mt-1 text-xs text-action">
                  ✓ 本次会话已激活 {activatedCount} 条机会
                </p>
              )}
            </div>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-action/90 disabled:opacity-60"
            disabled={scanning}
            onClick={runScan}
            type="button"
          >
            <ScanSearch className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "扫描中…" : "重新检查可开启机会"}
          </button>
        </div>
        {activationMatches.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-line bg-white/70 px-4 py-8 text-center text-sm text-slate-500">
            暂无匹配到的可唤醒机会。等你供应商/成本条件更成熟时，再点上方"重新检查"即可。
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {activationMatches.slice(0, 6).map((match) => (
              <div
                key={match.productId}
                className="rounded-2xl border border-line bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{match.productName}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset ${
                        match.confidence === "strong"
                          ? "bg-action-soft text-action ring-action/20"
                          : "bg-slate-100 text-slate-700 ring-slate-200"
                      }`}>
                        {match.confidence === "strong" ? (
                          <><Zap className="mr-1 h-3 w-3" />强匹配·建议直接开启</>
                        ) : (
                          <>弱匹配·可再观察</>
                        )}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {match.matchedRules.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-action/70" />
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    className="shrink-0 rounded-lg border border-action/30 bg-action-soft px-3 py-1.5 text-sm font-medium text-action hover:bg-action-soft/80"
                    onClick={() => handleActivate(match)}
                    type="button"
                  >
                    一键激活·开始评估
                  </button>
                </div>
              </div>
            ))}
            {activationMatches.length > 6 && (
              <div className="text-center text-xs text-muted">
                还有 {activationMatches.length - 6} 条弱匹配，建议先处理以上高优先的。
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 1: 调研报告与产品知识（漏斗分组） */}
      <DetailSection icon={<BookOpen className="h-5 w-5 text-action" />} title="调研报告与产品知识">
        {detail.products.length === 0 ? (
          <SectionEmpty label="暂无" />
        ) : (
          <div className="space-y-4">
            {researchReports.length > 0 && (
              <div className="space-y-2">
                <GroupLabel text={`调研报告（${researchReports.length}）`} />
                {researchReports.map((product) => (
                  <ProductRow key={product.id} product={product} kind="research" />
                ))}
              </div>
            )}

            {/* 活跃信号：新机会 · 待评估 GO */}
            {groupedProductCards.signal_active.length > 0 && (
              <div className="space-y-2">
                <GroupLabel text={`活跃信号池·待评估（${groupedProductCards.signal_active.length}）`} />
                {groupedProductCards.signal_active.map((product) => (
                  <ProductRow key={product.id} product={product} kind="product" />
                ))}
              </div>
            )}

            {/* 休眠池：暂不做的机会 */}
            {groupedProductCards.signal_dormant.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-3">
                <GroupLabel text={`💤 休眠池·暂时不做（${groupedProductCards.signal_dormant.length}）`} />
                {groupedProductCards.signal_dormant.map((product) => (
                  <ProductRow key={product.id} product={product} kind="product" dormantTip />
                ))}
              </div>
            )}

            {/* 执行中：已通过验证 → 评估决策 */}
            {groupedProductCards.in_progress.length > 0 && (
              <div className="space-y-2">
                <GroupLabel text={`🛠️ 执行中（${groupedProductCards.in_progress.length}）·产品定义→供应锁定→上架→评估`} />
                {groupedProductCards.in_progress.map((product) => (
                  <ProductRow key={product.id} product={product} kind="product" />
                ))}
              </div>
            )}

            {/* 闭环·归档 */}
            {groupedProductCards.archived.length > 0 && (
              <div className="space-y-2">
                <GroupLabel text={`✅ 成功闭环（${groupedProductCards.archived.length}）`} />
                {groupedProductCards.archived.map((product) => (
                  <ProductRow key={product.id} product={product} kind="product" muted />
                ))}
              </div>
            )}

            {/* 淘汰 */}
            {groupedProductCards.discontinued.length > 0 && (
              <div className="space-y-2">
                <GroupLabel text={`⛔ 已淘汰（${groupedProductCards.discontinued.length}）`} />
                {groupedProductCards.discontinued.map((product) => (
                  <ProductRow key={product.id} product={product} kind="product" muted />
                ))}
              </div>
            )}

            {/* 未分阶段（历史数据） */}
            {groupedProductCards.unset.length > 0 && (
              <div className="space-y-2">
                <GroupLabel text={`未分阶段（${groupedProductCards.unset.length}）`} />
                {groupedProductCards.unset.map((product) => (
                  <ProductRow key={product.id} product={product} kind="product" />
                ))}
              </div>
            )}
          </div>
        )}
      </DetailSection>

      {/* Section 2: 供应商 */}
      <DetailSection icon={<Building2 className="h-5 w-5 text-action" />} title="供应商" action={
        <button onClick={() => setShowAddSupplier(!showAddSupplier)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-muted hover:border-action hover:text-action transition-colors">
          <Plus className="h-3 w-3" /> 添加
        </button>
      }>
        {showAddSupplier && (
          <div className="mb-3 rounded-xl border border-line bg-white p-3">
            <input
              autoFocus
              type="text"
              placeholder="搜索供应商名称..."
              value={searchSupplier}
              onChange={(e) => setSearchSupplier(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action/30 mb-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableSuppliers.length === 0 ? (
                <p className="text-xs text-muted text-center py-2">没有可添加的供应商</p>
              ) : (
                availableSuppliers.slice(0, 20).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleAddSupplier(s.id)}
                    className="flex w-full items-center justify-between rounded-md border border-line px-3 py-2 text-sm hover:border-action hover:bg-action-soft/30 transition-colors"
                  >
                    <span className="text-ink">{s.name}</span>
                    <span className="text-xs text-muted">{s.categories.join(" / ") || "未分类"}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {detail.suppliers.length === 0 ? (
          <SectionEmpty label="暂无" />
        ) : (
          <div className="space-y-2">
            {detail.suppliers.map((supplier) => (
              <div key={supplier.id} className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-all hover:border-action/30 hover:shadow-card">
                <Link href={`/suppliers/${supplier.id}`} className="min-w-0 flex-1">
                  <div className="font-medium text-ink group-hover:text-action">{supplier.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {supplier.categories.join(" / ") || "未分类"}
                    {supplier.location ? ` · ${supplier.location}` : ""}
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-muted-light" />
                  <button
                    onClick={() => handleRemoveSupplier(supplier.id)}
                    className="rounded-md p-1 text-muted-light opacity-0 transition-all hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                    title="解除关联"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      {/* Section 3: 货盘 */}
      <DetailSection icon={<Package className="h-5 w-5 text-warning" />} title="货盘" action={
        <button onClick={() => setShowAddOffer(!showAddOffer)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-muted hover:border-action hover:text-action transition-colors">
          <Plus className="h-3 w-3" /> 添加
        </button>
      }>
        {showAddOffer && (
          <div className="mb-3 rounded-xl border border-line bg-white p-3">
            <input
              autoFocus
              type="text"
              placeholder="搜索货盘名称..."
              value={searchOffer}
              onChange={(e) => setSearchOffer(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-action/30 mb-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableOffers.length === 0 ? (
                <p className="text-xs text-muted text-center py-2">没有可添加的货盘</p>
              ) : (
                availableOffers.slice(0, 20).map((o) => (
                  <button
                    key={o.id}
                    onClick={() => handleAddOffer(o.id)}
                    className="flex w-full items-center justify-between rounded-md border border-line px-3 py-2 text-sm hover:border-action hover:bg-action-soft/30 transition-colors"
                  >
                    <span className="text-ink">{o.name}</span>
                    <span className="text-xs text-muted">{o.supplierName || "未关联供应商"}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {detail.offers.length === 0 ? (
          <SectionEmpty label="暂无" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {detail.offers.map((offer) => (
              <div key={offer.id} className="group relative rounded-2xl border border-line bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:border-warning/30">
                <button
                  onClick={() => handleRemoveOffer(offer.id)}
                  className="absolute right-2 top-2 z-10 rounded-md p-1 text-muted-light opacity-0 transition-all hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                  title="解除关联"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <Link href={`/offers/${offer.id}`} className="block">
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <h3 className="font-medium text-ink group-hover:text-action line-clamp-1">{offer.name}</h3>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{offer.supplierName || "未关联供应商"}</div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <MiniStat label="报价" value={offer.quotedPrice} />
                    <MiniStat label="MOQ" value={offer.moq} />
                    <MiniStat label="交期" value={offer.leadTime} />
                  </div>
                </Link>
              </div>
            ))}
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

function DetailSection({ icon, title, action, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-ink">{title}</h2>
        {action ? <div className="ml-auto">{action}</div> : null}
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

function ProductRow({
  product,
  kind,
  dormantTip,
  muted
}: {
  product: ProductKnowledgeV2;
  kind: "research" | "product";
  dormantTip?: boolean;
  muted?: boolean;
}) {
  const isResearch = kind === "research";
  const badgeClass = isResearch
    ? "bg-action-soft text-action border-action/15"
    : "bg-success-soft text-success border-success/15";
  const badgeText = isResearch ? "调研报告" : "产品卡";
  const stage = labelLifecycleStage(product.lifecycleStage);
  const signal = labelSignalStatus(product.signalStatus);
  const dormantReason = labelDormantReason(product.dormantReason);
  return (
    <Link
      href={`/products/${product.id}`}
      className={`group flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-all hover:border-action/30 hover:shadow-card ${muted ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink group-hover:text-action truncate">{product.name}</span>
          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
            {badgeText}
          </span>
          {!isResearch && (
            <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ring-inset ${stage.tone}`}>
              {stage.label}
            </span>
          )}
          {(!product.lifecycleStage || product.lifecycleStage === "signal") && product.signalStatus && !isResearch && (
            <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ring-inset ${signal.tone}`}>
              {signal.label}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {product.decision.summary || product.coreUse || product.targetUsers || "未记录摘要"}
        </div>
        {dormantTip && product.dormantReason && (
          <div className="mt-1 text-[11px] text-slate-500">
            💤 休眠原因：{dormantReason}
            {product.activationTrigger?.requiredSupplierCategories?.length ? (
              <span className="ml-2">· 等待激活：供应商成熟</span>
            ) : null}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-light shrink-0 transition-transform group-hover:translate-x-0.5" />
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
