"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, Flower2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        setError(response.status === 503 ? "登录服务尚未配置，请联系管理员。" : "密码不正确，请重试。");
        setLoading(false);
        return;
      }
      const from = searchParams.get("from") || "/";
      router.push(from);
    } catch {
      setError("网络异常，请稍后重试。");
      setLoading(false);
    }
  }

  return (
    <form className="rounded-3xl border border-line bg-surface/80 p-8 shadow-card backdrop-blur-md" onSubmit={handleSubmit}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-ink">欢迎回来</h2>
        <p className="mt-1 text-sm text-muted">输入密码开启今天的商业推进</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">访问密码</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-light" />
            <input
              className="w-full rounded-xl border border-line bg-paper/60 pl-10 pr-10 py-3 text-sm outline-none transition-all focus:border-action focus:ring-2 focus:ring-action/20"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="请输入访问密码"
              autoFocus
            />
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-light hover:text-muted p-1"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft/40 px-3 py-2.5 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          className="w-full rounded-xl bg-gradient-to-r from-action to-action-strong py-3 text-sm font-semibold text-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          {loading ? "登录中..." : "进入工作台"}
        </button>
      </div>

      <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted">
        <Lock className="h-3 w-3" />
        <span>忘记密码？请联系管理员</span>
      </div>
    </form>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/config/status", { cache: "no-store" })
      .then((response) => {
        if (response.ok) router.replace("/");
        else setChecking(false);
      })
      .catch(() => {
        setChecking(false);
      });
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-action border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper p-4">
      {/* 背景装饰 */}
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-action/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-warning/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-success/5 blur-3xl pointer-events-none" />

      {/* 细小装饰点 */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden>
        <div className="absolute top-20 left-[15%] h-2 w-2 rounded-full bg-action/40 animate-pulse-soft" />
        <div className="absolute top-1/3 right-[12%] h-1.5 w-1.5 rounded-full bg-warning/50 animate-pulse-soft" />
        <div className="absolute bottom-1/4 left-[20%] h-1.5 w-1.5 rounded-full bg-success/50 animate-pulse-soft" />
        <div className="absolute bottom-20 right-[18%] h-2 w-2 rounded-full bg-action/30 animate-pulse-soft" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-action to-action-strong blur-lg opacity-40" />
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-action to-action-strong text-white shadow-glow">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold text-ink bg-gradient-to-r from-ink to-action bg-clip-text text-transparent">
            个人工作台
          </h1>
          <p className="mt-2 text-sm text-muted">商业 · 供应链 · 知识沉淀</p>
        </div>

        <Suspense fallback={
          <div className="rounded-3xl border border-line bg-surface/80 p-8 shadow-card">
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-action border-t-transparent" />
            </div>
          </div>
        }>
          <LoginForm />
        </Suspense>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-light">
          <Flower2 className="h-3 w-3 text-action/60" />
          <span>用心经营，温暖前行</span>
          <Flower2 className="h-3 w-3 text-warning/60" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-action border-t-transparent" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
