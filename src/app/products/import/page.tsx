"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveProductImportDraft } from "@/features/workbench/product-import-store";
import { parseProductResearchMarkdown } from "@/features/workbench/product-research-parser";
import { PRODUCT_RESEARCH_PROMPT } from "@/features/workbench/product-research-prompt";
import { saveResearchReportFromMarkdown } from "@/features/workbench/research-store";

export default function ProductResearchImportPage() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const rawTextRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [fileName, setFileName] = useState("");
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(PRODUCT_RESEARCH_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("无法访问剪贴板，请检查浏览器权限后重试。");
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/products/file", {
        method: "POST",
        body: formData
      });
      const data = (await response.json().catch(() => null)) as { error?: string; fileName?: string; text?: string } | null;

      if (!response.ok || !data?.text) {
        setError(data?.error || "文档读取失败，请检查文件后重试。");
        return;
      }

      setRawText(data.text);
      setFileName(data.fileName || file.name);
    } catch {
      setError("无法连接到文档读取服务，请重新打开工作台后再试。");
    } finally {
      setIsUploading(false);
    }
  }

  function parseDocument() {
    const currentText = textareaRef.current?.value ?? rawTextRef.current ?? rawText;
    if (!currentText.trim()) {
      setError("请先粘贴或上传产品调研文档。");
      return;
    }

    setError("");
    const parsed = parseProductResearchMarkdown(currentText, {
      fileName: fileName || undefined,
      importedAt: new Date().toISOString()
    });
    const draftId = saveProductImportDraft(parsed);
    router.push(`/products/review/${draftId}`);
  }

  // 直接保存为调研报告（不做结构化解析，保留原始内容）
  function saveAsResearchReport() {
    const currentText = textareaRef.current?.value ?? rawTextRef.current ?? rawText;
    if (!currentText.trim()) {
      setError("请先粘贴或上传调研文档。");
      return;
    }

    setError("");
    const report = saveResearchReportFromMarkdown(currentText, {
      fileName: fileName || undefined
    });
    router.push(`/research/${report.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">导入产品调研</h1>
          <p className="mt-1 text-sm text-slate-600">粘贴或上传调研文档，可直接存入深度调研库，或尝试结构化解析。</p>
        </div>
        <div className="flex gap-3">
          <Link className="shrink-0 whitespace-nowrap text-sm text-action" href="/research">
            调研报告库
          </Link>
          <Link className="shrink-0 whitespace-nowrap text-sm text-slate-500" href="/products">
            产品知识库
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold">调研提示词</h2>
            <p className="mt-1 text-sm text-slate-600">复制后交给 ChatGPT Plus，并要求最终输出固定 Markdown 模板。</p>
          </div>
          <button
            className="shrink-0 whitespace-nowrap rounded-md border border-line px-3 py-2 text-sm"
            onClick={() => void copyPrompt()}
            type="button"
          >
            {copied ? "已复制" : "复制提示词"}
          </button>
        </div>
        <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-paper p-3 text-xs leading-5 text-slate-700">
          {PRODUCT_RESEARCH_PROMPT}
        </pre>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <label className="block">
          <span className="font-semibold">粘贴文档</span>
          <span className="mt-1 block text-sm text-slate-600">粘贴 Markdown 文档；上传成功后的文字也会进入这里。</span>
          <textarea
            ref={textareaRef}
            className="mt-3 min-h-80 w-full rounded-md border border-line px-3 py-2 text-sm leading-6"
            onChange={(event) => {
              const value = event.target.value;
              setRawText(value);
              rawTextRef.current = value;
              setFileName("");
              if (error) setError("");
            }}
            placeholder="在这里粘贴调研文档..."
            value={rawText}
          />
        </label>
        {fileName ? <p className="mt-2 text-xs text-slate-500">已读取：{fileName}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-xs text-slate-500">
            「直接保存」保留原始文档，后续可关联产品；「解析文档」尝试提取结构化字段。
          </span>
          <button
            className="whitespace-nowrap rounded-md bg-action px-4 py-2 text-sm font-medium text-white"
            onClick={saveAsResearchReport}
            type="button"
          >
            直接保存到调研库
          </button>
          <button
            className="whitespace-nowrap rounded-md border border-action px-4 py-2 text-sm font-medium text-action"
            onClick={parseDocument}
            type="button"
          >
            尝试结构化解析
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">上传文档</h2>
        <p className="mt-1 text-sm text-slate-600">支持 Markdown、TXT 和 Word 文档，单个文件不超过 10MB。</p>
        <input
          accept=".md,.txt,.docx"
          className="mt-3 block max-w-full text-sm"
          disabled={isUploading}
          onChange={(event) => {
            void importFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
          type="file"
        />
        {isUploading ? <p className="mt-2 text-sm text-slate-600">正在读取文档...</p> : null}
      </section>
    </div>
  );
}
