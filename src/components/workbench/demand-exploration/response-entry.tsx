"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { calculateKanoScores, parseKanoResponseText, summarizeKanoResponses, type KanoAnswer, type KanoResponse } from "@/features/workbench/demand-exploration";
import { loadDemandExplorations, updateDemandExploration } from "@/features/workbench/local-store";

const answerOptions: Array<{ value: KanoAnswer; label: string }> = [{ value: "like", label: "很喜欢" }, { value: "must", label: "理应如此" }, { value: "neutral", label: "无所谓" }, { value: "accept", label: "可以接受" }, { value: "dislike", label: "很不喜欢" }];

export function ResponseEntry({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const analysis = loadDemandExplorations().find((item) => item.id === analysisId);
  const [functional, setFunctional] = useState<KanoAnswer>("like");
  const [dysfunctional, setDysfunctional] = useState<KanoAnswer>("dislike");
  const [pasted, setPasted] = useState("");
  const [invalidRows, setInvalidRows] = useState<string[]>([]);
  if (!analysis) return <div className="rounded-2xl border border-danger/30 bg-surface p-6 text-sm text-danger">找不到这条分析记录。</div>;
  const currentAnalysis = analysis;
  function persist(responses: KanoResponse[]) {
    const counts = summarizeKanoResponses(responses); const score = calculateKanoScores(counts);
    updateDemandExploration(analysisId, { responses, counts, si: score.si, dsi: score.dsi, status: "in_progress" });
  }
  function addOne() { persist([...currentAnalysis.responses, { functional, dysfunctional }]); }
  function importRows() { const parsed = parseKanoResponseText(pasted); setInvalidRows(parsed.invalidRows); if (parsed.responses.length > 0) persist([...currentAnalysis.responses, ...parsed.responses]); }
  return <div className="space-y-5"><div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 md:grid-cols-2"><label className="text-sm font-semibold text-ink">正向回答<select value={functional} onChange={(event) => setFunctional(event.target.value as KanoAnswer)} className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal">{answerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="text-sm font-semibold text-ink">反向回答<select value={dysfunctional} onChange={(event) => setDysfunctional(event.target.value as KanoAnswer)} className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal">{answerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="md:col-span-2 flex justify-end"><button type="button" onClick={addOne} className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white">添加一条回答</button></div></div><div className="rounded-2xl border border-line bg-surface p-5"><h2 className="font-display text-lg font-bold text-ink">批量粘贴</h2><p className="mt-1 text-xs leading-5 text-muted">每行两列：正向回答值、反向回答值。可用 like / must / neutral / accept / dislike，中间用 Tab 分隔。</p><textarea value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={'like\tdislike\nmust\tdislike'} className="mt-3 min-h-28 w-full rounded-xl border border-line bg-paper px-3 py-2.5 font-mono text-xs outline-none focus:border-action" /><div className="mt-3 flex justify-end"><button type="button" onClick={importRows} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-action">解析并加入</button></div>{invalidRows.length > 0 ? <div className="mt-3 rounded-lg bg-danger/5 p-3 text-xs text-danger">以下行未识别，已保留待修正：{invalidRows.join("；")}</div> : null}</div><div className="flex items-center justify-between rounded-2xl border border-line bg-surface p-5"><div><p className="text-sm font-semibold text-ink">当前已录入 {currentAnalysis.responses.length} 条回答</p><p className="mt-1 text-xs text-muted">先录入回答，再查看分类统计和公式。</p></div><button type="button" onClick={() => router.push(`/demand-exploration/${analysisId}/calculation`)} className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white">查看统计与公式</button></div></div>;
}
