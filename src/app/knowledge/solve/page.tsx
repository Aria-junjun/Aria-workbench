"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { matchDecisionTools } from "@/features/workbench/knowledge-library";
import { buildKnowledgeReturnHref, parseSelectedToolIds } from "@/features/workbench/knowledge-solve";
import {
  addToolContribution,
  createDecisionCase,
  createTaskFromKnowledgeAction,
  type LocalDecisionTool,
  type LocalKnowledgeActionSource
} from "@/features/workbench/local-store";
import { useWorkbenchData } from "@/features/workbench/workbench-store";

export default function CombinedDecisionPage() {
  const router = useRouter();
  const [problem, setProblem] = useState("");
  const [selectedTools, setSelectedTools] = useState<LocalDecisionTool[]>([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [selectedSources, setSelectedSources] = useState<LocalKnowledgeActionSource[]>([]);
  const [message, setMessage] = useState("");

  const data = useWorkbenchData();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restoredProblem = params.get("problem")?.trim() || "";
    const validIds = parseSelectedToolIds(params.get("toolIds"), data.decisionTools.map((tool) => tool.id));
    const toolById = new Map(data.decisionTools.map((tool) => [tool.id, tool]));
    const restoredTools = validIds.map((id) => toolById.get(id)).filter((tool): tool is LocalDecisionTool => Boolean(tool));

    if (!restoredProblem || restoredTools.length === 0) {
      router.replace(buildKnowledgeReturnHref(restoredProblem));
      return;
    }

    setProblem(restoredProblem);
    setSelectedTools(restoredTools);
  }, [router]);

  const reasonsByToolId = useMemo(() => new Map(
    matchDecisionTools(problem, selectedTools).map(({ tool, reasons }) => [tool.id, reasons])
  ), [problem, selectedTools]);

  if (selectedTools.length === 0) return <div className="text-sm text-slate-500">正在准备组合决策工作区...</div>;

  function toggleAction(tool: LocalDecisionTool, action: string) {
    const exists = selectedSources.some((source) => source.toolId === tool.id && source.action === action);
    setSelectedSources((current) => exists
      ? current.filter((source) => !(source.toolId === tool.id && source.action === action))
      : [...current, { toolId: tool.id, toolName: tool.name, action }]);
  }

  function save(createTasks: boolean) {
    if (!problem.trim()) {
      setMessage("请先填写当前要解决的问题。");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    let caseId = params.get("caseId");
    let cycleId = params.get("cycleId");
    if (!caseId || !cycleId) {
      const created = createDecisionCase({ title: problem, rawInput: problem, initialJudgement: diagnosis });
      caseId = created.id;
      cycleId = created.cycles[0].id;
    }
    selectedTools.forEach((tool) => {
      const book = tool.bookId ? data!.knowledgeBooks.find((item) => item.id === tool.bookId) : undefined;
      addToolContribution(caseId!, cycleId!, {
        toolId: tool.id,
        toolName: tool.name,
        sourceBook: book?.title,
        judgement: diagnosis,
        actions: selectedSources.filter((source) => source.toolId === tool.id).map((source) => source.action)
      });
    });
    if (createTasks) {
      selectedSources.forEach((source) => createTaskFromKnowledgeAction(source.toolId, source.action));
      router.push("/tasks");
      return;
    }
    router.push(`/knowledge/cases/${caseId}`);
  }

  return (
    <div className="space-y-6">
      <Link className="text-sm text-action" href={buildKnowledgeReturnHref(problem)}>返回重新选择</Link>

      <header className="border-b border-line pb-5">
        <div className="text-sm text-slate-500">组合使用 {selectedTools.length} 个决策工具</div>
        <h1 className="mt-1 text-2xl font-semibold">组合决策工作区</h1>
        <label className="mt-4 block text-xs text-slate-500" htmlFor="combined-problem">当前问题</label>
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
          id="combined-problem"
          onChange={(event) => setProblem(event.target.value)}
          value={problem}
        />
      </header>

      <div className="space-y-6">
        {selectedTools.map((tool, index) => {
          const book = tool.bookId ? data.knowledgeBooks.find((item) => item.id === tool.bookId) : undefined;
          const reasons = reasonsByToolId.get(tool.id) ?? [];
          return (
            <section className="border-y border-line bg-white px-4 py-5" key={tool.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">视角 {index + 1} · {book?.title || "未归类知识"}</div>
                  <h2 className="mt-1 text-lg font-medium">{tool.name}</h2>
                  <p className="mt-2 text-sm text-slate-600">{tool.problem || "未记录该工具解决的问题"}</p>
                </div>
                <Link className="text-sm text-action" href={`/knowledge/tools/${tool.id}?problem=${encodeURIComponent(problem)}`}>查看完整工具</Link>
              </div>
              {reasons.length > 0 ? <p className="mt-3 text-xs text-slate-500">匹配原因：{reasons.join("、")}</p> : null}

              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                <ListBlock title="先回答这些问题" items={tool.diagnosticQuestions} ordered />
                <div>
                  <h3 className="text-sm font-medium">选择这个视角的行动</h3>
                  {tool.actions.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {tool.actions.map((action) => (
                        <label className="flex items-start gap-2 border-y border-line px-2 py-2 text-sm" key={action}>
                          <input
                            checked={selectedSources.some((source) => source.toolId === tool.id && source.action === action)}
                            className="mt-0.5 h-4 w-4 shrink-0"
                            onChange={() => toggleAction(tool, action)}
                            type="checkbox"
                          />
                          <span>{action}</span>
                        </label>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-sm text-slate-500">未记录行动建议</p>}
                </div>
                <ListBlock title="这些情况下不要使用" items={tool.limitations} />
              </div>
            </section>
          );
        })}
      </div>

      <section className="border-y border-line bg-white px-4 py-5">
        <h2 className="font-medium">形成一份综合判断</h2>
        <p className="mt-1 text-sm text-slate-500">不同工具提供不同视角。这里记录你综合诊断后的结论，不自动替你裁决策略冲突。</p>
        <label className="mt-4 block text-xs text-slate-500" htmlFor="combined-diagnosis">综合判断</label>
        <textarea
          className="mt-1 min-h-28 w-full rounded-md border border-line px-3 py-2 text-sm"
          id="combined-diagnosis"
          onChange={(event) => setDiagnosis(event.target.value)}
          placeholder="回答各工具的诊断问题后，记录当前判断、主要依据和仍需验证的信息。"
          value={diagnosis}
        />
        <div className="mt-3 text-sm text-slate-600">已选择 {selectedSources.length} 项行动</div>
        {selectedSources.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {selectedSources.map((source) => <li key={`${source.toolId}:${source.action}`}>{source.toolName}：{source.action}</li>)}
          </ul>
        ) : null}
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="rounded-md border border-line px-4 py-2 text-sm" onClick={() => save(false)} type="button">仅保存应用记录</button>
          <button className="rounded-md bg-action px-4 py-2 text-sm text-white disabled:opacity-50" disabled={selectedSources.length === 0} onClick={() => save(true)} type="button">保存并生成待办</button>
        </div>
      </section>
    </div>
  );
}

function ListBlock({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {items.length > 0 ? (
        <Tag className={`mt-3 space-y-2 pl-5 text-sm text-slate-700 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </Tag>
      ) : <p className="mt-3 text-sm text-slate-500">未记录</p>}
    </div>
  );
}
