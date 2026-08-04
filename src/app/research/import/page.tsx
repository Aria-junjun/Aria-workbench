"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveResearchReportFromMarkdown } from "@/features/workbench/research-store";

export default function ResearchImportPage() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      if (textareaRef.current) {
        textareaRef.current.value = text;
      }
      setFileName(file.name);
      setError(null);
    };
    reader.onerror = () => setError("读取文件失败，请手动粘贴内容。");
    reader.readAsText(file, "utf-8");
  }

  function handleSave() {
    const text = textareaRef.current?.value ?? "";
    if (!text.trim()) {
      setError("请先粘贴或上传调研文档。");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const report = saveResearchReportFromMarkdown(text, { fileName: fileName || undefined });
      router.push(`/research/${report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请重试。");
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">导入调研报告</h1>
          <p className="mt-1 text-sm text-slate-600">
            粘贴或上传调研文档，原始 Markdown 将完整保存到深度调研库，后期可关联产品。
          </p>
        </div>
        <div className="flex gap-3">
          <Link className="shrink-0 whitespace-nowrap text-sm text-action" href="/research">
            返回调研报告库
          </Link>
          <Link className="shrink-0 whitespace-nowrap text-sm text-slate-500" href="/products/import">
            导入产品知识
          </Link>
        </div>
      </div>

      {/* 粘贴文档区域 */}
      <section className="rounded-lg border border-line bg-white p-4">
        <label className="block text-sm font-medium text-ink">粘贴文档</label>
        <p className="mt-1 text-xs text-slate-500">支持 Markdown、TXT 和 Word 文档；也可以直接粘贴文本。</p>
        <textarea
          ref={textareaRef}
          className="mt-3 min-h-[16rem] w-full resize-y rounded-md border border-line bg-white px-3 py-2 font-mono text-sm leading-6"
          placeholder="在此粘贴调研报告 Markdown 全文..."
          defaultValue=""
        />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>{textareaRef.current?.value?.length ?? 0} 字符</span>
          {error ? <span className="text-danger">{error}</span> : null}
        </div>
      </section>

      {/* 操作按钮 */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4">
        <p className="text-xs text-slate-500">
          保存后，原始 Markdown 完整保留在调研库中，不会丢失任何内容。
        </p>
        <button
          className="rounded-md bg-action px-4 py-2 text-sm font-medium text-white transition hover:bg-action-strong disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving ? "保存中..." : "保存到调研库"}
        </button>
      </section>

      {/* 上传文档 */}
      <section className="rounded-lg border border-line bg-white p-4">
        <label className="block text-sm font-medium text-ink">上传文档</label>
        <p className="mt-1 text-xs text-slate-500">支持 Markdown、TXT 和 Word 文档，单个文件不超过 10MB。</p>
        <div className="mt-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm hover:bg-paper-warm">
            <input
              className="hidden"
              type="file"
              accept=".md,.txt,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            选择文件
          </label>
          {fileName ? <span className="ml-3 text-xs text-slate-500">已选择：{fileName}</span> : null}
        </div>
      </section>
    </div>
  );
}
