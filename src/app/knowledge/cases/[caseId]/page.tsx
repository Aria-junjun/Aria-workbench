"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { normalizeDecisionAnalysis } from "@/features/workbench/decision-analysis";
import { latestDecisionCycle, type DecisionCase, type DecisionCycle, type ToolContribution } from "@/features/workbench/decision-cases";
import {
  addDecisionCycle,
  loadDecisionCases,
  updateDecisionCycleVersion
} from "@/features/workbench/local-store";
import {
  ArrowDown,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Equal,
  Lightbulb,
  ListChecks,
  MessageSquare,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  UserCircle2
} from "lucide-react";

/* ---------- 文本相似度工具 ---------- */

function normalizeForCompare(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s，。！？、；：,.!?;:'""''（）()【】\[\]]+/g, "");
}

function textSimilarity(a: string, b: string): number {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  if (na.includes(nb) || nb.includes(na)) return 0.92;
  let common = 0;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) common++;
  }
  return common / longer.length;
}

function isEssentiallySame(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return textSimilarity(a, b) > 0.88;
}

function isEssentiallySameToAny(text: string, candidates: (string | undefined)[]): boolean {
  return candidates.some((c) => c && isEssentiallySame(text, c));
}

/* ---------- 折叠提示组件 ---------- */

