import Link from "next/link";
import { ResponseEntry } from "@/components/workbench/demand-exploration/response-entry";

export default async function KanoResponsesPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = await params;
  return <div className="mx-auto max-w-4xl space-y-6"><div><Link href={`/demand-exploration/${analysisId}/matrix`} className="text-sm text-muted hover:text-action">← 返回对照表</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-action">Step 4 / 6</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">多人回答统计</h1><p className="mt-2 text-sm leading-6 text-muted">可以逐条添加，也可以粘贴回答。无效行不会被静默丢弃。</p></div><ResponseEntry analysisId={analysisId} /></div>;
}
