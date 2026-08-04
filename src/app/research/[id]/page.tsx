"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  deleteResearchReport,
  linkResearchToProduct,
  loadLocalWorkbenchData,
  saveResearchReport,
  type ResearchReport
} from "@/features/workbench/local-store";

export default function ResearchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [mounted, setMounted] = useState(false);
  const [version, setVersion] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-4">
        <Link className="text-sm text-action" href="/research">返回调研报告列表</Link>
        <div className="rounded-lg border border-line bg-white p-8 text-center text-slate-500">
          加载中...
        </div>
      </div>
    );
  }

  const data = loadLocalWorkbenchData();
  const report = id ? data.researchReports.find((item) => item.id === id) : undefined;

  if (!report) {
    return (
      <div className="space-y-4">
        <Link className="text-sm text-action" href="/research">返回调研报告列表</Link>
        <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">
          没有找到这份调研报告，可能已被删除。
        </div>
      </div>
    );
  }

  const linkedProductIds = report.linkedProductIds ?? [];
  const linkedProducts = linkedProductIds
    .map((pid) => data.products.find((p) => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const availableProducts = data.products.filter((p) => !linkedProductIds.includes(p.id));
  const filteredAvailable = availableProducts.filter((p) =>
    !linkQuery.trim() || p.name.toLowerCase().includes(linkQuery.trim().toLowerCase())
  );

  function startEditTitle() {
    setTitleDraft(report?.title ?? "");
    setEditingTitle(true);
  }

  function saveTitle() {
    if (!report) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setEditingTitle(false);
      return;
    }
    saveResearchReport({ ...report, title: trimmed });
    setEditingTitle(false);
    setVersion((v) => v + 1);
  }

  function remove() {
    if (!report) return;
    if (!window.confirm("确认删除这份调研报告吗？原始 Markdown 内容将一并删除。")) return;
    deleteResearchReport(report.id);
    router.push("/research");
  }

  function linkProduct(productId: string) {
    if (!report) return;
    linkResearchToProduct(report.id, productId);
    setVersion((v) => v + 1);
  }

  function unlinkProduct(productId: string) {
    if (!report) return;
    saveResearchReport({
      ...report,
      linkedProductIds: (report.linkedProductIds ?? []).filter((pid) => pid !== productId)
    });
    setVersion((v) => v + 1);
  }

  return (
    <div className="space-y-5" data-version={version}>
      <Link className="text-sm text-action" href="/research">返回调研报告列表</Link>

      {/* 标题与元信息：标题可编辑 */}
      <section className="border-b border-line pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-lg font-semibold"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="报告标题"
                  autoFocus
                />
                <button className="rounded-md bg-action px-3 py-2 text-sm text-white" type="button" onClick={saveTitle}>保存</button>
                <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" type="button" onClick={() => setEditingTitle(false)}>取消</button>
              </div>
            ) : (
              <h1 className="text-2xl font-semibold">{report.title || "未命名调研报告"}</h1>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>导入时间：{formatDateTime(report.importedAt)}</span>
              <span>·</span>
              <span>来源：{report.source || "未记录"}</span>
              <span>·</span>
              <span className="flex items-center gap-1">状态：<StatusBadge status={report.status} /></span>
              {report.updatedAt ? (
                <>
                  <span>·</span>
                  <span>更新于 {formatDateTime(report.updatedAt)}</span>
                </>
              ) : null}
            </div>
          </div>
          {!editingTitle ? (
            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" type="button" onClick={startEditTitle}>编辑标题</button>
              <button className="rounded-md border border-danger-soft bg-white px-3 py-2 text-sm text-danger" type="button" onClick={remove}>删除报告</button>
            </div>
          ) : null}
        </div>
      </section>

      {/* 原始 Markdown 内容 */}
      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="border-b border-line pb-2 text-lg font-semibold">原始调研内容</h2>
        <p className="mt-1 text-sm text-slate-500">保留导入时的原始 Markdown 全文，可在此基础上进行结构化解析或关联产品。</p>
        <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-paper p-3 text-xs leading-6 text-slate-700">
          {report.content || "（无内容）"}
        </pre>
      </section>

      {/* 关联产品 */}
      <section className="rounded-lg border border-line bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">关联产品（{linkedProducts.length}）</h2>
          <button
            className="rounded-md border border-line bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:text-slate-400"
            type="button"
            disabled={availableProducts.length === 0}
            onClick={() => setShowLinkPanel((v) => !v)}
          >
            {showLinkPanel ? "收起选择" : "关联产品"}
          </button>
        </div>

        {linkedProducts.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {linkedProducts.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm">
                <Link className="min-w-0 truncate text-action hover:underline" href={`/products/${product.id}`}>
                  {product.name}
                </Link>
                <button
                  className="shrink-0 text-xs text-slate-500 hover:text-danger"
                  type="button"
                  onClick={() => unlinkProduct(product.id)}
                >
                  取消关联
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">尚未关联任何产品。</p>
        )}

        {showLinkPanel ? (
          <div className="mt-4 rounded-md border border-line bg-paper p-3">
            <div className="flex items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded border border-line bg-white px-2 py-1 text-sm"
                placeholder="搜索产品名称"
                value={linkQuery}
                onChange={(e) => setLinkQuery(e.target.value)}
              />
              <span className="shrink-0 text-xs text-slate-500">{availableProducts.length} 个可选</span>
            </div>
            {filteredAvailable.length > 0 ? (
              <ul className="mt-2 max-h-60 space-y-1 overflow-auto">
                {filteredAvailable.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-white">
                    <Link className="min-w-0 truncate hover:text-action" href={`/products/${product.id}`}>
                      {product.name}
                    </Link>
                    <button
                      className="shrink-0 rounded border border-line bg-white px-2 py-0.5 text-xs"
                      type="button"
                      onClick={() => linkProduct(product.id)}
                    >
                      添加
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                {availableProducts.length === 0 ? "所有产品都已关联。" : "没有匹配的产品。"}
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: ResearchReport["status"] }) {
  const config: Record<ResearchReport["status"], { label: string; className: string }> = {
    draft: { label: "草稿", className: "border-warning-soft bg-warning-soft text-warning" },
    active: { label: "使用中", className: "border-success-soft bg-success-soft text-success" },
    archived: { label: "已归档", className: "border-line bg-paper text-slate-500" }
  };
  const { label, className } = config[status] ?? config.active;
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs ${className}`}>
      {label}
    </span>
  );
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}
