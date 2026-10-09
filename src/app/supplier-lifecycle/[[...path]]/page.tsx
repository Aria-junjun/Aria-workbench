import { notFound } from 'next/navigation';
import { SupplierLifecycleWorkspace } from '@/components/workbench/supplier-lifecycle-workspace';
import { isLifecycleSection } from '@/features/workbench/supplier-lifecycle';
import { SupplierCostExecutionGuide, SupplierCostImprovements } from '@/components/workbench/supplier-cost-improvements';

export default async function Page({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<{ from?: string; saved?: string; supplierId?: string; businessMode?: string; sourceRecordId?: string; riskReason?: string }> }) {
  const { path = [] } = await params;
  const query = await searchParams;
  if (!path.length) return <SupplierLifecycleWorkspace mode="overview" />;
  const [section, id, action] = path;
  if (section === 'improvements' && path.length <= 2 && (path.length === 1 || id === 'new')) return <main className="mx-auto max-w-[1440px] space-y-6 py-6"><header><p className="mb-2 text-xs tracking-[0.2em] text-action">供应商管理 · 成本改善</p><h1 className="text-2xl font-semibold">年度成本改善</h1><p className="mt-2 text-sm text-muted">以项目确定责任与基准，实绩依据可比入仓事实。</p></header>{id === 'new' && <SupplierCostExecutionGuide />}<SupplierCostImprovements create={id === 'new'} /></main>;
  if (!isLifecycleSection(section) || path.length > 3 || (action && action !== 'edit') || (id === 'new' && action)) notFound();
  return <SupplierLifecycleWorkspace section={section} recordId={id === 'new' ? undefined : id} mode={!id ? 'list' : id === 'new' ? 'new' : action === 'edit' ? 'edit' : 'detail'} sourceId={query.from} sourceRecordId={query.sourceRecordId} riskReason={query.riskReason} saved={query.saved === '1'} supplierId={query.supplierId} businessMode={query.businessMode === 'inbound' || query.businessMode === 'dropship' ? query.businessMode : undefined} />;
}
