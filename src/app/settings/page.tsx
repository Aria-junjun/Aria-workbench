"use client";

import { useRef, useState, useEffect } from "react";
import { exportLocalWorkbenchData, importLocalWorkbenchData } from "@/features/workbench/local-store";
import { exportProductImportDrafts } from "@/features/workbench/product-import-store";
import { presetThemes, applyTheme, saveTheme, type ThemeConfig } from "@/lib/theme";
import { Palette, Check, Upload, User, Trash2, Loader2 } from "lucide-react";
import Image from "next/image";

const DEFAULT_AVATAR = "/images/avatar.jpg";

export default function SettingsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [exportingProgram, setExportingProgram] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(presetThemes[0]);

  // Avatar state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>(DEFAULT_AVATAR);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [avatarError, setAvatarError] = useState("");

  useEffect(() => {
    fetch("/api/avatar")
      .then((r) => r.json())
      .then((data: { url: string | null }) => {
        if (data.url) setAvatarUrl(data.url);
      })
      .catch(() => setAvatarUrl(DEFAULT_AVATAR));
  }, []);

  function broadcastAvatar(url: string | null) {
    const evt = new CustomEvent("workbench:avatar-updated", { detail: url });
    window.dispatchEvent(evt);
  }

  async function handleAvatarSelect(file?: File) {
    if (!file) return;
    // Local preview
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    setAvatarUploading(true);
    setAvatarError("");
    setAvatarMessage("");
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const resp = await fetch("/api/avatar", { method: "POST", body: formData });
      const data = await resp.json();
      if (!resp.ok || data.error) throw new Error(data.error || "上传失败");
      setAvatarUrl(data.url);
      setAvatarPreview(null);
      broadcastAvatar(data.url);
      setAvatarMessage("头像已更新，侧边栏已同步刷新。");
      setTimeout(() => setAvatarMessage(""), 3500);
    } catch (caught) {
      setAvatarPreview(null);
      setAvatarError(caught instanceof Error ? caught.message : "头像上传失败。");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleAvatarReset() {
    const confirmed = window.confirm("确定要恢复为默认头像吗？");
    if (!confirmed) return;
    setAvatarError("");
    setAvatarMessage("");
    try {
      await fetch("/api/avatar", { method: "DELETE" });
      setAvatarUrl(DEFAULT_AVATAR);
      setAvatarPreview(null);
      broadcastAvatar(null);
      setAvatarMessage("已恢复为默认头像。");
      setTimeout(() => setAvatarMessage(""), 3000);
    } catch {
      setAvatarError("恢复默认头像失败。");
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("workbench-theme");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ThemeConfig;
          const preset = presetThemes.find((t) => t.id === parsed.id);
          setCurrentTheme(preset || parsed);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  function handleThemeChange(theme: ThemeConfig) {
    setCurrentTheme(theme);
    applyTheme(theme);
    saveTheme(theme);
    setMessage(`主题已切换为「${theme.name}」`);
    setTimeout(() => setMessage(""), 2000);
  }

  function exportBackup() {
    const backup = exportLocalWorkbenchData();
    const blob = new Blob([backup], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `个人商业工作台备份-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setError("");
    setMessage("全部业务数据备份已生成。");
  }

  async function exportProgramBackup() {
    setExportingProgram(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/backup/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessData: exportLocalWorkbenchData(),
          productDrafts: exportProductImportDrafts()
        })
      });
      if (!response.ok) throw new Error("完整程序备份生成失败。");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `个人商业工作台完整备份-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("完整程序备份已生成，包含当前页面代码和业务数据。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "完整程序备份生成失败。");
    } finally {
      setExportingProgram(false);
    }
  }

  async function importBackup(file?: File) {
    if (!file) return;
    const confirmed = window.confirm("导入会覆盖当前浏览器里的工作台数据。确认继续吗？");
    if (!confirmed) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    try {
      const text = await file.text();
      importLocalWorkbenchData(text);
      setError("");
      setMessage("备份已恢复。刷新或切换页面后可查看最新数据。");
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "导入失败，请检查备份文件。");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>设置</h1>
        <p className="mt-1 text-sm text-muted">可以分别备份业务数据，或导出包含全部页面代码和数据的完整程序。</p>
      </div>

      {/* 个人头像 */}
      <section className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2.5">
          <User className="h-5 w-5 text-action" />
          <h2 className="font-semibold">个人头像</h2>
        </div>
        <p className="mt-1 text-sm text-muted">上传你的自定义头像，侧边栏与登录页会同步显示。</p>

        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          {/* Avatar preview */}
          <div className="relative shrink-0">
            <div className="h-28 w-28 overflow-hidden rounded-3xl border border-line shadow-card bg-paper-warm">
              <Image
                alt="头像预览"
                className="h-full w-full object-cover"
                height={112}
                src={avatarPreview || avatarUrl}
                width={112}
                unoptimized
                onError={(e) => {
                  const target = e.currentTarget;
                  target.src = DEFAULT_AVATAR;
                }}
              />
            </div>
            {avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/40 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div>
              <p className="text-sm font-medium text-ink">当前头像</p>
              <p className="mt-0.5 text-xs text-muted">支持 JPG / PNG / WebP / GIF / HEIC（iPhone 原片），大小不超过 5MB。</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-action px-4 py-2.5 text-sm font-medium text-white transition-all hover:shadow-glow disabled:opacity-60 disabled:cursor-wait"
                style={{ borderRadius: "var(--radius-button)" }}
              >
                <Upload className="h-4 w-4" />
                {avatarUploading ? "上传中..." : "上传新头像"}
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/bmp,image/jpg"
                  className="hidden"
                  disabled={avatarUploading}
                  onChange={(e) => handleAvatarSelect(e.target.files?.[0])}
                  ref={avatarInputRef}
                  type="file"
                />
              </label>
              <button
                type="button"
                onClick={handleAvatarReset}
                disabled={avatarUploading}
                className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-muted transition-all hover:bg-paper-warm hover:text-danger disabled:opacity-60 disabled:cursor-wait"
                style={{ borderRadius: "var(--radius-button)" }}
              >
                <Trash2 className="h-4 w-4" />
                恢复默认
              </button>
            </div>
            {avatarMessage ? (
              <div className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>
                {avatarMessage}
              </div>
            ) : null}
            {avatarError ? (
              <div className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}>
                {avatarError}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* 主题外观 */}
      <section className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2.5">
          <Palette className="h-5 w-5 text-action" />
          <h2 className="font-semibold">外观主题</h2>
        </div>
        <p className="mt-1 text-sm text-muted">点击即可切换整体配色风格，无需修改代码。</p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {presetThemes.map((theme) => {
            const isActive = currentTheme.id === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleThemeChange(theme)}
                className={`
                  relative flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all duration-300
                  ${isActive
                    ? "border-action shadow-glow bg-action-soft/30"
                    : "border-line bg-surface hover:border-muted-light hover:shadow-card"
                  }
                `}
              >
                {isActive && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-action text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}

                {/* 色板预览 */}
                <div className="flex gap-2">
                  <div
                    className="h-8 w-8 rounded-full border border-line/50"
                    style={{ background: theme.colors.primary }}
                    title="主色"
                  />
                  <div
                    className="h-8 w-8 rounded-full border border-line/50"
                    style={{ background: theme.colors.paper }}
                    title="背景"
                  />
                  <div
                    className="h-8 w-8 rounded-full border border-line/50"
                    style={{ background: theme.colors.surface }}
                    title="卡片"
                  />
                  <div
                    className="h-8 w-8 rounded-full border border-line/50"
                    style={{ background: theme.colors.success }}
                    title="成功"
                  />
                </div>

                <div>
                  <p className="font-medium text-ink">{theme.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    圆角 {theme.radius.card} · {theme.fonts.display.split(",")[0].replace(/"/g, "")}
                  </p>
                </div>

                {/* 迷你卡片预览 */}
                <div
                  className="mt-1 rounded-xl border p-2.5"
                  style={{
                    background: theme.colors.paper,
                    borderColor: theme.colors.line,
                    borderRadius: theme.radius.card
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-md"
                      style={{ background: theme.colors.primary }}
                    />
                    <div className="flex-1 space-y-1.5">
                      <div
                        className="h-2 w-3/4 rounded"
                        style={{ background: theme.colors.ink, opacity: 0.15 }}
                      />
                      <div
                        className="h-2 w-1/2 rounded"
                        style={{ background: theme.colors.muted, opacity: 0.2 }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 工作台备份 */}
      <section className="rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-semibold">工作台备份</h2>
        <p className="mt-1 text-sm text-muted">日常使用业务数据备份；阶段性更新后再导出完整程序备份。</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-action px-4 py-2.5 text-sm font-medium text-white transition-all hover:shadow-glow"
            style={{ borderRadius: "var(--radius-button)" }}
            onClick={exportBackup}
            type="button"
          >
            导出全部业务数据
          </button>
          <button
            className="rounded-xl border border-action px-4 py-2.5 text-sm font-medium text-action transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-action-soft/20"
            style={{ borderRadius: "var(--radius-button)" }}
            disabled={exportingProgram}
            onClick={exportProgramBackup}
            type="button"
          >
            {exportingProgram ? "正在生成..." : "导出完整程序备份"}
          </button>
          <label
            className="cursor-pointer rounded-xl border border-line px-4 py-2.5 text-sm transition-all hover:bg-paper-warm"
            style={{ borderRadius: "var(--radius-button)" }}
          >
            导入业务数据
            <input
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => importBackup(event.target.files?.[0])}
              ref={inputRef}
              type="file"
            />
          </label>
        </div>
        {message ? (
          <div className="mt-4 rounded-xl px-3 py-2 text-sm" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl px-3 py-2 text-sm" style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}>
            {error}
          </div>
        ) : null}
      </section>
    </div>
  );
}
