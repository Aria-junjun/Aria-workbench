"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ProductKnowledgeEditor } from "@/components/workbench/product-knowledge-editor";
import { SectionActions } from "@/components/workbench/edit-fields";
import { deleteLocalItem, loadLocalWorkbenchData, saveProductKnowledge } from "@/features/workbench/local-store";
import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";
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
  const risks = [
    ...product.risks.quality.map((value) => `质量：${value}`),
    ...product.risks.supply.map((value) => `供应：${value}`),
    ...product.risks.compliance.map((value) => `合规：${value}`),
    ...product.risks.other.map((value) => `使用/售后：${value}`)
  ];

  return (
    <div className="space-y-6">
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
    </div>
  );
}

function hasTechnologyOutlook(product: ProductKnowledgeV2): boolean {
  const outlook = product.technologyOutlook;
  return Boolean(outlook && [outlook.mainstream, outlook.alternatives, outlook.emerging, outlook.replacementRisks, outlook.watchSignals].some((items) => items.length > 0));
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
