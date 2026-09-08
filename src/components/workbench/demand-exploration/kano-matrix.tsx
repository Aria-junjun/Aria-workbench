"use client";

import { useState } from "react";
import { classifyKanoResponse, type KanoAnswer } from "@/features/workbench/demand-exploration";

const answers: Array<{ value: KanoAnswer; label: string }> = [
  { value: "like", label: "很喜欢" },
  { value: "must", label: "理应如此" },
  { value: "neutral", label: "无所谓" },
  { value: "accept", label: "可以接受" },
  { value: "dislike", label: "很不喜欢" }
];

const categoryNames = { A: "魅力", O: "期望", M: "必备", I: "无差异", R: "反向", Q: "可疑" };

export function KanoMatrix() {
  const [selected, setSelected] = useState<{ functional: KanoAnswer; dysfunctional: KanoAnswer } | null>(null);
  return <div className="overflow-x-auto rounded-xl border border-line"><table className="min-w-[720px] w-full border-collapse text-xs"><thead><tr className="bg-paper-warm"><th className="border-b border-line p-3 text-left font-semibold text-ink">反向 \ 正向</th>{answers.map((answer) => <th key={answer.value} className="border-b border-line p-3 text-center font-semibold text-ink">{answer.label}</th>)}</tr></thead><tbody>{answers.map((dysfunctional) => <tr key={dysfunctional.value}><th className="border-b border-line bg-paper-warm p-3 text-left font-semibold text-ink">{dysfunctional.label}</th>{answers.map((functional) => { const category = classifyKanoResponse(functional.value, dysfunctional.value); const active = selected?.functional === functional.value && selected?.dysfunctional === dysfunctional.value; return <td key={functional.value} className={`border-b border-line p-2 text-center ${active ? "bg-action-soft" : ""}`}><button type="button" onClick={() => setSelected({ functional: functional.value, dysfunctional: dysfunctional.value })} className="w-full rounded-lg px-3 py-2 font-bold text-action hover:bg-action-soft">{category}<span className="mt-1 block text-[10px] font-normal text-muted">{categoryNames[category]}</span></button></td>; })}</tr>)}</tbody></table>{selected ? <div className="border-t border-line bg-action-soft/40 px-4 py-3 text-xs leading-5 text-muted">正向“{answers.find((item) => item.value === selected.functional)?.label}” + 反向“{answers.find((item) => item.value === selected.dysfunctional)?.label}” → <strong className="text-action">{classifyKanoResponse(selected.functional, selected.dysfunctional)} {categoryNames[classifyKanoResponse(selected.functional, selected.dysfunctional)]}</strong>。这是回答组合映射出的属性，不是系统替你判断的产品结论。</div> : <div className="px-4 py-3 text-xs text-muted">点击任意单元格，查看这个回答组合为什么落入对应属性。</div>}</div>;
}
