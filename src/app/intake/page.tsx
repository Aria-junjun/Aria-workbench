"use client";
/* trigger recompile */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronRight,
  ClipboardList,
  FileUp,
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  Sparkles,
  Upload,
  X,
  Zap
} from "lucide-react";

type IntakeImage = {
  dataUrl: string;
  mimeType: string;
  name: string;
};

export default function IntakePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [mode, setMode] = useState<"screenshot" | "chat" | "summary">("summary");
  const [rawText, setRawText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [images, setImages] = useState<IntakeImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingFile, setIsImportingFile] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/config/status")
      .then((response) => response.json())
      .then((data: { aiExtractionEnabled: boolean }) => setAiEnabled(data.aiExtractionEnabled))
      .catch(() => setAiEnabled(false));
  }, []);

  async function addFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setError("当前 MVP 先支持图片文件，请选择 PNG、JPG、JPEG 或 WebP。");
      return;
    }

    const loaded = await Promise.all(
      imageFiles.map(
        (file) =>
          new Promise<IntakeImage>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                dataUrl: String(reader.result),
                mimeType: file.type,
                name: file.name
              });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    );

    setError("");
    setImages((current) => [...current, ...loaded]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    // 从 Excel 复制时，剪贴板会同时包含文本和图片
    // 优先使用文本（制表符分隔的表格数据），只有纯图片时才作为图片处理
    const textData = event.clipboardData.getData("text/plain");
    if (textData && textData.trim().length > 0) {
      // 有文本内容，让浏览器正常粘贴文本，不拦截
      return;
    }
    // 没有文本，检查是否是图片
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) {
      event.preventDefault();
      await addFiles(files);
    }
  }

  function removeImage(indexToRemove: number) {
    setImages((current) => current.filter((_, index) => index !== indexToRemove));
  }

  async function importWorkbenchFile(file?: File) {
    if (!file) return;
    setIsImportingFile(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/intake/file", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || "文件导入失败，请确认文件格式是 xlsx、csv 或 txt。");
        return;
      }

      const data = (await response.json()) as { draftId: string; extraction: unknown };
      sessionStorage.setItem(`draft:${data.draftId}`, JSON.stringify(data.extraction));
      router.push(`/review/${data.draftId}`);
    } catch {
      setError("无法连接到本地整理服务，请重新打开工作台后再试。");
    } finally {
      setIsImportingFile(false);
    }
  }

  async function submit() {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          rawText,
          sourceUrl: sourceUrl.trim() || undefined,
          images: images.map(({ dataUrl, mimeType }) => ({ dataUrl, mimeType }))
        })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || "整理失败，请检查输入内容。");
        return;
      }

      const data = (await response.json()) as { draftId: string; extraction: unknown };
      sessionStorage.setItem(`draft:${data.draftId}`, JSON.stringify(data.extraction));
      router.push(`/review/${data.draftId}`);
    } catch {
      setError("无法连接到本地整理服务，请重新打开工作台后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = rawText.trim().length > 0 || images.length > 0;

  async function copyChatGptPrompt() {
    const prompt = `请先判断材料类型，再按对应格式整理。只提取事实和我明确表达的判断，不要替我做最终采购决策。

输出要求：
1. 只输出有实际信息的字段，空字段不要输出。
2. 不要为了填满格式而写"未知、未确认、未记录"。
3. 【不确定项】只列出会影响报价判断、采购决策、后续追问的关键信息。
4. 报价类信息必须保留原始结构，包括规格、克重、材质等级、卷长、宽度、MOQ、是否含运费、调价规则。
5. 如果同一产品有多个规格/克重/材质报价，必须放入【报价明细】，不要只写一个总报价。
6. 不同产品单位不同，不要强行套固定字段。优先识别产品自己的规格体系，例如长宽高、直径、厚度、克重、容量、重量、卷长、宽幅、颜色、材质、包装单位、计价单位。
7. 常规实物产品优先提取长宽高和单位；卷材/膜类产品提取宽幅、卷长、克重、材质等级；盒/袋/包装类产品提取尺寸、材质、厚度/克重、工艺、印刷、装箱数。
8. 不要只提取最低价或单一价格。数量阶梯、品质阶梯、规格/SKU阶梯报价都必须保留。
9. 如果有宽度、长度、重量、面积、容量等可计算信息，请给出【统一比价口径】和【折算单价】。优先按元/㎡折算；不适合按面积时按元/米、元/kg、元/斤或产品自身最合理单位折算；无法统一时说明原因并保留原报价。

如果是供应商沟通、货盘、1688、产品调研内容，请按以下模块输出：

【供应商】
供应商名称：
主营产品：
地区：
店铺链接：
来源平台：
联系方式：
工厂/贸易商/未知：
联系人/联系方式：
配合度：
风险标签：
备注：

【沟通记录】
沟通摘要：
报价变化：
供应商承诺：
疑点：
风险点：
下一步动作：

【货盘】
货盘名称：
产品品类：
商品链接：
资料链接：
报价：
报价明细：
统一比价口径：
折算单价：
尺寸：
计价单位：
包装单位：
关键规格：
材质等级：
宽度：
卷长：
克重选项：
单卷重量：
是否含运费：
调价规则：
MOQ：
交期：
规格参数：
包装信息：
样品情况：
适合渠道：
优势说明：
风险或疑点：
备注：

【待办】
待办事项：
截止时间：
优先级：低/中/高
类型：确认报价/跟进样品/确认MOQ/确认交期/补充产品知识/复盘供应商/再次沟通

【不确定项】
只列关键问题。

如果是读书笔记、课程内容、商业方法、谈判方法、商业模式，请按以下模块输出：

【知识卡】
知识名称：
来源：
核心观点：
适用场景：
操作步骤：
参考话术：
风险提醒：
关联标签：

【不确定项】
只列关键问题。`;

    await navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 2000);
  }

  const modeOptions = [
    { value: "summary" as const, label: "口述总结", desc: "自己总结的沟通要点", icon: <MessageSquare className="h-4 w-4" /> },
    { value: "chat" as const, label: "聊天记录", desc: "粘贴原始聊天对话", icon: <ClipboardList className="h-4 w-4" /> },
    { value: "screenshot" as const, label: "截图内容", desc: "上传或粘贴截图", icon: <ImagePlus className="h-4 w-4" /> }
  ];

  return (
    <div className="max-w-3xl space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-action-soft border border-action/15">
          <Zap className="h-5 w-5 text-action" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">快速录入</h1>
          <p className="text-sm text-muted">粘贴沟通内容、上传截图或导入文件，一键生成结构化草稿</p>
        </div>
      </div>

      {/* AI 状态提示 */}
      <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${
        aiEnabled === true
          ? "border-success/20 bg-success-soft/40"
          : aiEnabled === false
            ? "border-warning/20 bg-warning-soft/40"
            : "border-line bg-paper-warm"
      }`}>
        <Sparkles className={`h-4 w-4 shrink-0 ${aiEnabled === true ? "text-success" : aiEnabled === false ? "text-warning" : "text-muted"}`} />
        <span className="text-sm">
          {aiEnabled === true
            ? "AI 识图整理已开启：上传或粘贴截图后，系统会自动提取供应商、货盘和待办信息。"
            : aiEnabled === false
              ? "当前是本地兜底模式：可以上传和归档图片，但不会识别图片内容。配置 OpenAI Key 后会开启 AI 识图。"
              : "正在检测 AI 服务状态..."}
        </span>
      </div>

      {/* 三种录入方式卡片 */}
      <section className="rounded-3xl border border-line bg-surface shadow-card p-5">
        <h2 className="mb-4 text-sm font-semibold">录入方式</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {modeOptions.map((opt) => (
            <button
              className={`rounded-2xl border p-4 text-left transition-all ${
                mode === opt.value
                  ? "border-action bg-action-soft/40 shadow-card"
                  : "border-line bg-white hover:border-action/40 hover:shadow-card"
              }`}
              key={opt.value}
              onClick={() => setMode(opt.value)}
              type="button"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl mb-3 ${
                mode === opt.value ? "bg-action text-white" : "bg-paper-warm text-muted"
              }`}>
                {opt.icon}
              </div>
              <div className={`text-sm font-medium ${mode === opt.value ? "text-action" : "text-ink"}`}>
                {opt.label}
              </div>
              <p className="mt-1 text-xs text-muted">{opt.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 主输入区 */}
      <section className="rounded-3xl border border-line bg-surface shadow-card overflow-hidden">
        <div className="border-b border-line bg-paper-warm px-5 py-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-action" />
          <h2 className="font-semibold text-sm">沟通内容</h2>
          <span className="text-xs text-muted ml-auto">可以直接粘贴截图到输入框</span>
        </div>
        <div className="p-5 space-y-4">
          {/* 链接输入 */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted mb-2">
              <LinkIcon className="h-3.5 w-3.5" />
              1688 或资料链接（可选）
            </label>
            <input
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm placeholder:text-muted-light focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30"
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://detail.1688.com/..."
              value={sourceUrl}
            />
          </div>

          {/* 文本输入 */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              {mode === "summary" ? "沟通要点" : mode === "chat" ? "聊天记录" : "截图说明"}
            </label>
            <textarea
              className="min-h-48 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm placeholder:text-muted-light focus:border-action focus:outline-none focus:ring-1 focus:ring-action/30 resize-y"
              onChange={(event) => setRawText(event.target.value)}
              onPaste={handlePaste}
              placeholder={
                mode === "summary"
                  ? "例如：供应商义乌某包装厂，报价 12.5 元，MOQ 1000，交期 7 天，包装方式还没确认，明天需要再问。"
                  : mode === "chat"
                    ? "粘贴你和供应商的聊天对话..."
                    : "描述截图中的关键信息..."
              }
              value={rawText}
            />
          </div>

          {/* 图片上传区 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <ImagePlus className="h-3.5 w-3.5" />
                图片或截图
              </label>
              <button
                className="flex items-center gap-1 text-xs text-action hover:underline"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Upload className="h-3 w-3" />
                选择图片
              </button>
              <input
                className="hidden"
                multiple
                onChange={(event) => {
                  if (event.target.files) void addFiles(event.target.files);
                }}
                ref={fileInputRef}
                type="file"
              />
            </div>

            {/* 图片预览区 */}
            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((image, index) => (
                  <div className="relative group rounded-xl border border-line overflow-hidden bg-paper-warm" key={`${image.name}-${index}`}>
                    <img alt={image.name} className="w-full h-24 object-cover" src={image.dataUrl} />
                    <button
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-danger shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger hover:text-white"
                      onClick={() => removeImage(index)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="truncate px-2 py-1 text-[10px] text-muted">{image.name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <button
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-paper-warm/50 py-8 text-muted hover:border-action/40 hover:text-action transition-colors"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-paper-warm border border-line">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-sm">点击上传或直接粘贴截图</span>
                <span className="text-xs text-muted-light">支持 PNG、JPG、JPEG、WebP</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 辅助工具 */}
      <section className="rounded-3xl border border-line bg-surface shadow-card overflow-hidden">
        <div className="border-b border-line bg-paper-warm px-5 py-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-warning" />
          <h2 className="font-semibold text-sm">辅助工具</h2>
        </div>
        <div className="p-5 space-y-4">
          {/* ChatGPT 提示词 */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ClipboardList className="h-4 w-4 text-action" />
                  ChatGPT 整理提示词
                </div>
                <p className="mt-1 text-xs text-muted">复制到 ChatGPT Plus，让它帮你整理截图或聊天记录，再把结果粘贴回上方。</p>
              </div>
              <button
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  promptCopied
                    ? "bg-success text-white"
                    : "bg-action text-white hover:shadow-card-hover"
                }`}
                onClick={copyChatGptPrompt}
                type="button"
              >
                {promptCopied ? "已复制" : "复制提示词"}
              </button>
            </div>
          </div>

          {/* 文件导入 */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileUp className="h-4 w-4 text-success" />
                  直接导入文件
                </div>
                <p className="mt-1 text-xs text-muted">适合已经整理好的 Excel、CSV 或 TXT 报价单，不需要再复制到 ChatGPT。</p>
              </div>
              <label className="shrink-0 cursor-pointer rounded-xl bg-success px-4 py-2 text-sm font-medium text-white hover:shadow-card-hover transition-colors">
                {isImportingFile ? "导入中..." : "选择文件"}
                <input
                  accept=".xlsx,.xls,.csv,.txt,.tsv,.md"
                  className="hidden"
                  disabled={isImportingFile}
                  onChange={(event) => {
                    void importWorkbenchFile(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                  type="file"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* 错误提示 */}
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-danger/20 bg-danger-soft/40 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* 提交按钮 */}
      <div className="flex items-center justify-between pb-6">
        <Link className="text-sm text-muted hover:text-action" href="/">
          返回工作台
        </Link>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-action px-6 py-3 text-sm font-medium text-white shadow-card hover:-translate-y-0.5 hover:shadow-card-hover transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-card"
          disabled={isSubmitting || !canSubmit}
          onClick={submit}
          type="button"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              整理中...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              生成整理草稿
            </>
          )}
        </button>
      </div>
    </div>
  );
}
