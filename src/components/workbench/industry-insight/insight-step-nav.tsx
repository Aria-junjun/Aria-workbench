import type { IndustryStepKey } from "@/features/workbench/industry-insight";
import { INDUSTRY_STEP_LABELS } from "@/features/workbench/industry-insight";

export function InsightStepNav({ current, onChange }: { current: IndustryStepKey; onChange: (step: IndustryStepKey) => void }) {
  return <nav className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{(Object.keys(INDUSTRY_STEP_LABELS) as IndustryStepKey[]).map((step, index) => <button key={step} type="button" onClick={() => onChange(step)} className={`rounded-xl border px-3 py-3 text-left text-sm transition ${current === step ? "border-action bg-action-soft text-action" : "border-line bg-surface text-muted hover:border-action/50"}`}><span className="mr-2 text-xs font-semibold">0{index + 1}</span>{INDUSTRY_STEP_LABELS[step]}</button>)}</nav>;
}
