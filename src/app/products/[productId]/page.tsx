"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ProductKnowledgeEditor } from "@/components/workbench/product-knowledge-editor";
import { SectionActions } from "@/components/workbench/edit-fields";
import { deleteLocalItem, loadLocalWorkbenchData, saveProductKnowledge, type LocalOffer, type LocalSupplier } from "@/features/workbench/local-store";
import type { CompetitiveLandscape, MarketOverview, ProductKnowledgeV2, ResearchTable } from "@/features/workbench/product-knowledge";
import { buildProductTechnologyPrompt } from "@/features/workbench/product-technology-prompt";

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId;
  const storedProduct = loadLocalWorkbenchData().products.find((item) => item.id === productId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProductKnowledgeV2 | undefined>(storedProduct);
  const [version, setVersion] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");

  if (!storedProduct || !draft) {
    return <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">没有找到这个产品知识。</div>;
  }
  const product = loadLocalWorkbenchData().products.find((item) => item.id === productId) || storedProduct;

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
          <div>
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <p className="mt-1 text-sm text-slate-600">{product.category || "未记录品类"}{product.coreUse ? ` · ${product.coreUse}` : ""}</p>
          </div>
          <SectionActions editing={editing} onCancel={() => { setDraft(product); setEditing(false); }} onDelete={remove} onEdit={() => setEditing(true)} onSave={save} />
        </div>
      </section>

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

function ProductKnowledgeView({ product }: { product: ProductKnowledgeV2 }) {
  const [activeTab, setActiveTab] = useState<"product" | "research">("product");
  const showTabs = product.researchDepth === "category" || hasCategoryResearch(product);
  const workbenchData = loadLocalWorkbenchData();

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
      {activeTab === "product" ? productDetail : <CategoryResearchView product={product} />}
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
