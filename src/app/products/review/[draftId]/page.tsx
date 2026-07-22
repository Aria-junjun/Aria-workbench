"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductKnowledgeEditor } from "@/components/workbench/product-knowledge-editor";
import {
  deleteProductImportDraft,
  loadProductImportDraft,
  saveProductKnowledge,
  updateProductImportDraft
} from "@/features/workbench/product-import-store";
import type { ProductImportIssue, ParsedProductResearch } from "@/features/workbench/product-research-parser";
import type { ProductImportIssue as ProductModelImportIssue, ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

const issueGroups: Array<{
  severity: ProductImportIssue["severity"];
  label: string;
  emptyText: string;
  className: string;
}> = [
  { severity: "blocking", label: "阻断问题", emptyText: "没有阻断问题", className: "border-red-200 bg-red-50 text-red-900" },
  { severity: "warning", label: "待补资料", emptyText: "没有待补资料", className: "border-amber-200 bg-amber-50 text-amber-900" },
  { severity: "conflict", label: "冲突项", emptyText: "没有冲突项", className: "border-orange-200 bg-orange-50 text-orange-900" }
];

export default function ProductResearchReviewPage({ params }: { params: Promise<{ draftId: string }> }) {
  const router = useRouter();
  const [draftId, setDraftId] = useState("");
  const [draft, setDraft] = useState<ParsedProductResearch | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    params.then(({ draftId }) => {
      if (!active) return;
      setDraftId(draftId);
      setDraft(loadProductImportDraft(draftId) || null);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [params]);

  if (!loaded) {
    return <p className="text-sm text-slate-600">正在读取产品调研草稿...</p>;
  }

  if (!draft) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">没有找到这份产品调研草稿，请重新导入文档。</p>
        <Link className="text-sm text-action" href="/products/import">返回导入页</Link>
      </div>
    );
  }

  const product = cleanResolvedModelIssues(draft.product);
  const activeIssues = draft.issues.filter((issue) => !isResolvedIssue(issue, product));
  const hasBlockingIssues = activeIssues.some((issue) => issue.severity === "blocking");

  function updateProduct(product: ProductKnowledgeV2) {
    setError("");
    setDraft((current) => current ? { ...current, product } : current);
    updateProductImportDraft(draftId, product);
  }

  function confirmProduct() {
    if (hasBlockingIssues || isSaving) return;
    setIsSaving(true);
    setError("");

    try {
      const saved = saveProductKnowledge(product);
      deleteProductImportDraft(draftId);
      router.push(`/products/${saved.id}`);
    } catch {
      setError("入库失败，请检查必填字段和成本数据后重试。");
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link className="text-sm text-action" href="/products/import">返回导入页</Link>
          <h1 className="mt-2 text-2xl font-semibold">确认产品调研</h1>
          <p className="mt-1 text-sm text-slate-600">对照原文检查结构化字段，修正阻断问题后再入库。</p>
        </div>
        <button
          className="shrink-0 whitespace-nowrap rounded-md bg-action px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving || hasBlockingIssues}
          onClick={confirmProduct}
          type="button"
        >
          {isSaving ? "正在入库" : "确认入库"}
        </button>
      </div>

      <section aria-label="导入问题" className="grid gap-3 md:grid-cols-3">
        {issueGroups.map((group) => {
          const groupIssues = activeIssues.filter((issue) => issue.severity === group.severity);
          return (
            <div className={`rounded-md border p-3 ${group.className}`} key={group.severity}>
              <div className="text-sm font-semibold">{group.label}（{groupIssues.length}）</div>
              {groupIssues.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {groupIssues.map((issue) => <li key={issue.id}>{issue.section}：{issue.message}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm opacity-75">{group.emptyText}</p>
              )}
            </div>
          );
        })}
      </section>

      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 rounded-lg border border-line bg-white p-4 xl:sticky xl:top-6">
          <h2 className="font-semibold">原始调研文档</h2>
          <p className="mt-1 text-xs text-slate-500">{product.rawDocument?.sourceName || "粘贴内容"}</p>
          <pre className="mt-3 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-paper p-3 text-xs leading-6 text-slate-700">
            {product.rawDocument?.content || "原始文档未保留可显示文字。"}
          </pre>
        </section>

        <section className="min-w-0 rounded-lg border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">结构化字段</h2>
          <p className="mt-1 text-sm text-slate-600">所有产品字段都可在确认前修改。</p>
          <div className="mt-4">
            <ProductKnowledgeEditor issues={activeIssues} onChange={updateProduct} value={product} />
          </div>
        </section>
      </div>
    </div>
  );
}

function isResolvedIssue(issue: ProductImportIssue, product: ProductKnowledgeV2): boolean {
  return issue.severity === "blocking"
    && issue.section === "产品定位"
    && issue.message.includes("缺少产品名称")
    && hasConfirmedName(product);
}

function cleanResolvedModelIssues(product: ProductKnowledgeV2): ProductKnowledgeV2 {
  if (!hasConfirmedName(product)) return product;
  const importIssues = product.importIssues.filter((issue) => !isResolvedModelIssue(issue));
  return importIssues.length === product.importIssues.length ? product : { ...product, importIssues };
}

function isResolvedModelIssue(issue: ProductModelImportIssue): boolean {
  return issue.severity === "blocking"
    && issue.field === "产品定位"
    && issue.message.includes("缺少产品名称");
}

function hasConfirmedName(product: ProductKnowledgeV2): boolean {
  return Boolean(product.name.trim()) && product.name !== "未命名产品";
}
