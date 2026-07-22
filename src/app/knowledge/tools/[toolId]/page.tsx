"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { buildKnowledgeReturnHref } from "@/features/workbench/knowledge-solve";
import {
  addToolContribution,
  createDecisionCase,
  createTaskFromKnowledgeAction,
  loadLocalWorkbenchData,
  type LocalWorkbenchData
} from "@/features/workbench/local-store";

export default function DecisionToolPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toolId = Array.isArray(params.toolId) ? params.toolId[0] : params.toolId;
  const [data, setData] = useState<LocalWorkbenchData>();
  const [problem, setProblem] = useState(searchParams.get("problem") || "");
  const [diagnosis, setDiagnosis] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => setData(loadLocalWorkbenchData()), []);

  if (!data) return <div className="text-sm text-slate-500">正在读取决策工具...</div>;
  const tool = data.decisionTools.find((item) => item.id === toolId);
  const book = tool?.bookId ? data.knowledgeBooks.find((item) => item.id === tool.bookId) : undefined;

  if (!tool) return <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-600">没有找到这个决策工具。</div>;

  function toggleAction(action: string) {
    setSelectedActions((current) => current.includes(action) ? current.filter((item) => item !== action) : [...current, action]);
  }

  function save(createTasks: boolean) {
    if (!problem.trim()) {
      setMessage("请先填写当前要解决的问题。");
      return;
    }
    let caseId = searchParams.get("caseId");
    let cycleId = searchParams.get("cycleId");
    if (!caseId || !cycleId) {
      const created = createDecisionCase({ title: problem, rawInput: problem, initialJudgement: diagnosis });
      caseId = created.id;
      cycleId = created.cycles[0].id;
    }
    addToolContribution(caseId, cycleId, {
      toolId: tool!.id,
      toolName: tool!.name,
      sourceBook: book?.title,
      judgement: diagnosis,
      actions: selectedActions
    });
    if (createTasks) selectedActions.forEach((action) => createTaskFromKnowledgeAction(tool!.id, action));
    if (createTasks) router.push("/tasks");
    else router.push(`/knowledge/cases/${caseId}`);
  }

  return (
    <div className="max-w-4xl space-y-5">
      <Link className="text-sm text-action" href={problem ? buildKnowledgeReturnHref(problem) : book ? `/knowledge/books/${book.id}` : "/knowledge"}>
        {problem ? "返回推荐结果" : `返回${book?.title || "商业知识"}`}
      </Link>
      <header className="border-b border-line pb-5">
        <div className="text-sm text-slate-500">{book?.title || "未归类知识"}</div>
        <h1 className="mt-1 text-2xl font-semibold">{tool.name}</h1>
        <p className="mt-3 text-sm text-slate-700">{tool.problem || "待补充这个工具解决的问题。"}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <ListSection title="什么时候调用" items={tool.triggers} empty="未记录触发信号" />
        <ListSection title="先问自己" items={tool.diagnosticQuestions} empty="未记录诊断问题" ordered />
        <ListSection title="可以采取的行动" items={tool.actions} empty="未记录行动建议" />
        <ListSection title="什么情况下不要用" items={tool.limitations} empty="未记录适用边界" />
      </section>

      <section className="border-y border-line bg-white px-4 py-5">
        <h2 className="font-medium">应用到当前问题</h2>
        <label className="mt-3 block text-xs text-slate-500">当前问题<textarea className="mt-1 min-h-24 w-full rounded-md border border-line px-3 py-2 text-sm" onChange={(event) => setProblem(event.target.value)} value={problem} /></label>
        <label className="mt-3 block text-xs text-slate-500">我的初步判断<textarea className="mt-1 min-h-20 w-full rounded-md border border-line px-3 py-2 text-sm" onChange={(event) => setDiagnosis(event.target.value)} placeholder="回答上面的诊断问题后，记录目前的判断。" value={diagnosis} /></label>
        <fieldset className="mt-4">
          <legend className="text-xs text-slate-500">选择准备执行的行动</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {tool.actions.map((action) => <label className="flex items-start gap-2 rounded-md border border-line px-3 py-2 text-sm" key={action}><input checked={selectedActions.includes(action)} className="mt-0.5" onChange={() => toggleAction(action)} type="checkbox" />{action}</label>)}
          </div>
        </fieldset>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className="rounded-md border border-line px-4 py-2 text-sm" onClick={() => save(false)} type="button">仅保存应用记录</button>
          <button className="rounded-md bg-action px-4 py-2 text-sm text-white disabled:opacity-50" disabled={selectedActions.length === 0} onClick={() => save(true)} type="button">保存并生成待办</button>
        </div>
      </section>
    </div>
  );
}

function ListSection({ title, items, empty, ordered = false }: { title: string; items: string[]; empty: string; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return <section className="border-y border-line bg-white px-4 py-4"><h2 className="font-medium">{title}</h2>{items.length > 0 ? <Tag className={`mt-3 space-y-2 text-sm text-slate-700 ${ordered ? "list-decimal" : "list-disc"} pl-5`}>{items.map((item) => <li key={item}>{item}</li>)}</Tag> : <p className="mt-3 text-sm text-slate-500">{empty}</p>}</section>;
}
