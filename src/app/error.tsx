"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-danger-soft flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-danger" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-ink">出错了</h1>
          <p className="text-sm text-muted leading-relaxed">
            应用遇到了意外错误，请尝试刷新页面或返回首页。
          </p>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="rounded-xl bg-surface border border-line p-4 text-left">
            <p className="text-xs font-mono text-danger mb-1">Error:</p>
            <p className="text-xs font-mono text-muted break-all">{error.message}</p>
            {error.digest && (
              <p className="text-xs font-mono text-muted-light mt-2">Digest: {error.digest}</p>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-action px-5 py-2.5 text-sm font-semibold text-white shadow-subtle hover:shadow-card transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            重试
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-medium text-muted hover:border-action hover:text-action transition-colors"
          >
            <Home className="h-4 w-4" />
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
