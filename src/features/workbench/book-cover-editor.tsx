"use client";

import { useId, useState, type ChangeEvent } from "react";
import { compressKnowledgeCover } from "@/features/workbench/knowledge-cover";

type BookCoverEditorProps = {
  title: string;
  value?: string;
  onChange: (value: string | undefined) => void;
};

export function BookCoverEditor({ title, value, onChange }: BookCoverEditorProps) {
  const inputId = useId();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  async function selectCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessing(true);
    setError("");
    try {
      onChange(await compressKnowledgeCover(file));
    } catch (coverError) {
      setError(coverError instanceof Error ? coverError.message : "封面处理失败，请更换图片后重试。");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <BookCover title={title} value={value} className="w-32" />
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-700" htmlFor={inputId}>
          {processing ? "正在处理..." : value ? "更换封面" : "选择封面"}
        </label>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={processing}
          id={inputId}
          onChange={selectCover}
          type="file"
        />
        {value ? (
          <button className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700" onClick={() => onChange(undefined)} type="button">
            删除封面
          </button>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">支持 JPG、PNG、WebP，系统会自动压缩。</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function BookCover({ title, value, className = "w-24" }: { title: string; value?: string; className?: string }) {
  return (
    <div className={`aspect-[2/3] shrink-0 overflow-hidden rounded-md border border-line bg-slate-100 ${className}`}>
      {value ? (
        <img alt={`《${title}》封面`} className="h-full w-full object-contain" src={value} />
      ) : (
        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-slate-400">暂无封面</div>
      )}
    </div>
  );
}
