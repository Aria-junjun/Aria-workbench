import { PRODUCT_DECOMPOSITION_STEP_LABELS, type ProductDecompositionStepKey, type ProductDecompositionStepStatus } from "@/features/workbench/product-decomposition";

const stepOrder: ProductDecompositionStepKey[] = ["positioning", "scope", "causes", "solutions", "actions"];

export function StepNavigation({ activeStep, steps, onChange }: { activeStep: ProductDecompositionStepKey; steps: Record<ProductDecompositionStepKey, ProductDecompositionStepStatus>; onChange: (step: ProductDecompositionStepKey) => void }) {
  return <nav className="space-y-1">{stepOrder.map((step, index) => <button key={step} type="button" onClick={() => onChange(step)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${activeStep === step ? "bg-action-soft text-action" : "text-muted hover:bg-paper-warm hover:text-ink"}`}><span className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-xs font-semibold">{index + 1}</span><span className="flex-1">{PRODUCT_DECOMPOSITION_STEP_LABELS[step]}</span><span className="text-[11px]">{steps[step] === "completed" ? "已完成" : steps[step] === "in_progress" ? "进行中" : "待填写"}</span></button>)}</nav>;
}
