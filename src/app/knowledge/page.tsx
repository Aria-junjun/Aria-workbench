"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookCover } from "@/features/workbench/book-cover-editor";
import { latestDecisionCycle } from "@/features/workbench/decision-cases";
import { legacyCardToDecisionTool, matchDecisionTools, type DecisionToolDraft } from "@/features/workbench/knowledge-library";
import {
  buildCombinedSolveHref,
  defaultSelectedToolIds,
  toggleSelectedToolId
} from "@/features/workbench/knowledge-solve";
import {
  createDecisionCase,
  loadDecisionCases,
  type LocalWorkbenchData
} from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";
import {
  BookOpen,
  CheckSquare,
  ChevronRight,
  Clock,
  Compass,
  FolderOpen,
  Lightbulb,
  Search,
  Sparkles,
  X
} from "lucide-react";

type Tab = "solve" | "books" | "history";
type ClientTool = DecisionToolDraft & { id: string; bookId?: string; createdAt: string };
type ToolMatch = ReturnType<typeof matchDecisionTools<ClientTool>>[number];

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  judging: { label: "判断中", bg: "bg-action-soft", text: "text-action", border: "border-action/15" },
  pending_action: { label: "待执行", bg: "bg-warning-soft", text: "text-warning", border: "border-warning/15" },
  validating: { label: "验证中", bg: "bg-success-soft", text: "text-success", border: "border-success/15" },
  completed: { label: "已完成", bg: "bg-success-soft", text: "text-success", border: "border-success/15" },
  paused: { label: "暂缓", bg: "bg-paper-warm", text: "text-muted", border: "border-line-soft" }
};

