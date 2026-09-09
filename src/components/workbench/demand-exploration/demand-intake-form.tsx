"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDemandConfirmationDocumentRecord, saveDemandConfirmationDocument } from "@/features/workbench/local-store";

const examples = {
  title: "示例：围绕一个具体问题建立一份需求确认文档",
  productName: "示例：白板贴",
  userType: "示例：需要反复记录和擦除内容的办公室、教室使用者",
  scenario: "示例：会议结束后擦除白板贴上的内容，下一次可继续使用",
  problem: "示例：擦除后容易残留涂写痕迹，影响后续书写",
  goal: "示例：确认“不留痕迹”是否是用户必须具备的需求",
  source: "示例：用户反馈、售后记录、现场使用观察",
};

export function DemandIntakeForm() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", productName: "", userType: "", scenario: "", problem: "", goal: "", source: "" });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  function submit(event: React.FormEvent) { event.preventDefault(); const document = createDemandConfirmationDocumentRecord(form); saveDemandConfirmationDocument(document); router.push(`/demand-exploration/${document.id}/items`); }
  return <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-card"><div className="grid gap-4 md:grid-cols-2"><Field label="文档名称" value={form.title} onChange={(value) => update("title", value)} placeholder={examples.title} hint="示例：围绕一个具体问题建立一份需求确认文档" required /><Field label="目标产品/产品族" value={form.productName} onChange={(value) => update("productName", value)} placeholder={examples.productName} hint="示例：白板贴" required /><Field label="目标用户" value={form.userType} onChange={(value) => update("userType", value)} placeholder={examples.userType} hint="示例：需要反复记录和擦除内容的办公室、教室使用者" required /><Field label="使用场景" value={form.scenario} onChange={(value) => update("scenario", value)} placeholder={examples.scenario} hint="示例：会议结束后擦除白板贴上的内容，下一次可继续使用" required /><Field label="当前问题" value={form.problem} onChange={(value) => update("problem", value)} placeholder={examples.problem} hint="示例：擦除后容易残留涂写痕迹，影响后续书写" multiline required wide /><Field label="研究目标" value={form.goal} onChange={(value) => update("goal", value)} placeholder={examples.goal} hint="示例：确认“不留痕迹”是否是用户必须具备的需求" multiline required wide /><Field label="需求来源" value={form.source} onChange={(value) => update("source", value)} placeholder={examples.source} hint="示例：用户反馈、售后记录、现场使用观察" wide /></div><div className="flex justify-end"><button type="submit" className="rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white shadow-glow">创建需求确认文档</button></div></form>;
}

function Field({ label, value, onChange, placeholder, hint, multiline = false, required = false, wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; hint: string; multiline?: boolean; required?: boolean; wide?: boolean }) {
  return <label className={`text-sm font-semibold text-ink ${wide ? "md:col-span-2" : ""}`}>{label}{multiline ? <textarea required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 min-h-24 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none placeholder:text-muted-light focus:border-action" /> : <input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none placeholder:text-muted-light focus:border-action" />}<span className="mt-1 block text-xs font-normal text-muted">{hint}</span></label>;
}
