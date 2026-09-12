"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createIndustryInsightProject } from "@/features/workbench/industry-insight";
import { saveIndustryInsightProject } from "@/features/workbench/local-store";

const fields = [
  ["title", "分析项目名称", "例如：白板贴可重复使用市场判断", "给这次研究取一个便于复盘的名称"],
  ["productName", "产品/产品族", "例如：白板贴", "填写要放进行业背景判断的产品"],
  ["targetUsers", "目标用户", "例如：家庭办公、教师和培训使用者", "先写最主要的使用人群"],
  ["analysisTheme", "分析主题", "例如：可擦写墙面材料的发展空间", "限定本次研究关注的范围"],
  ["decisionQuestion", "决策问题", "例如：下一步是否值得重点验证家庭重复书写场景？", "研究完成后要帮助你做什么决定"],
  ["expectedAction", "预期行动", "例如：决定进入竞品拆解或需求探索", "希望最后形成的行动方向"],
] as const;

export function InsightIntakeForm() {
  const router = useRouter();
  const [form, setForm] = useState<{ title: string; productName: string; targetUsers: string; analysisTheme: string; decisionQuestion: string; expectedAction: string }>({ title: "", productName: "", targetUsers: "", analysisTheme: "", decisionQuestion: "", expectedAction: "" });
  const submit = (event: React.FormEvent) => { event.preventDefault(); const project = createIndustryInsightProject(form); saveIndustryInsightProject(project); router.push(`/industry-insight/${project.id}`); };
  return <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-card"><div className="rounded-xl border border-action/20 bg-action-soft/30 p-4 text-sm leading-6 text-muted"><p className="font-semibold text-ink">先把研究目的说清楚</p><p className="mt-1">灰色文字是白板贴案例提示，不会自动写入项目；真正保存的是你填写的内容。</p></div><div className="grid gap-4 md:grid-cols-2">{fields.map(([key, label, placeholder, hint]) => <label key={key} className={`text-sm font-semibold text-ink ${key === "decisionQuestion" || key === "expectedAction" ? "md:col-span-2" : ""}`}>{label}<textarea required={key !== "expectedAction"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} className="mt-2 min-h-20 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none placeholder:text-muted-light focus:border-action" /><p className="mt-1 text-xs font-normal text-muted">{hint}</p></label>)}</div><div className="flex justify-end"><button type="submit" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow">创建行业洞察</button></div></form>;
}
