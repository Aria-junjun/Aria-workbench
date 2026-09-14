import Link from "next/link";
import { DecompositionIntakeForm } from "@/components/workbench/product-decomposition/decomposition-intake-form";

export default function NewProductDecompositionPage() {
  return <div className="mx-auto max-w-4xl space-y-6"><div><Link href="/product-decomposition" className="text-sm text-muted hover:text-action">← 返回产品拆解</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-action">Product Decomposition</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">新建产品拆解</h1><p className="mt-2 text-sm leading-6 text-muted">先明确产品定位和中心问题，再逐步拆解原因、方案和行动。</p></div><DecompositionIntakeForm /></div>;
}