export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("solve");
  const [question, setQuestion] = useState("");
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<ToolMatch[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [message, setMessage] = useState("");
  const restoredQuery = useRef(false);

  const data = useWorkbenchData();

  useEffect(() => {
    if (restoredQuery.current) return;
    restoredQuery.current = true;
    const restoredProblem = new URLSearchParams(window.location.search).get("problem")?.trim() || "";
    if (!restoredProblem) return;
    const restoredMatches = matchDecisionTools(restoredProblem, buildClientTools(data));
    setQuestion(restoredProblem);
    setSearched(true);
    setMatches(restoredMatches);
    setSelectedToolIds(defaultSelectedToolIds(combinableToolIds(restoredMatches)));
  }, [data]);

  const bookById = new Map(data.knowledgeBooks.map((book) => [book.id, book]));
  const tools = buildClientTools(data);
  const contextParams = new URLSearchParams(window.location.search);
  const caseContext = contextParams.get("caseId") && contextParams.get("cycleId")
    ? `&caseId=${encodeURIComponent(contextParams.get("caseId")!)}&cycleId=${encodeURIComponent(contextParams.get("cycleId")!)}`
    : "";

  function solve() {
    const nextMatches = matchDecisionTools(question, tools);
    setSearched(true);
    setMatches(nextMatches);
    setSelectedToolIds(defaultSelectedToolIds(combinableToolIds(nextMatches)));
    setSelectionMessage("");
  }

  function saveDirectly() {
    createDecisionCase({ title: question, rawInput: question });
    setMessage("已保存为问题草稿，不消耗 API。");
  }

  function toggleTool(toolId: string) {
    const result = toggleSelectedToolId(selectedToolIds, toolId);
    setSelectedToolIds(result.ids);
    setSelectionMessage(result.limitReached ? "最多选择3个工具，请先取消一个再选择。" : "");
  }

  const tabs = [
    { id: "solve" as Tab, label: "解决问题", icon: Compass },
    { id: "books" as Tab, label: "我的书架", icon: BookOpen },
    { id: "history" as Tab, label: "问题档案", icon: FolderOpen }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-action" />
            <span className="text-xs font-semibold uppercase tracking-widest text-action">知识库</span>
          </div>
          <h1 className="text-2xl font-semibold text-ink">商业知识</h1>
          <p className="mt-1 text-sm text-muted">需要解决问题时调用知识，而不是继续收藏摘要。</p>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-action to-action-strong px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover shrink-0"
          href="/knowledge/import"
        >
          <Sparkles className="h-4 w-4" />
          导入一本书
        </Link>
      </header>

      {/* Tabs */}
      <div className="inline-flex rounded-2xl border border-line bg-surface p-1 shadow-subtle" role="tablist">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-action text-white shadow-subtle"
                  : "text-muted hover:text-ink hover:bg-paper-warm"
              }`}
              onClick={() => setTab(t.id)}
              role="tab"
              type="button"
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Solve Tab */}
      {tab === "solve" ? (
        <section className="space-y-5">
          {/* Input card */}
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-card">
            <label className="flex items-center gap-2 text-sm font-semibold text-ink" htmlFor="knowledge-question">
              <Search className="h-4 w-4 text-action" />
              我现在要解决什么问题？
            </label>
            <textarea
              className="mt-3 min-h-28 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-action/20 focus:border-action transition-all"
              id="knowledge-question"
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="例如：竞品价格比我们低很多，但材料和性能不同，我是否需要降价？"
              value={question}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted">保存问题和查找本地知识都不消耗 API。</span>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-xl border border-line bg-white px-4 py-2 text-sm text-muted hover:border-action hover:text-action transition-colors disabled:opacity-50"
                  disabled={!question.trim()}
                  onClick={saveDirectly}
                  type="button"
                >
                  保存为问题草稿
                </button>
                <button
                  className="rounded-xl bg-action px-5 py-2 text-sm font-semibold text-white shadow-subtle hover:shadow-card transition-all disabled:opacity-50"
                  disabled={!question.trim()}
                  onClick={solve}
                  type="button"
                >
                  查找本地知识
                </button>
              </div>
            </div>
            {message ? <p className="mt-3 text-sm text-success">{message}</p> : null}
          </div>

          {/* Matches */}
          {matches.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-action" />
                <h2 className="font-semibold text-ink">匹配到的知识工具</h2>
                <span className="rounded-lg bg-action-soft px-2 py-0.5 text-xs font-semibold text-action">{matches.length}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {matches.map(({ tool, reasons }) => {
                  const isLegacy = Boolean(tool.legacyCardId);
                  const href = isLegacy
                    ? `/knowledge/${tool.legacyCardId}`
                    : `/knowledge/tools/${tool.id}?problem=${encodeURIComponent(question.trim())}${caseContext}`;
                  const source = tool.bookId ? bookById.get(tool.bookId)?.title : "旧知识卡";
                  const selected = selectedToolIds.includes(tool.id);

                  return (
                    <article
                      className={`rounded-2xl border bg-surface p-5 shadow-card transition-all hover:shadow-card-hover ${
                        selected ? "border-action ring-1 ring-action/20" : "border-line hover:border-action/30"
                      }`}
                      key={tool.id}
                    >
                      <div className="flex items-start gap-3">
                        {!isLegacy ? (
                          <button
                            aria-label={`选择${tool.name}`}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                              selected ? "border-action bg-action text-white" : "border-line hover:border-action"
                            }`}
                            onClick={() => toggleTool(tool.id)}
                            type="button"
                          >
                            {selected ? <CheckSquare className="h-3.5 w-3.5" /> : null}
                          </button>
                        ) : (
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-paper-warm border border-line-soft">
                            <Clock className="h-3 w-3 text-muted" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-muted">{source || "未归类知识"}</div>
                          <h3 className="mt-1 font-semibold text-ink">{tool.name}</h3>
                          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                            {tool.problem || "这条旧知识还需要补充解决的问题。"}
                          </p>
                          {reasons.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {reasons.map((r, i) => (
                                <span key={i} className="rounded-md bg-action-soft px-2 py-0.5 text-[11px] text-action font-medium">
                                  {r}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <Link
                            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-action hover:underline"
                            href={href}
                          >
                            查看这个工具
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {combinableToolIds(matches).length > 0 ? (
                <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-ink">
                      已选择 {selectedToolIds.length}/3
                    </div>
                    <div className="mt-1 text-xs text-muted">复杂问题建议组合2个互补工具，最多3个。</div>
                    {selectionMessage ? (
                      <div className="mt-1 text-xs text-danger">{selectionMessage}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-xl border border-line bg-white px-4 py-2 text-sm text-muted hover:border-action hover:text-action transition-colors"
                      onClick={() => { setSelectedToolIds([]); setSelectionMessage(""); }}
                      type="button"
                    >
                      清空选择
                    </button>
                    {selectedToolIds.length > 0 ? (
                      <Link
                        className="rounded-xl bg-action px-5 py-2 text-sm font-semibold text-white shadow-subtle hover:shadow-card transition-all"
                        href={`${buildCombinedSolveHref(question, selectedToolIds)}${caseContext}`}
                      >
                        组合使用已选工具
                      </Link>
                    ) : (
                      <button
                        className="rounded-xl bg-action px-5 py-2 text-sm font-semibold text-white opacity-40"
                        disabled
                        type="button"
                      >
                        组合使用已选工具
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : searched ? (
            <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
              <Search className="mx-auto mb-3 h-10 w-10 text-muted-light" />
              <p className="font-medium text-ink">当前知识库没有匹配到足够相关的工具</p>
              <p className="mt-1 text-sm text-muted">可以换一种具体描述，或先导入相关书籍。</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Books Tab */}
      {tab === "books" ? (
        <section>
          {data.knowledgeBooks.length === 0 ? (
            <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-light" />
              <p className="font-medium text-ink">书架还是空的</p>
              <p className="mt-1 text-sm text-muted">先用 ChatGPT Plus 生成书籍包，再一次导入。</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.knowledgeBooks.map((book) => {
                const toolCount = data.decisionTools.filter((tool) => tool.bookId === book.id).length;
                const usageCount = data.knowledgeApplications.filter((item) =>
                  item.toolIds.some((id) => data.decisionTools.some((tool) => tool.id === id && tool.bookId === book.id))
                ).length;
                return (
                  <Link
                    className="group flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:border-action/30"
                    href={`/knowledge/books/${book.id}`}
                    key={book.id}
                  >
                    <BookCover title={book.title} value={book.coverImage} className="w-20 sm:w-24 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 font-semibold text-ink group-hover:text-action transition-colors">
                        {book.title}
                      </h3>
                      <div className="mt-1 truncate text-sm text-muted">{book.author || "未记录作者"}</div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600 leading-relaxed">
                        {book.purpose || book.framework || "待补充这本书主要解决的问题。"}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                        <span className="rounded-md bg-action-soft px-2 py-0.5 text-action font-medium">{toolCount} 个工具</span>
                        <span>·</span>
                        <span>已使用 {usageCount} 次</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* History Tab */}
      {tab === "history" ? (
        <section className="space-y-3">
          {loadDecisionCases().length === 0 ? (
            <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
              <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-light" />
              <p className="font-medium text-ink">还没有问题档案</p>
              <p className="mt-1 text-sm text-muted">保存问题或使用知识工具后，会沉淀在这里。</p>
            </div>
          ) : (
            loadDecisionCases().map((caseItem) => {
              const cycle = latestDecisionCycle(caseItem);
              const st = statusConfig[cycle?.status || ""] || statusConfig.judging;
              return (
                <Link
                  className="group block rounded-2xl border border-line bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:border-action/30"
                  href={`/knowledge/cases/${encodeURIComponent(caseItem.id)}`}
                  key={caseItem.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-ink group-hover:text-action transition-colors line-clamp-1">
                      {caseItem.title}
                    </h3>
                    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-xs text-muted">最新结论</span>
                      <p className="mt-0.5 text-slate-700 line-clamp-2">
                        {cycle?.conclusion || cycle?.initialJudgement || "尚未形成结论"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted">下一步</span>
                      <p className="mt-0.5 text-slate-700 line-clamp-2">
                        {cycle?.nextActions.map((item) => item.action).join("、") || "尚未确定行动"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                    <span>{caseItem.cycles.length} 个决策周期</span>
                    <span>·</span>
                    <span>{new Date(caseItem.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                </Link>
              );
            })
          )}
        </section>
      ) : null}
    </div>
  );
}

function buildClientTools(data: LocalWorkbenchData): ClientTool[] {
  return [
    ...data.decisionTools,
    ...data.knowledgeCards.map((card) => ({
      ...legacyCardToDecisionTool(card),
      id: `legacy:${card.id}`,
      createdAt: card.createdAt
    }))
  ];
}

function combinableToolIds(matches: ToolMatch[]) {
  return matches.filter(({ tool }) => !tool.legacyCardId).map(({ tool }) => tool.id);
}
