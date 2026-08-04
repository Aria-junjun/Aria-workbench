"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { loadLocalWorkbenchData, type ResearchReport } from "@/features/workbench/local-store";

export default function ResearchListPage() {
  const [mounted, setMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold">深度调研报告</h1>
        <div className="rounded-lg border border-line bg-white p-8 text-center text-slate-500">
          加载中...
        </div>
      </div>
    );
  }

  const data = loadLocalWorkbenchData();
  const reports = [...data.researchReports].sort(
    (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
  );

  return (
    <div className="space-y-5" data-key={refreshKey}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">深度调研报告</h1>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-line bg-white px-3 py-2 text-sm"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            刷新
          </button>
          <Link
            className="whitespace-nowrap rounded-md bg-action px-3 py-2 text-sm font-medium text-white"
            href="/research/import"
          >
            导入调研报告
          </Link>
        </div>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title="还没有深度调研报告"
          description="导入调研报告后，可在此查看原始 Markdown 内容，并把报告关联到具体产品。"
          actionHref="/research/import"
          actionLabel="导入调研报告"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <ResearchCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResearchCard({ report }: { report: ResearchReport }) {
  const linkedCount = report.linkedProductIds?.length ?? 0;
  return (
    <Link
      className="block rounded-lg border border-line bg-white p-4 transition hover:border-action"
      href={`/research/${report.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-medium hover:text-action">{report.title || "未命名调研报告"}</h3>
        <StatusTag status={report.status} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{report.summary || "暂无摘要"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>导入于 {formatDate(report.importedAt)}</span>
        <span>·</span>
        <span>关联产品 {linkedCount}</span>
        {report.source ? (
          <>
            <span>·</span>
            <span className="truncate">{report.source}</span>
          </>
        ) : null}
      </div>
    </Link>
  );
}

function StatusTag({ status }: { status: ResearchReport["status"] }) {
  const config: Record<ResearchReport["status"], { label: string; className: string }> = {
    draft: { label: "草稿", className: "border-warning-soft bg-warning-soft text-warning" },
    active: { label: "使用中", className: "border-success-soft bg-success-soft text-success" },
    archived: { label: "已归档", className: "border-line bg-paper text-slate-500" }
  };
  const { label, className } = config[status] ?? config.active;
  return (
    <span className={`shrink-0 whitespace-nowrap rounded border px-2 py-0.5 text-xs ${className}`}>
      {label}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return iso;
  }
}
