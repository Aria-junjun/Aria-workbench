export const analysisSteps = [
  { key: "goal", label: "分析目标", description: "明确要支持什么决策" },
  { key: "competitors", label: "竞品确认", description: "说明为什么选它" },
  { key: "layers", label: "五层拆解", description: "从战略到表现观察" },
  { key: "stages", label: "阶段与版本", description: "理解发展路径" },
  { key: "self_state", label: "我们的状态", description: "判断差距和机会" },
  { key: "strategy_report", label: "策略与报告", description: "形成可执行行动" },
] as const;

export type AnalysisStepKey = typeof analysisSteps[number]["key"];

export function StepNavigation({ activeStep, onChange }: { activeStep: AnalysisStepKey; onChange: (step: AnalysisStepKey) => void }) {
  return <nav className="space-y-1">{analysisSteps.map((step, index) => <button key={step.key} type="button" onClick={() => onChange(step.key)} className={`w-full rounded-xl px-3 py-3 text-left transition ${activeStep === step.key ? "bg-action-soft text-action" : "text-muted hover:bg-paper-warm hover:text-ink"}`}><span className="mr-2 text-xs font-semibold">{index + 1}</span><span className="text-sm font-semibold">{step.label}</span><span className="mt-1 block pl-5 text-xs text-muted">{step.description}</span></button>)}</nav>;
}
