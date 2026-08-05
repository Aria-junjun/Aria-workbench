"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
  title?: string;
}

export function MarkdownViewer({ content, title }: MarkdownViewerProps) {
  const [viewMode, setViewMode] = useState<"html" | "raw">("html");

  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <h2 className="text-lg font-semibold">{title || "调研内容"}</h2>
        <div className="flex rounded-md border border-line overflow-hidden">
          <button
            className={`px-3 py-1 text-sm transition-colors ${
              viewMode === "html"
                ? "bg-action text-white"
                : "bg-white text-slate-600 hover:bg-paper"
            }`}
            type="button"
            onClick={() => setViewMode("html")}
          >
            HTML 预览
          </button>
          <button
            className={`px-3 py-1 text-sm transition-colors ${
              viewMode === "raw"
                ? "bg-action text-white"
                : "bg-white text-slate-600 hover:bg-paper"
            }`}
            type="button"
            onClick={() => setViewMode("raw")}
          >
            原始 Markdown
          </button>
        </div>
      </div>

      {viewMode === "html" ? (
        <div className="markdown-body mt-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-line">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-base font-medium mt-4 mb-2">{children}</h4>
              ),
              p: ({ children }) => (
                <p className="my-3 leading-relaxed text-slate-700">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside my-3 space-y-1 text-slate-700">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside my-3 space-y-1 text-slate-700">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="pl-1">{children}</li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-action bg-paper pl-4 py-2 my-4 text-slate-600 italic">
                  {children}
                </blockquote>
              ),
              code: ({ className, children, ...props }) => {
                const isInline = !className;
                if (isInline) {
                  return (
                    <code className="bg-paper px-1.5 py-0.5 rounded text-sm text-danger" {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 my-4 overflow-x-auto text-sm">
                  {children}
                </pre>
              ),
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto">
                  <table className="min-w-full border border-line-collapse">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-paper">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="border border-line px-3 py-2 text-left font-semibold text-sm">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-line px-3 py-2 text-sm text-slate-700">
                  {children}
                </td>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-paper/50">{children}</tr>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-action hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              img: ({ src, alt }) => (
                <img
                  src={src}
                  alt={alt}
                  className="max-w-full h-auto my-4 rounded-lg"
                />
              ),
              hr: () => <hr className="my-6 border-line" />,
              strong: ({ children }) => (
                <strong className="font-semibold text-slate-900">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-slate-700">{children}</em>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-paper p-3 text-xs leading-6 text-slate-700">
          {content || "（无内容）"}
        </pre>
      )}
    </section>
  );
}
