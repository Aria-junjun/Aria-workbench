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
    <details className="mt-3 rounded-lg border border-line bg-paper px-3 py-2 text-xs leading-5 text-muted">
      <summary className="cursor-pointer font-semibold text-ink">真实资料怎么提供 / 销售下滑需要哪些数据</summary>
      <p className="mt-2">已有资料请写明来源文件或后台、时间范围、产品和渠道、指标口径。没有记录就写“未提供”，不要用0代替。经验判断填在“我的观察”或“初步假设”。</p>
      <p className="mt-2">销售下滑：先提供两个可比较时间段的销售额和订单数；尽可能补充流量、转化率及其分母、投放费用、退款金额或退款率、价格和活动变化。同比优先；月份未结束时按相同天数比较。各渠道分开列，历史数据缺失就保留缺口。</p>
      <p className="mt-2">盈利判断还需要真实进货成本、平台费用、运费和售后成本；缺少这些只能研究销售变化，不能断言是否值得重投入。此处为文字输入，文件可先提供给研究协作者核对后再记录摘要。</p>
    </details>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {fields.map(([key, label, placeholder]) => <label key={key} className={`text-sm font-semibold text-ink ${key === "excludedDirections" ? "md:col-span-2" : ""}`}>{label}<textarea value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} placeholder={placeholder} className="mt-2 min-h-20 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none placeholder:text-muted-light focus:border-action" /></label>)}
    </div>
  </div>;
}
