"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ProductKnowledgeEditor } from "@/components/workbench/product-knowledge-editor";
import { SectionActions } from "@/components/workbench/edit-fields";
import { deleteLocalItem, saveLocalWorkbenchData, saveProductKnowledge, saveSupplierOfferDecision, type LocalOffer, type LocalSupplier, type SupplierOfferDecisionStatus } from "@/features/workbench/local-store";
import { useWorkbenchData, getWorkbenchSnapshot } from "@/features/workbench/workbench-store";
import type { CompetitiveLandscape, MarketOverview, ProductKnowledgeV2, ResearchTable, ProductLifecycleStage, ProductSignalStatus, ProductDormantReason } from "@/features/workbench/product-knowledge";
import { StageProcessCard } from "@/components/workbench/stage-process-card";
import { DecisionTimeline } from "@/components/workbench/decision-timeline";
import { buildProductTechnologyPrompt } from "@/features/workbench/product-technology-prompt";
import { labelLifecycleStage, labelSignalStatus, labelProductRecordKind, LIFECYCLE_STAGE_OPTIONS, SIGNAL_STATUS_OPTIONS, labelDormantReason, PRODUCT_RECORD_KIND_OPTIONS } from "@/features/workbench/display-labels";
import { randomId } from "@/lib/random-id";
import { buildSupplyDecisionTasks, buildSupplyPlan } from "@/features/workbench/supply-decision";

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId;
  const data = useWorkbenchData();
  const storedProduct = data.products.find((item) => item.id === productId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProductKnowledgeV2 | undefined>(storedProduct);
  const [version, setVersion] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");

  if (!storedProduct || !draft) {
    return <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">没有找到这个产品知识。</div>;
  }
  const product = data.products.find((item) => item.id === productId) || storedProduct;

  function save() {
    if (!draft) return;
    const saved = saveProductKnowledge(draft);
    setDraft(saved);
    setEditing(false);
    setVersion((current) => current + 1);
  }

  function remove() {
    if (!draft) return;
    if (!window.confirm("确认删除这个产品知识吗？")) return;
    deleteLocalItem("products", draft.id);
    router.push("/products");
  }

  async function copyTechnologyPrompt() {
    await navigator.clipboard.writeText(buildProductTechnologyPrompt(product));
    setCopyMessage("趋势分析提示词已复制，当前不会自动调用付费 AI。");
  }

  return (
    <div className="space-y-5" data-version={version}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-action" href="/products">返回产品知识库</Link>
        <div className="flex flex-wrap items-center gap-2">
          <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" onClick={copyTechnologyPrompt} type="button">复制技术趋势分析提示词</button>
          <Link className="rounded-md border border-line bg-white px-3 py-2 text-sm" href={`/products/${product.id}/brief`}>产品知识简报</Link>
        </div>
      </div>
      {copyMessage ? <p className="text-right text-xs text-slate-500">{copyMessage}</p> : null}
      <section className="border-b border-line pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <p className="mt-1 text-sm text-slate-600">{product.category || "未记录品类"}{product.coreUse ? ` · ${product.coreUse}` : ""}</p>
          </div>
          <SectionActions editing={editing} onCancel={() => { setDraft(product); setEditing(false); }} onDelete={remove} onEdit={() => setEditing(true)} onSave={save} />
        </div>
        <StageProcessCard
          product={product}
          onUpdate={(updater) => {
            const next = updater(product);
            setDraft(next);
            saveProductKnowledge(next);
            setVersion((v) => v + 1);
          }}
          onAddTask={(title, priority, productId, productName, stage) => {
            const currentData = getWorkbenchSnapshot();
            const newTask = {
              id: randomId(),
              title,
              priority,
              status: "open" as const,
              type: "product_stage",
              productId,
              productName,
              productStage: stage,
              createdAt: new Date().toISOString(),
              dueText: "",
              pinned: false
            };
            saveLocalWorkbenchData({
              ...currentData,
              tasks: [newTask, ...currentData.tasks]
            });
          }}
        />
        <ProductPortfolioPanel
          product={product}
          onUpdate={(next) => {
            setDraft(next);
            saveProductKnowledge(next);
            setVersion((v) => v + 1);
          }}
        />
        <ProductSupplyPlanPanel productId={product.id} />
      </section>

      {/* Decision Timeline */}
      <DecisionTimeline
        stageProgresses={product.stageProgress ?? []}
        currentStage={product.lifecycleStage ?? "signal"}
      />

      {editing ? (
        <div className="rounded-md border border-line bg-white p-4">
          <ProductKnowledgeEditor issues={draft.importIssues} onChange={setDraft} value={draft} />
        </div>
      ) : (
        <ProductKnowledgeView product={product} />
      )}
    </div>
  );
}

