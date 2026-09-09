import Link from "next/link";
import { DemandIntakeForm } from "@/components/workbench/demand-exploration/demand-intake-form";

export default function NewDemandExplorationPage() {
  return <div className="mx-auto max-w-4xl space-y-6"><div><Link href="/demand-exploration" className="text-sm text-muted hover:text-action">← 返回需求探索</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-action">Demand Confirmation</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">新建需求确认文档</h1><p className="mt-2 text-sm leading-6 text-muted">先建立产品、用户和场景，再在文档中添加多个功能板块和需求项。</p></div><DemandIntakeForm /></div>;
}
