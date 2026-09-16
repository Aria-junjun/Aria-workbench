"use client";

import type { ResearchInput } from "@/features/workbench/research-context";

const fields: Array<[keyof ResearchInput, string, string]> = [
  ["knownMaterials", "已有资料", "例如：商品评价、销售记录、行业报告或访谈原话"],
  ["personalObservations", "我的观察", "例如：我在实际使用或经营中观察到的现象"],
  ["initialHypotheses", "初步假设", "例如：我怀疑问题主要来自材料性能，而不是页面表达"],
  ["focusQuestions", "希望 AI 重点核查", "例如：核查这个现象是否影响购买、使用或复购"],
  ["excludedDirections", "明确不扩展", "例如：暂不研究企业软件、海外市场或无关产品"],
];

export function ResearchInputFields({ value, onChange }: { value: ResearchInput; onChange: (value: ResearchInput) => void }) {
  return <div className="rounded-xl border border-action/20 bg-action-soft/20 p-4 md:col-span-2">
    <div>
      <h2 className="font-semibold text-ink">研究前输入</h2>
      <p className="mt-1 text-xs leading-5 text-muted">这里填写你的资料、观察和假设，会作为 AI 的研究约束；它们不会自动被当成已验证事实。</p>
    </div>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {fields.map(([key, label, placeholder]) => <label key={key} className={`text-sm font-semibold text-ink ${key === "excludedDirections" ? "md:col-span-2" : ""}`}>{label}<textarea value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} placeholder={placeholder} className="mt-2 min-h-20 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none placeholder:text-muted-light focus:border-action" /></label>)}
    </div>
  </div>;
}