function ProductPortfolioPanel({
  product,
  onUpdate
}: {
  product: ProductKnowledgeV2;
  onUpdate: (product: ProductKnowledgeV2) => void;
}) {
  const kindMeta = labelProductRecordKind(product.recordKind);

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">产品归类与经营状态</h2>
          <p className="mt-1 text-xs text-slate-500">待分类记录不会参与机会判断或产品汰换评分。</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${kindMeta.tone}`}>{kindMeta.label}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-xs text-slate-500">
          产品类型
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-800"
            value={product.recordKind ?? "unclassified"}
            onChange={(event) => onUpdate({ ...product, recordKind: event.target.value as ProductKnowledgeV2["recordKind"] })}
          >
            {PRODUCT_RECORD_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          经营模式
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-800"
            value={product.productMode ?? "inbound"}
            onChange={(event) => onUpdate({ ...product, productMode: event.target.value as ProductKnowledgeV2["productMode"] })}
          >
            <option value="inbound">入仓产品</option>
            <option value="dropship">一件代发</option>
            <option value="hybrid">混合模式</option>
          </select>
        </label>
        <label className="text-xs text-slate-500">
          当前状态
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-800"
            value={product.portfolioStatus ?? "observe"}
            onChange={(event) => onUpdate({ ...product, portfolioStatus: event.target.value as ProductKnowledgeV2["portfolioStatus"] })}
          >
            <option value="active">继续经营</option>
            <option value="observe">观察</option>
            <option value="optimize">需要优化</option>
            <option value="paused">暂停</option>
            <option value="discontinued">淘汰</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block text-xs text-slate-500">
        {product.productMode === "dropship" ? "观察编号" : "内部产品编码（可选）"}
        <input
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-800"
          placeholder={product.productMode === "dropship" ? "例如 DS-2026-001" : "入仓产品可填写内部产品编码"}
          value={product.productMode === "dropship" ? product.observationCode ?? "" : product.internalProductCode ?? ""}
          onChange={(event) => onUpdate({
            ...product,
            ...(product.productMode === "dropship" ? { observationCode: event.target.value } : { internalProductCode: event.target.value })
          })}
        />
      </label>
      {product.recordKind === "existing" ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="text-xs font-medium text-slate-700">经营数据（可后续填写）</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricInput label="月销量" value={product.portfolioMetrics?.monthlySales} onChange={(value) => onUpdate({ ...product, portfolioMetrics: { ...product.portfolioMetrics, monthlySales: value } })} />
            <MetricInput label="销售额" value={product.portfolioMetrics?.salesAmount} onChange={(value) => onUpdate({ ...product, portfolioMetrics: { ...product.portfolioMetrics, salesAmount: value } })} />
            <MetricInput label="毛利率 %" value={product.portfolioMetrics?.grossMarginRate} onChange={(value) => onUpdate({ ...product, portfolioMetrics: { ...product.portfolioMetrics, grossMarginRate: value } })} />
            <MetricInput label="库存天数" value={product.portfolioMetrics?.inventoryDays} onChange={(value) => onUpdate({ ...product, portfolioMetrics: { ...product.portfolioMetrics, inventoryDays: value } })} />
            <MetricInput label="缺货次数" value={product.portfolioMetrics?.stockoutCount} onChange={(value) => onUpdate({ ...product, portfolioMetrics: { ...product.portfolioMetrics, stockoutCount: value } })} />
            <MetricInput label="退货率 %" value={product.portfolioMetrics?.returnRate} onChange={(value) => onUpdate({ ...product, portfolioMetrics: { ...product.portfolioMetrics, returnRate: value } })} />
            <MetricInput label="质量问题数" value={product.portfolioMetrics?.qualityIssueCount} onChange={(value) => onUpdate({ ...product, portfolioMetrics: { ...product.portfolioMetrics, qualityIssueCount: value } })} />
            <label className="text-xs text-slate-500">供应稳定性<select className="mt-1 w-full rounded-md border border-line bg-white px-2 py-2 text-sm text-slate-800" value={product.portfolioMetrics?.supplyStability ?? ""} onChange={(event) => onUpdate({ ...product, portfolioMetrics: { ...product.portfolioMetrics, supplyStability: (event.target.value || undefined) as "稳定" | "一般" | "不稳定" | undefined } })}><option value="">待填写</option><option value="稳定">稳定</option><option value="一般">一般</option><option value="不稳定">不稳定</option></select></label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-xs text-slate-500">当前经营判断<textarea className="mt-1 min-h-20 w-full rounded-md border border-line px-2 py-2 text-sm" placeholder="例如：继续经营，但需要优化成本" value={product.portfolioMetrics?.operatingJudgement ?? ""} onChange={(event) => onUpdate({ ...product, portfolioMetrics: { ...product.portfolioMetrics, operatingJudgement: event.target.value } })} /></label><label className="text-xs text-slate-500">判断依据<textarea className="mt-1 min-h-20 w-full rounded-md border border-line px-2 py-2 text-sm" placeholder="填写数据来源或人工判断依据" value={product.portfolioMetrics?.judgementBasis ?? ""} onChange={(event) => onUpdate({ ...product, portfolioMetrics: { ...product.portfolioMetrics, judgementBasis: event.target.value } })} /></label></div>
        </div>
      ) : null}
    </div>
  );
}

function MetricInput({ label, value, onChange }: { label: string; value?: number; onChange: (value?: number) => void }) {
  return <label className="text-xs text-slate-500">{label}<input className="mt-1 w-full rounded-md border border-line px-2 py-2 text-sm text-slate-800" min="0" onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} type="number" value={value ?? ""} /></label>;
}

function ProductSupplyPlanPanel({ productId }: { productId: string }) {
  const data = useWorkbenchData();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const plan = buildSupplyPlan({
    products: data.products.map((item) => ({ id: item.id, name: item.name })),
    skuMasters: (data.skuMasters ?? []).map((item) => ({ ...item })),
    suppliers: data.suppliers.map((item) => ({ id: item.id, name: item.name })),
    offers: data.offers,
    links: data.skuOfferLinks ?? [],
    decisions: data.supplierOfferDecisions ?? []
  }, productId);
  const taskDrafts = buildSupplyDecisionTasks(plan);

  function decide(skuMasterId: string, supplier: { supplierId?: string; offerId: string; offerSkuId: string }, status: SupplierOfferDecisionStatus) {
    saveSupplierOfferDecision({
      productId,
      skuMasterId,
      supplierId: supplier.supplierId,
      offerId: supplier.offerId,
      status,
      reason: reasons[`${skuMasterId}:${supplier.offerId}:${supplier.offerSkuId}`]?.trim() || "产品供应方案确认",
      reviewAt: new Date().toISOString()
    });
  }

  function createTasks() {
    const existingTitles = new Set(data.tasks.filter((task) => task.status === "open" && task.productId === productId).map((task) => task.title));
    const newTasks = taskDrafts.filter((task) => !existingTitles.has(task.title)).map((task) => ({
      id: randomId(),
      title: task.title,
      priority: task.priority,
      type: task.type,
      status: "open" as const,
      productId,
      productName: data.products.find((item) => item.id === productId)?.name,
      createdAt: new Date().toISOString()
    }));
    if (newTasks.length > 0) saveLocalWorkbenchData({ ...data, tasks: [...newTasks, ...data.tasks] });
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">供应方案</h2>
          <p className="mt-1 text-xs text-slate-500">按内部 SKU 汇总已确认货盘；原始供应商报价仍保留，只有决策状态会影响主供/备供判断。</p>
        </div>
        <div className="flex items-end gap-3 text-right text-xs text-slate-500"><div><div>SKU {plan.skuRows.length}</div><div className="mt-1">决策记录 {data.supplierOfferDecisionHistory?.filter((item) => item.productId === productId).length ?? 0}</div><div className="mt-1 text-amber-700">待补信息 {plan.missingFields.length}</div></div>{taskDrafts.length > 0 ? <button className="rounded-md border border-line px-2 py-1 text-xs text-action hover:bg-paper-warm" onClick={createTasks} type="button">生成待办 {taskDrafts.length}</button> : null}</div>
      </div>
      {plan.skuRows.length === 0 ? <p className="mt-4 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">还没有把内部 SKU 关联到这个产品，或还没有确认货盘关联。请先在“导入产品编码表”中选择所属产品，再确认货盘规格。</p> : (
        <div className="mt-4 space-y-3">
          {plan.skuRows.map((row) => (
            <div className="rounded-lg border border-line" key={row.skuMasterId}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper-warm px-3 py-2 text-sm">
                <div><span className="font-medium text-slate-900">{row.internalSkuCode}</span><span className="ml-2 text-slate-600">{row.specification || "规格待补"}</span></div>
                <div className="text-xs text-slate-500">主供：{row.primarySupplierId ? (data.suppliers.find((item) => item.id === row.primarySupplierId)?.name || "已指定") : "未指定"} · 备供 {row.backupSupplierIds.length}</div>
              </div>
              <div className="divide-y divide-line">
                {row.suppliers.map((supplier) => {
                  const key = `${row.skuMasterId}:${supplier.offerId}:${supplier.offerSkuId}`;
                  return <div className="flex flex-col gap-2 px-3 py-3 text-xs lg:flex-row lg:items-center lg:justify-between" key={key}>
                    <div className="min-w-0"><div className="font-medium text-slate-800">{supplier.supplierName}</div><div className="mt-1 text-slate-500">{supplier.specName} · {supplier.unitPrice != null ? `¥${supplier.unitPrice}` : "未报价"} · MOQ {supplier.moq || "待补"} · 交期 {supplier.leadTime || "待补"}</div></div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input className="w-40 rounded-md border border-line px-2 py-1" onChange={(event) => setReasons((current) => ({ ...current, [key]: event.target.value }))} placeholder="决策依据（可选）" value={reasons[key] ?? ""} />
                      {(["candidate", "primary", "backup", "not_selected"] as const).map((status) => <button className={`rounded-md border px-2 py-1 ${supplier.status === status ? "border-action bg-action-soft text-action" : "border-line text-slate-600 hover:bg-paper-warm"}`} key={status} onClick={() => decide(row.skuMasterId, supplier, status)} type="button">{status === "candidate" ? "候选" : status === "primary" ? "主供" : status === "backup" ? "备供" : "不选"}</button>)}
                    </div>
                  </div>;
                })}
              </div>
              {row.missingFields.length > 0 ? <div className="border-t border-line bg-amber-50 px-3 py-2 text-xs text-amber-800">待补：{row.missingFields.join("、")}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductKnowledgeView({ product }: { product: ProductKnowledgeV2 }) {
  const hasCategory = product.researchDepth === "category" || hasCategoryResearch(product);
  const [activeTab, setActiveTab] = useState<"product" | "research">(hasCategory ? "research" : "product");
  const showTabs = hasCategory;
  const workbenchData = useWorkbenchData();

  const risks = [
    ...product.risks.quality.map((value) => `质量：${value}`),
    ...product.risks.supply.map((value) => `供应：${value}`),
    ...product.risks.compliance.map((value) => `合规：${value}`),
    ...product.risks.other.map((value) => `使用/售后：${value}`)
  ];

  const productDetail = (
    <>
      <DetailSection title="产品与规格">
        <DetailGrid items={[
          ["目标用户", product.targetUsers],
          ["使用场景", product.useScenarios.join("、")],
          ["默认计量单位", product.defaultUnit],
          ["当前判断", product.decision.recommendation || product.decision.summary]
        ]} />
      </DetailSection>
      <DetailSection title="关键规格">
        {product.specifications.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {product.specifications.map((item, index) => (
              <div className="border-b border-line py-2 text-sm" key={item.id || `${item.name}-${index}`}>
                <span className="text-slate-500">{item.name}：</span>{item.value}{item.unit ? ` ${item.unit}` : ""}
              </div>
            ))}
          </div>
        ) : <Empty />}
      </DetailSection>
      <DetailSection title="1688采购参考">
        {product.procurementQuotes.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-line"><th className="py-2">来源</th><th>对应规格</th><th>批发报价</th><th>MOQ</th><th>运费</th><th>时间</th></tr></thead>
              <tbody>{product.procurementQuotes.map((quote, index) => (
                <tr className="border-b border-line" key={`${quote.source}-${quote.specification}-${index}`}>
                  <td className="py-2">{quote.source}</td><td>{quote.specification}</td><td>{quote.price}</td>
                  <td>{quote.moq || "待确认"}</td><td>{quote.freight || "待确认"}</td><td>{quote.quotedAt || "待确认"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty />}
      </DetailSection>
      <DetailSection title="原料与结构">
        {product.materialStructures.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {product.materialStructures.map((item, index) => (
              <div className="border-b border-line pb-3 text-sm" key={`${item.name}-${index}`}>
                <div className="font-medium">{item.name}</div>
                <div className="mt-1 text-slate-600">{[item.role, item.keyParameters, item.weaknesses].filter(Boolean).join("；")}</div>
              </div>
            ))}
          </div>
        ) : <Empty />}
      </DetailSection>
      <DetailSection title="生产流程与设备">
        <DetailGrid items={[
          ["核心工艺", product.manufacturing.processes.join("、")],
          ["所需机器", product.machinery.join("、")],
          ["质量控制点", product.qualityControls.join("、")],
          ["主要产业带", product.industryClusters.join("、")],
          ["生产难点", product.manufacturing.notes],
          ["生产周期", product.manufacturing.leadTime]
        ]} />
      </DetailSection>
      <DetailSection title="成熟替代、缺陷与采购验证">
        <DetailGrid items={[
          ["替代与优化", product.optimizationOptions.map((item) => `${item.name}${item.impact ? `：${item.impact}` : ""}`).join("；")],
          ["风险", risks.join("；")],
          ["必须确认与关键变量", product.decision.summary],
          ["下一步", product.decision.rationale]
        ]} />
      </DetailSection>
      {hasTechnologyOutlook(product) ? (
        <DetailSection title="技术趋势与替代风险">
          <DetailGrid items={[
            ["当前主流路线", product.technologyOutlook?.mainstream.join("、")],
            ["现有替代路线", product.technologyOutlook?.alternatives.join("、")],
            ["进入市场的新技术", product.technologyOutlook?.emerging.join("、")],
            ["被替代风险", product.technologyOutlook?.replacementRisks.join("、")],
            ["观察信号", product.technologyOutlook?.watchSignals.join("、")]
          ]} />
        </DetailSection>
      ) : null}
      {hasRelatedSuppliersOrOffers(product) ? (
        <DetailSection title="关联供应商与货盘">
          <RelatedSuppliersAndOffers product={product} workbenchData={workbenchData} />
        </DetailSection>
      ) : null}
    </>
  );

  if (!showTabs) {
    return <div className="space-y-6">{productDetail}</div>;
  }

  const tabBase = "rounded-md border border-line px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button className={activeTab === "product" ? `${tabBase} bg-action text-white` : tabBase} onClick={() => setActiveTab("product")} type="button">产品详情</button>
        <button className={activeTab === "research" ? `${tabBase} bg-action text-white` : tabBase} onClick={() => setActiveTab("research")} type="button">深度调研</button>
      </div>
      {activeTab === "product" ? (
        <>
          {!hasStandardProductData(product) && product.rawDocument?.content ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              当前产品为品类调研报告，标准产品字段为空。请切换到"深度调研"标签查看品类数据，或点击"编辑"补充标准产品字段。
            </div>
          ) : null}
          {productDetail}
        </>
      ) : <CategoryResearchView product={product} />}
      {product.rawDocument?.content ? (
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">原始调研文档</h2>
          <p className="mt-1 text-sm text-slate-500">这是你导入的原始文档内容，即使结构化解析不完整，原始数据始终保留。</p>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-paper p-3 text-xs leading-6 text-slate-700">
            {product.rawDocument.content}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

function hasTechnologyOutlook(product: ProductKnowledgeV2): boolean {
  const outlook = product.technologyOutlook;
  return Boolean(outlook && [outlook.mainstream, outlook.alternatives, outlook.emerging, outlook.replacementRisks, outlook.watchSignals].some((items) => items.length > 0));
}

function hasRelatedSuppliersOrOffers(product: ProductKnowledgeV2): boolean {
  return (product.relatedSupplierIds?.length ?? 0) > 0 || (product.relatedOfferIds?.length ?? 0) > 0;
}

function RelatedSuppliersAndOffers({
  product,
  workbenchData
}: {
  product: ProductKnowledgeV2;
  workbenchData: { suppliers: LocalSupplier[]; offers: LocalOffer[] };
}) {
  const relatedSupplierIds = product.relatedSupplierIds ?? [];
  const relatedOfferIds = product.relatedOfferIds ?? [];
  const relatedSuppliers = relatedSupplierIds
    .map((id) => workbenchData.suppliers.find((s) => s.id === id))
    .filter((s): s is LocalSupplier => Boolean(s));
  const relatedOffers = relatedOfferIds
    .map((id) => workbenchData.offers.find((o) => o.id === id))
    .filter((o): o is LocalOffer => Boolean(o));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <div className="text-sm text-slate-500">关联供应商</div>
        {relatedSuppliers.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {relatedSuppliers.map((supplier) => (
              <li key={supplier.id}>
                <Link className="text-action hover:underline" href={`/suppliers/${supplier.id}`}>{supplier.name}</Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-sm text-slate-500">未关联</p>}
      </div>
      <div>
        <div className="text-sm text-slate-500">关联货盘</div>
        {relatedOffers.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {relatedOffers.map((offer) => (
              <li key={offer.id}>
                <Link className="text-action hover:underline" href={`/offers/${offer.id}`}>{offer.name}</Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-sm text-slate-500">未关联</p>}
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="border-b border-line pb-2 text-lg font-semibold">{title}</h2><div className="pt-3">{children}</div></section>;
}

function DetailGrid({ items }: { items: Array<[string, string | undefined]> }) {
  return <div className="grid gap-3 sm:grid-cols-2">{items.map(([label, value]) => <div className="text-sm" key={label}><div className="text-slate-500">{label}</div><div className="mt-1 whitespace-pre-wrap">{value || "未记录"}</div></div>)}</div>;
}

function Empty() {
  return <p className="text-sm text-slate-500">未记录</p>;
}

function CategoryResearchView({ product }: { product: ProductKnowledgeV2 }) {
  const market = product.marketOverview;
  const competitive = product.competitiveLandscape;
  const benchmark = product.productBenchmark;
  const insights = product.userInsights;
  const supply = product.supplyChainFindings;

  return (
    <>
      <DetailSection title="行业概览">
        {market ? (
          <div className="space-y-4">
            <DetailGrid items={[
              ["市场规模", market.marketSize],
              ["同比增长", market.yoyGrowth],
              ["细分趋势", market.subCategoryTrend]
            ]} />
            <PestelTable pestel={market.pestel} />
            <EntryBarriersTable entryBarriers={market.entryBarriers} />
            <ResearchTableView table={market.marketSizeTable} />
            <ResearchTableView table={market.segmentStructure} />
          </div>
        ) : <Empty />}
      </DetailSection>
      <DetailSection title="竞争格局">
        {competitive ? (
          <div className="space-y-4">
            <DetailGrid items={[["CR5", competitive.cr5]]} />
            <ResearchTableView table={competitive.topBrandRanking} />
            <ResearchTableView table={competitive.brandRankingByCategory} />
            <PorterFiveForcesTable porterFiveForces={competitive.porterFiveForces} />
            <DetailGrid items={[["策略差异", competitive.strategyDifferences]]} />
          </div>
        ) : <Empty />}
      </DetailSection>
      <DetailSection title="产品对标">
        {benchmark ? (
          <div className="space-y-4">
            <ResearchTableView table={benchmark.tmallProtectiveFilm} />
            <ResearchTableView table={benchmark.tmallHangingBoard} />
            <ResearchTableView table={benchmark.formComparison} />
            <ResearchTableView table={benchmark.priceTiers} />
            <DetailGrid items={[["关键发现", benchmark.keyFindings]]} />
          </div>
        ) : <Empty />}
      </DetailSection>
      <DetailSection title="用户洞察">
        {insights ? (
          <div className="space-y-4">
            <ResearchTableView table={insights.personas} />
            <ResearchTableView table={insights.coreMetrics} />
            <StringList title="购买决策因素" items={insights.purchasePriorities} />
            <ResearchTableView table={insights.complaints} />
            <StringList title="好评卖点" items={insights.praisePoints} />
          </div>
        ) : <Empty />}
      </DetailSection>
      <DetailSection title="供应链寻源">
        {supply ? (
          <div className="space-y-4">
            <ResearchTableView table={supply.coreMetrics} />
            <ResearchTableView table={supply.filmSuppliers} />
            <ResearchTableView table={supply.boardSuppliers} />
            <ResearchTableView table={supply.priceGradientFilm} />
            <ResearchTableView table={supply.priceGradientBoard} />
            <DetailGrid items={[["三合一供应说明", supply.comboSupply]]} />
            <ResearchTableView table={supply.sourcingAdvice} />
            <StringList title="寻源执行路径步骤" items={supply.sourcingPathSteps} />
          </div>
        ) : <Empty />}
      </DetailSection>
      {!hasCategoryResearch(product) && product.rawDocument?.content ? (
        <DetailSection title="结构化解析不完整">
          <p className="text-sm text-slate-600">
            当前品类调研的结构化数据尚未完整提取。你可以通过"编辑"按钮手动补充，下方保留了原始文档内容供参考。
          </p>
        </DetailSection>
      ) : null}
    </>
  );
}

function hasCategoryResearch(product: ProductKnowledgeV2): boolean {
  const m = product.marketOverview;
  const c = product.competitiveLandscape;
  const b = product.productBenchmark;
  const u = product.userInsights;
  const s = product.supplyChainFindings;
  if (m && (m.marketSize || m.yoyGrowth || m.subCategoryTrend || m.pestel?.length || m.entryBarriers?.length || hasTable(m.marketSizeTable) || hasTable(m.segmentStructure))) return true;
  if (c && (c.cr5 || c.strategyDifferences || c.porterFiveForces?.length || hasTable(c.topBrandRanking) || hasTable(c.brandRankingByCategory))) return true;
  if (b && (b.keyFindings || hasTable(b.tmallProtectiveFilm) || hasTable(b.tmallHangingBoard) || hasTable(b.formComparison) || hasTable(b.priceTiers))) return true;
  if (u && (u.purchasePriorities?.length || u.praisePoints?.length || hasTable(u.personas) || hasTable(u.coreMetrics) || hasTable(u.complaints))) return true;
  if (s && (s.comboSupply || s.sourcingPathSteps?.length || hasTable(s.coreMetrics) || hasTable(s.filmSuppliers) || hasTable(s.boardSuppliers) || hasTable(s.priceGradientFilm) || hasTable(s.priceGradientBoard) || hasTable(s.sourcingAdvice))) return true;
  return false;
}

function hasStandardProductData(product: ProductKnowledgeV2): boolean {
  return Boolean(
    product.targetUsers
    || product.category
    || product.coreUse
    || (product.useScenarios && product.useScenarios.length > 0)
    || (product.specifications && product.specifications.length > 0)
    || (product.procurementQuotes && product.procurementQuotes.length > 0)
    || (product.materialStructures && product.materialStructures.length > 0)
    || (product.costItems && product.costItems.length > 0)
    || product.decision?.summary
    || product.decision?.recommendation
  );
}

function hasTable(table: ResearchTable | undefined): boolean {
  return Boolean(table && table.rows && table.rows.length > 0);
}

function ResearchTableView({ table }: { table: ResearchTable | undefined }) {
  if (!table || !table.rows || table.rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      {table.caption ? <p className="mb-2 text-sm text-slate-500">{table.caption}</p> : null}
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {table.headers.map((header, index) => (
              <th className="py-2 pr-4" key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr className="border-b border-line" key={rowIndex}>
              {table.headers.map((header, colIndex) => (
                <td className="py-2 pr-4" key={colIndex}>{row[header] || "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PestelTable({ pestel }: { pestel: MarketOverview["pestel"] }) {
  if (!pestel || pestel.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2 pr-4">维度</th>
            <th className="py-2 pr-4">关键因素</th>
            <th className="py-2 pr-4">影响</th>
          </tr>
        </thead>
        <tbody>
          {pestel.map((item, index) => (
            <tr className="border-b border-line" key={index}>
              <td className="py-2 pr-4">{item.dimension}</td>
              <td className="py-2 pr-4">{item.factor}</td>
              <td className="py-2 pr-4">{item.impact}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PorterFiveForcesTable({ porterFiveForces }: { porterFiveForces: CompetitiveLandscape["porterFiveForces"] }) {
  if (!porterFiveForces || porterFiveForces.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2 pr-4">竞争力量</th>
            <th className="py-2 pr-4">强度</th>
            <th className="py-2 pr-4">关键依据</th>
          </tr>
        </thead>
        <tbody>
          {porterFiveForces.map((item, index) => (
            <tr className="border-b border-line" key={index}>
              <td className="py-2 pr-4">{item.force}</td>
              <td className="py-2 pr-4">{item.strength}</td>
              <td className="py-2 pr-4">{item.basis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryBarriersTable({ entryBarriers }: { entryBarriers: MarketOverview["entryBarriers"] }) {
  if (!entryBarriers || entryBarriers.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2 pr-4">门槛维度</th>
            <th className="py-2 pr-4">高低</th>
            <th className="py-2 pr-4">分析</th>
          </tr>
        </thead>
        <tbody>
          {entryBarriers.map((item, index) => (
            <tr className="border-b border-line" key={index}>
              <td className="py-2 pr-4">{item.name}</td>
              <td className="py-2 pr-4">{item.level}</td>
              <td className="py-2 pr-4">{item.analysis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StringList({ title, items }: { title: string; items: string[] | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="text-sm">
      <div className="text-slate-500">{title}</div>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </div>
  );
}

const DORMANT_REASON_OPTIONS: ProductDormantReason[] = ["供应商不成熟", "采购成本过高", "季节不适配", "资金不足", "产能受限", "竞争太激烈", "其他"];

function LifecycleStatusBar({ product, onUpdate }: { product: ProductKnowledgeV2; onUpdate: (next: ProductKnowledgeV2) => void }) {
  const isSignalStage = !product.lifecycleStage || product.lifecycleStage === "signal";

  function setStage(stage: ProductLifecycleStage) {
    onUpdate({
      ...product,
      lifecycleStage: stage,
      // 如果离开 signal 阶段，把 signalStatus 固定为 active（非信号阶段不需要休眠）
      signalStatus: stage === "signal" ? (product.signalStatus ?? "active") : "active"
    });
  }

  function setSignalStatus(status: ProductSignalStatus) {
    onUpdate({
      ...product,
      signalStatus: status,
      lifecycleStage: product.lifecycleStage ?? "signal",
      // 如果从 dormant 切走，清除休眠原因
      dormantReason: status === "dormant" ? product.dormantReason : undefined
    });
  }

  function setDormantReason(reason: ProductDormantReason) {
    onUpdate({ ...product, dormantReason: reason, signalStatus: "dormant", lifecycleStage: product.lifecycleStage ?? "signal" });
  }

  const stageMeta = labelLifecycleStage(product.lifecycleStage);
  const signalMeta = labelSignalStatus(product.signalStatus);

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-line bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">当前阶段：</span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${stageMeta.tone}`}>{stageMeta.label}</span>
          {isSignalStage && product.signalStatus && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${signalMeta.tone}`}>
              {signalMeta.label}
              {product.signalStatus === "dormant" && product.dormantReason ? ` · ${labelDormantReason(product.dormantReason)}` : ""}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-slate-500">阶段切换（点击直接推进漏斗）</div>
        <div className="flex flex-wrap gap-1.5">
          {LIFECYCLE_STAGE_OPTIONS.map((opt) => {
            const active = (product.lifecycleStage ?? "signal") === opt.value;
            const meta = labelLifecycleStage(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStage(opt.value as ProductLifecycleStage)}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${active ? meta.tone : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-100"}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {isSignalStage && (
        <div className="space-y-2 border-t border-dashed border-line pt-3">
          <div>
            <div className="mb-2 text-xs font-medium text-slate-500">信号状态（仅信号池阶段）</div>
            <div className="flex flex-wrap gap-1.5">
              {SIGNAL_STATUS_OPTIONS.map((opt) => {
                const active = (product.signalStatus ?? "active") === opt.value;
                const meta = labelSignalStatus(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSignalStatus(opt.value as ProductSignalStatus)}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${active ? meta.tone : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-100"}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {(product.signalStatus === "dormant" || product.dormantReason) && (
            <div>
              <div className="mb-2 text-xs font-medium text-slate-500">休眠原因</div>
              <div className="flex flex-wrap gap-1.5">
                {DORMANT_REASON_OPTIONS.map((reason) => {
                  const active = product.dormantReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setDormantReason(reason)}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${active ? "bg-slate-200 text-slate-800 ring-slate-300" : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-100"}`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