function CollapseHint({
  label,
  onToggle,
  expanded,
  variant = "muted"
}: {
  label: string;
  onToggle: () => void;
  expanded: boolean;
  variant?: "warning" | "success" | "action" | "muted";
}) {
  const styles = {
    warning: "bg-warning-soft/50 text-warning border-warning/20",
    success: "bg-success-soft/50 text-success border-success/20",
    action: "bg-action-soft/50 text-action border-action/20",
    muted: "bg-paper-warm text-muted border-line"
  };
  return (
    <button
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm ${styles[variant]}`}
      onClick={onToggle}
      type="button"
    >
      <span className="flex items-center gap-1.5">
        <Equal className="h-3.5 w-3.5 opacity-70" />
        {label}
      </span>
      <span className="flex items-center gap-1 text-xs opacity-70">
        {expanded ? "收起" : "展开"}
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </span>
    </button>
  );
}

/* ---------- 主页面 ---------- */

export default function DecisionCasePage() {
  const params = useParams();
  const rawCaseId = Array.isArray(params.caseId) ? params.caseId[0] : params.caseId;
  const caseId = decodeURIComponent(rawCaseId ?? "");
  const [caseItem, setCaseItem] = useState<DecisionCase>();
  const [cycle, setCycle] = useState<DecisionCycle>();
  const [message, setMessage] = useState("");
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [newCycleTitle, setNewCycleTitle] = useState("");
  const [newInformation, setNewInformation] = useState("");
  const [showRawInput, setShowRawInput] = useState(false);

  /* 折叠状态 */
  const [showRawInTimeline, setShowRawInTimeline] = useState(false);
  const [expandInitial, setExpandInitial] = useState(false);
  const [expandToolMap, setExpandToolMap] = useState<Record<string, boolean>>({});
  const [expandConclusion, setExpandConclusion] = useState(false);

  useEffect(() => reload(), [caseId]);

  function reload(preferredCycleId?: string) {
    const found = loadDecisionCases().find((item) => item.id === caseId);
    setCaseItem(found);
    setCycle(found?.cycles.find((item) => item.id === preferredCycleId) ?? (found ? latestDecisionCycle(found) : undefined));
  }

  /* 关键发现：去重后的工具判断 */
  const keyFindings = useMemo(() => {
    if (!cycle) return [];
    const seen = new Set<string>();
    const result: { text: string; sources: string[]; books: string[] }[] = [];
    for (const tool of cycle.toolContributions) {
      const text = tool.judgement.trim();
      if (!text) continue;
      const normalized = normalizeForCompare(text);
      let merged = false;
      for (const item of result) {
        if (isEssentiallySame(text, item.text)) {
          if (!item.sources.includes(tool.toolName)) item.sources.push(tool.toolName);
          if (tool.sourceBook && !item.books.includes(tool.sourceBook)) item.books.push(tool.sourceBook);
          merged = true;
          break;
        }
      }
      if (!merged) {
        result.push({ text, sources: [tool.toolName], books: tool.sourceBook ? [tool.sourceBook] : [] });
      }
    }
    return result;
  }, [cycle]);

  /* 推理链中各步骤的重复关系 */
  const rawInputText = cycle?.rawInput || caseItem?.title || "";
  const initialText = cycle?.initialJudgement || "";
  const conclusionText = cycle?.conclusion || "";
  const initialSameAsRaw = isEssentiallySame(initialText, rawInputText);
  const conclusionSameAsInitial = isEssentiallySame(conclusionText, initialText);
  const conclusionSameAsTools = cycle
    ? isEssentiallySameToAny(
        conclusionText,
        cycle.toolContributions.map((t) => t.judgement)
      )
    : false;

  function toggleTool(toolId: string) {
    setExpandToolMap((prev) => ({ ...prev, [toolId]: !prev[toolId] }));
  }

  if (!caseItem || !cycle) {
    return <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-600">没有找到这个问题档案。</div>;
  }

  function saveCycle() {
    if (!caseItem || !cycle) return;
    const saved = updateDecisionCycleVersion(caseItem.id, cycle.id, {
      initialJudgement: cycle.initialJudgement,
      conclusion: cycle.conclusion,
      nextActions: cycle.nextActions,
      outcome: cycle.outcome,
      review: cycle.review,
      status: cycle.status,
      modelId: cycle.modelId,
      modelSections: cycle.modelSections
    });
    reload(saved.id);
    setMessage(`已保存版本 ${saved.version}`);
  }

  async function useBusinessCanvas() {
    if (!caseItem || !cycle) return;
    setCanvasLoading(true);
    setMessage("");
    try {
      const previous = [...caseItem.cycles]
        .filter((item) => item.cycleNumber < cycle.cycleNumber)
        .sort((a, b) => b.cycleNumber - a.cycleNumber)[0];
      const response = await fetch("/api/knowledge/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: caseItem.id,
          cycleId: cycle.id,
          rawInput: cycle.rawInput,
          initialJudgement: cycle.initialJudgement,
          toolContributions: cycle.toolContributions,
          currentActions: cycle.nextActions,
          previousCycleSummary: previous?.conclusion
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "画布分析失败。");
      const analysis = normalizeDecisionAnalysis({
        ...payload,
        recommendedModelId: "business-model-canvas"
      });
      setCycle({
        ...cycle,
        modelId: "business-model-canvas",
        modelSections: analysis.modelSections,
        conclusion: cycle.conclusion || analysis.summary
      });
      setMessage("画布草稿已生成，请检查后保存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "画布分析失败。");
    } finally {
      setCanvasLoading(false);
    }
  }

  function createNewCycle() {
    if (!caseItem || !newCycleTitle.trim() || !newInformation.trim()) return;
    const created = addDecisionCycle(caseItem.id, {
      title: newCycleTitle,
      rawInput: newInformation,
      newInformation
    });
    setNewCycleOpen(false);
    setNewCycleTitle("");
    setNewInformation("");
    reload(created.id);
  }

  const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    judging: { label: "判断中", bg: "bg-warning-soft", text: "text-warning", border: "border-warning/20" },
    pending_action: { label: "待执行", bg: "bg-action-soft", text: "text-action", border: "border-action/20" },
    validating: { label: "验证中", bg: "bg-success-soft", text: "text-success", border: "border-success/20" },
    completed: { label: "已完成", bg: "bg-sage", text: "text-success", border: "border-success/20" },
    paused: { label: "暂缓", bg: "bg-paper-warm", text: "text-muted", border: "border-line" }
  };

  const cfg = statusConfig[cycle.status] || statusConfig.judging;

  return (
    <div className="space-y-6">
      {/* 顶部导航 */}
      <Link className="inline-flex items-center gap-1 text-sm text-action" href="/knowledge">
        <ChevronRight className="h-4 w-4 rotate-180" />
        返回问题档案
      </Link>

      {/* 问题定义区 — 只显示一次 */}
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Target className="h-3.5 w-3.5" />
          <span>问题定义 · 周期 {cycle.cycleNumber}/{caseItem.cycles.length}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{caseItem.title}</h1>
        {cycle.rawInput && cycle.rawInput !== caseItem.title ? (
          <div className="mt-3">
            <button
              className="flex items-center gap-1 text-xs text-muted hover:text-action"
              onClick={() => setShowRawInput((v) => !v)}
              type="button"
            >
              {showRawInput ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              原始描述
            </button>
            {showRawInput ? (
              <p className="mt-2 rounded-lg bg-paper-warm p-3 text-sm text-slate-600">{cycle.rawInput}</p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            {cfg.label}
          </span>
          <select
            className="rounded-md border border-line bg-white px-2 py-1 text-xs"
            onChange={(event) => setCycle({ ...cycle, status: event.target.value as DecisionCycle["status"] })}
            value={cycle.status}
          >
            <option value="judging">判断中</option>
            <option value="pending_action">待执行</option>
            <option value="validating">验证中</option>
            <option value="completed">已完成</option>
            <option value="paused">暂缓</option>
          </select>
        </div>
      </section>

      {/* 关键发现 — 去重后的核心问题点 */}
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-action" />
          <h2 className="font-semibold">关键发现</h2>
          <span className="text-xs text-muted">各工具分析后提炼的核心问题点（已自动去重）</span>
        </div>
        {keyFindings.length === 0 ? (
          <div className="rounded-xl bg-paper-warm p-4 text-sm text-muted">
            当前周期还没有工具分析结果。使用知识工具后，这里会自动汇总并去重各工具提炼的核心问题点。
          </div>
        ) : (
          <div className="space-y-3">
            {keyFindings.map((finding, index) => (
              <div className="flex gap-3 rounded-xl border border-line bg-white p-4" key={index}>
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-action-soft text-[10px] font-bold text-action">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-slate-700">{finding.text}</p>
                  <p className="mt-1.5 text-xs text-muted">
                    来源：{finding.sources.join("、")}
                    {finding.books.length > 0 ? ` · 《${finding.books.join("》《")}》` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 决策概览卡片 — 结论 + 行动 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-action" />
            当前结论
          </div>
          <textarea
            className="mt-3 min-h-28 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm"
            onChange={(event) => setCycle({ ...cycle, conclusion: event.target.value })}
            placeholder="综合本周期所有分析，形成当前结论..."
            value={cycle.conclusion ?? ""}
          />
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ListChecks className="h-4 w-4 text-success" />
            下一步行动
          </div>
          <textarea
            className="mt-3 min-h-28 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm"
            onChange={(event) => setCycle({
              ...cycle,
              nextActions: event.target.value.split("\n").map((action) => action.trim()).filter(Boolean).map((action) => ({
                action,
                sourceToolIds: cycle.nextActions.find((item) => item.action === action)?.sourceToolIds ?? []
              }))
            })}
            placeholder="每行一项行动"
            value={cycle.nextActions.map((item) => item.action).join("\n")}
          />
        </section>
      </div>

      {/* 分析推理过程 — 去重折叠版 */}
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
        <div className="mb-6 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-action" />
          <h2 className="font-semibold">分析推理过程</h2>
          <span className="text-xs text-muted">重复内容自动折叠，只展示信息增量</span>
        </div>

        <div className="space-y-0">
          {/* Step 1: 输入问题 — 默认折叠 */}
          <div className="relative pl-8 pb-6">
            <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-action text-white">
              <Search className="h-3 w-3" />
            </div>
            <div className="absolute left-[11px] top-7 bottom-0 w-0.5 bg-line" />
            <h3 className="text-sm font-medium">输入问题</h3>
            <div className="mt-2">
              <CollapseHint
                expanded={showRawInTimeline}
                label="问题描述与上方一致"
                onToggle={() => setShowRawInTimeline((v) => !v)}
                variant="muted"
              />
              {showRawInTimeline ? (
                <div className="mt-2 rounded-xl border border-line bg-white p-3 text-sm text-slate-700">
                  {rawInputText}
                </div>
              ) : null}
            </div>
          </div>

          {/* Step 2: 初步判断 — 与问题重复时折叠 */}
          <div className="relative pl-8 pb-6">
            <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-warning text-white">
              <UserCircle2 className="h-3 w-3" />
            </div>
            <div className="absolute left-[11px] top-7 bottom-0 w-0.5 bg-line" />
            <h3 className="text-sm font-medium">我的初步判断</h3>
            <p className="mt-1 text-xs text-muted">在调用任何工具之前，基于个人经验的直觉判断</p>

            {initialSameAsRaw ? (
              <div className="mt-2 space-y-2">
                <CollapseHint
                  expanded={expandInitial}
                  label="初步判断与问题描述基本一致"
                  onToggle={() => setExpandInitial((v) => !v)}
                  variant="warning"
                />
                {expandInitial ? (
                  <textarea
                    className="min-h-20 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm"
                    onChange={(event) => setCycle({ ...cycle, initialJudgement: event.target.value })}
                    placeholder="我的第一直觉是..."
                    value={cycle.initialJudgement ?? ""}
                  />
                ) : null}
              </div>
            ) : (
              <textarea
                className="mt-2 min-h-20 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm"
                onChange={(event) => setCycle({ ...cycle, initialJudgement: event.target.value })}
                placeholder="我的第一直觉是..."
                value={cycle.initialJudgement ?? ""}
              />
            )}
          </div>

          {/* Step 3: 工具分析 — 与前面重复时折叠 */}
          <div className="relative pl-8 pb-6">
            <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-success text-white">
              <Lightbulb className="h-3 w-3" />
            </div>
            <div className="absolute left-[11px] top-7 bottom-0 w-0.5 bg-line" />
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">工具分析</h3>
                <p className="mt-0.5 text-xs text-muted">调用知识工具进行结构化分析</p>
              </div>
              <Link
                className="text-xs text-action hover:underline"
                href={`/knowledge?problem=${encodeURIComponent(caseItem.title)}&caseId=${caseItem.id}&cycleId=${cycle.id}`}
              >
                + 增加分析工具
              </Link>
            </div>

            {cycle.toolContributions.length === 0 ? (
              <div className="rounded-xl bg-paper-warm p-4 text-sm text-muted">
                当前周期还没有使用知识工具进行分析。
              </div>
            ) : (
              <div className="space-y-4">
                {cycle.toolContributions.map((tool, toolIndex) => {
                  const priorJudgements = [
                    cycle.initialJudgement,
                    ...cycle.toolContributions.slice(0, toolIndex).map((t) => t.judgement)
                  ];
                  const judgementSameAsPrior = isEssentiallySameToAny(tool.judgement, priorJudgements);
                  const expanded = expandToolMap[tool.id] || false;

                  return (
                    <div className="overflow-hidden rounded-xl border border-line bg-white" key={tool.id}>
                      {/* 工具头部 */}
                      <div className="flex items-center gap-2 border-b border-line bg-paper-warm px-4 py-2.5">
                        <CircleDot className="h-3.5 w-3.5 text-action" />
                        <span className="text-sm font-medium">{tool.toolName}</span>
                        <span className="text-xs text-muted">· {tool.sourceBook || "知识工具库"}</span>
                      </div>
                      {/* 工具输出 */}
                      <div className="space-y-3 p-4">
                        {/* 微型逻辑链 */}
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <span className="rounded bg-paper-warm px-1.5 py-0.5">输入问题</span>
                          <ArrowDown className="h-3 w-3" />
                          <span className="rounded bg-action-soft px-1.5 py-0.5 text-action">{tool.toolName}</span>
                          <ArrowDown className="h-3 w-3" />
                          <span className="rounded bg-paper-warm px-1.5 py-0.5">输出判断</span>
                        </div>

                        {tool.judgement ? (
                          judgementSameAsPrior ? (
                            <CollapseHint
                              expanded={expanded}
                              label={
                                isEssentiallySame(tool.judgement, cycle.initialJudgement)
                                  ? "判断与初步判断一致"
                                  : "判断与前面工具分析一致"
                              }
                              onToggle={() => toggleTool(tool.id)}
                              variant="muted"
                            />
                          ) : (
                            <div className="rounded-lg border-l-4 border-warning bg-warning-soft/40 p-3">
                              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warning">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                核心判断
                              </div>
                              <p className="text-sm leading-relaxed text-slate-700">{tool.judgement}</p>
                            </div>
                          )
                        ) : null}

                        {/* 折叠状态下也能展开看完整判断 */}
                        {expanded && judgementSameAsPrior ? (
                          <div className="rounded-lg border border-line bg-paper-warm p-3 text-sm text-slate-700">
                            {tool.judgement}
                          </div>
                        ) : null}

                        {tool.actions.length > 0 ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
                              <ListChecks className="h-3.5 w-3.5" />
                              建议行动
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {tool.actions.map((action, actionIndex) => (
                                <span
                                  className="rounded-lg bg-success-soft px-2.5 py-1 text-xs text-success"
                                  key={actionIndex}
                                >
                                  {action}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 4: 综合结论 — 与前面重复时折叠 */}
          <div className="relative pl-8">
            <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-action text-white">
              <Sparkles className="h-3 w-3" />
            </div>
            <h3 className="text-sm font-medium">综合结论</h3>
            <p className="mt-1 text-xs text-muted">基于初步判断和工具分析，综合形成的最终结论</p>

            {conclusionText.trim() ? (
              conclusionSameAsInitial || conclusionSameAsTools ? (
                <div className="mt-2 space-y-2">
                  <CollapseHint
                    expanded={expandConclusion}
                    label={
                      conclusionSameAsInitial
                        ? "综合结论与初步判断一致"
                        : "综合结论与工具分析一致"
                    }
                    onToggle={() => setExpandConclusion((v) => !v)}
                    variant="action"
                  />
                  {expandConclusion ? (
                    <div className="rounded-xl border border-action/20 bg-action-soft/30 p-3 text-sm text-slate-700">
                      {conclusionText}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-action/20 bg-action-soft/30 p-3 text-sm text-slate-700">
                  {conclusionText}
                </div>
              )
            ) : (
              <div className="mt-2 rounded-xl border border-line bg-white p-3 text-sm text-muted">
                尚未形成综合结论，请在上方「当前结论」中填写。
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 综合分析（商业模式画布） */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">综合分析</h2>
            <p className="mt-1 text-xs text-muted">商业模式画布只综合当前周期，不自动继承旧周期结论。</p>
          </div>
          <button
            className="rounded-md border border-action px-3 py-2 text-sm text-action disabled:opacity-50"
            disabled={canvasLoading}
            onClick={useBusinessCanvas}
            type="button"
          >
            {canvasLoading ? "生成中..." : "使用商业模式画布"}
          </button>
        </div>
        {cycle.modelSections.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {cycle.modelSections.map((section, index) => (
              <label className="text-sm font-medium" key={section.key}>
                {section.label}
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm"
                  onChange={(event) => setCycle({ ...cycle, modelSections: cycle.modelSections.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })}
                  placeholder={section.placeholder}
                  value={section.value}
                />
              </label>
            ))}
          </div>
        ) : null}
      </section>

      {/* 执行与复盘 */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-muted" />
          <h2 className="font-semibold">执行与复盘</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">执行结果</label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm"
              onChange={(event) => setCycle({ ...cycle, outcome: event.target.value })}
              placeholder="实际行动后的结果..."
              value={cycle.outcome ?? ""}
            />
          </div>
          <div>
            <label className="text-sm font-medium">判断修正</label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm"
              onChange={(event) => setCycle({ ...cycle, review: event.target.value })}
              placeholder="回头看，当初的判断有哪些偏差..."
              value={cycle.review ?? ""}
            />
          </div>
        </div>
      </section>

      {/* 历史周期 */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted" />
          <h2 className="font-semibold">历史决策周期</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {[...caseItem.cycles].sort((a, b) => b.cycleNumber - a.cycleNumber).map((item) => (
            <button
              className={`rounded-lg border px-3 py-2 text-sm ${
                item.id === cycle.id
                  ? "border-action bg-action-soft text-action font-medium"
                  : "border-line bg-white text-slate-600 hover:border-action"
              }`}
              key={item.id}
              onClick={() => setCycle(item)}
              type="button"
            >
              周期 {item.cycleNumber}：{item.title}
            </button>
          ))}
        </div>
      </section>

      {/* 新建周期 */}
      {newCycleOpen ? (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-semibold">新建决策周期</h2>
          <label className="block text-sm font-medium">
            周期名称
            <input
              className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm"
              onChange={(event) => setNewCycleTitle(event.target.value)}
              placeholder="例如：试销结果复评"
              value={newCycleTitle}
            />
          </label>
          <label className="block text-sm font-medium">
            本次新增或变化的信息
            <textarea
              className="mt-2 min-h-28 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm"
              onChange={(event) => setNewInformation(event.target.value)}
              value={newInformation}
            />
          </label>
          <button
            className="rounded-md bg-action px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={!newCycleTitle.trim() || !newInformation.trim()}
            onClick={createNewCycle}
            type="button"
          >
            创建周期
          </button>
        </section>
      ) : null}

      {/* 底部操作 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <span className="text-sm text-slate-600">{message}</span>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-line px-4 py-2 text-sm"
            onClick={() => setNewCycleOpen((value) => !value)}
            type="button"
          >
            新建决策周期
          </button>
          <button
            className="rounded-md bg-action px-4 py-2 text-sm text-white"
            onClick={saveCycle}
            type="button"
          >
            保存当前周期
          </button>
        </div>
      </div>
    </div>
  );
}
