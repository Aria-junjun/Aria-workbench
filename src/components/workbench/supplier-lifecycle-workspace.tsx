'use client';

import Link from 'next/link';
import { SupplierStageRecords } from './supplier-stage-records';
import { SupplierBusinessLedger } from './supplier-business-ledger';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useWorkbenchData } from '@/features/workbench/workbench-store';
import type { LocalWorkbenchData } from '@/features/workbench/local-store';
import { emptyLifecycleRecord, lifecycleSections, statusNames, type LifecycleRecord, type LifecycleSection, type LifecycleStatus } from '@/features/workbench/supplier-lifecycle';
import { saveLifecycleRecord } from '@/features/workbench/supplier-lifecycle-store';
import { buildDropshipDecisionSummary, type DropshipDecisionSummary } from '@/features/workbench/dropship-decision-loop';
import { procurementTable } from './procurement-line-details';
import { buildSupplierDirectorOverview, lifecycleActionLabel } from '@/features/workbench/supplier-director-overview';
import type { NativeSupplierPerformanceSnapshot } from '@/features/workbench/supplier-native-performance';
import { loadProcurementRecords } from '@/features/workbench/procurement';
import { buildSupplierFiveLayerOverview } from '@/features/workbench/supplier-five-layer-overview';
import { calculateSupplierCostImprovement, type VerifiedExtraCost } from '@/features/workbench/supplier-cost-improvement';

const root = '/supplier-lifecycle';
const panel = 'border-b border-line py-6';
const button = 'inline-flex items-center justify-center rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-paper disabled:opacity-50';
const primary = `${button} bg-action text-white hover:opacity-90`;
const input = 'mt-2 w-full rounded-md border-0 bg-paper p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-action';
const money = (value?: number) => value === undefined ? '未采集' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value?: number) => value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
const recordUrl = (r: LifecycleRecord) => `${root}/${r.section}/${r.id}`;
const isOpen = (r: LifecycleRecord) => !['completed', 'cancelled'].includes(r.status);
const today = () => new Date().toLocaleDateString('sv-SE');
const overdue = (r: LifecycleRecord) => isOpen(r) && !!r.dueDate && r.dueDate < today();
function Badge({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs ${warning ? 'bg-warning-soft text-ink' : 'bg-action-soft text-action'}`}>{children}</span>;
}
function Status({ record }: { record: LifecycleRecord }) {
  if (record.hasConflict) return <Badge warning>版本冲突待核对</Badge>;
  return <Badge warning={overdue(record) || record.status === 'decision'}>{record.status === 'completed' ? lifecycleSections[record.section].done : statusNames[record.status]}</Badge>;
}
function Value({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="mb-2 text-xs text-muted">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm leading-7">{children}</dd></div>;
}
type Props = { mode: 'overview' | 'list' | 'detail' | 'new' | 'edit'; section?: LifecycleSection; recordId?: string; sourceId?: string; sourceRecordId?: string; riskReason?: string; saved?: boolean; supplierId?: string; businessMode?: 'inbound' | 'dropship' };

export function SupplierLifecycleWorkspace(props: Props) {
  const router = useRouter();
  const data = useWorkbenchData();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <p className="p-8 text-muted">正在读取工作台资料…</p>;
  const records = data.supplierLifecycleRecords ?? [];
  const record = records.find(r => r.id === props.recordId && r.section === props.section);
  const source = records.find(r => r.id === props.sourceId);
  const config = props.section ? lifecycleSections[props.section] : undefined;
  return <main className="mx-auto max-w-[1440px] space-y-6 py-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-xs tracking-[0.2em] text-action">供应商管理 · 可追溯业务</p><h1 className="text-2xl font-semibold">{config?.title ?? '管理总览'}</h1><p className="mt-2 text-sm text-muted">{config?.purpose ?? '看采购结构、识别需要关注的合作，再进入事项处理。'}</p></div>
      <div className="flex gap-2">{props.mode !== 'overview' && <Link className={button} href={root}>管理总览</Link>}</div>
    </header>
    <nav className="flex flex-wrap gap-2 border-b border-line pb-4 md:hidden" aria-label="供应商业务模块">
      {Object.entries(lifecycleSections).map(([key, module]) => <Link key={key} className={`rounded-lg px-3 py-2 text-sm ${key === props.section ? 'bg-action-soft text-action' : 'text-muted hover:bg-surface'}`} href={`${root}/${key}`}>{module.title}</Link>)}
    </nav>
    {props.mode === 'overview' ? <Overview data={data} /> : props.section !== 'sourcing' ? <>{props.section === 'admission' && props.mode === 'list' && <SupplierBusinessLedger kinds={['sample','inspection']} embedded />}{props.section === 'performance' && props.mode === 'list' && <SupplierBusinessLedger kinds={['purchase']} embedded />}<SupplierStageRecords key={`${props.section}-${props.mode}-${props.recordId ?? ''}`} section={props.section!} supplierId={props.supplierId} businessMode={props.businessMode} sourceRecordId={props.sourceRecordId} riskReason={props.riskReason} initialMode={props.mode === 'list' ? undefined : props.mode} recordId={props.recordId} sourceId={props.sourceId} onRouteClose={props.mode === 'list' ? undefined : () => router.push(`${root}/${props.section}`)} /></> : props.mode === 'list' ? <RecordList data={data} section={props.section!} /> : props.mode === 'detail' && record ? <RecordDetail data={data} record={record} saved={props.saved} /> : <RecordEditor data={data} section={props.section!} record={record} source={source} supplierId={props.supplierId} businessMode={props.businessMode} />}
  </main>;
}

function Overview({ data }: { data: LocalWorkbenchData }) {
  const periods = [...new Set([
    ...(data.monthlyInboundSnapshots ?? []).map(r => r.period),
    ...(data.supplierNativePerformanceSnapshots ?? []).map(r => r.periodEnd.slice(0, 7)),
  ])].sort().reverse();
  const [selection, setSelection] = useState('');
  const period = selection || periods[0] || '';
  const dropship = buildDropshipDecisionSummary(data);
  const procurementRecords = data.procurementRecordsUpdatedAt ? data.procurementRecords ?? [] : loadProcurementRecords();
  const [activeLayer, setActiveLayer] = useState<'supply' | 'delivery' | 'quality' | 'cost' | 'responsibility'>('supply');
  const [deliveryMode, setDeliveryMode] = useState<'warehouse' | 'dropship'>('warehouse');
  const layers = buildSupplierFiveLayerOverview(data, procurementRecords, period);
  const directorOverview = buildSupplierDirectorOverview(data, period || today().slice(0, 7), today());
  const decisionActions = directorOverview.decisionActions;
  const selectedNativeMode = deliveryMode === 'warehouse' ? 'inbound' : 'dropship';
  const selectedNativePerformance = directorOverview.nativePerformance.filter(snapshot => snapshot.businessMode === selectedNativeMode);
  const inboundRecordsExist = procurementRecords.some(record => record.section === 'fulfillment' && record.fulfillment?.mode === 'warehouse');
  const overdueActions = decisionActions.filter(action => action.dueDate !== '未设期限' && action.dueDate < today()).length;
  const improvementProjects = data.supplierCostImprovementProjects ?? [];
  const improvementResults = improvementProjects.map(project => {
    const linkedCosts: VerifiedExtraCost[] = procurementRecords.flatMap(record => record.fulfillment?.events?.filter(event => event.kind === 'cost_impact' && event.costProjectId === project.id).map(event => ({ supplierId: record.fulfillment!.lines.find(line => line.lineId === event.lineId)?.supplierId || '', skuMasterId: project.skuMasterId, period: event.date.slice(0, 7), amount: event.extraCostAmount || 0, verified: event.costVerificationStatus === 'verified', includedInSettlement: event.includedInSettlement, projectId: project.id })) ?? []);
    return { project, result: calculateSupplierCostImprovement(project, data.monthlyInboundSnapshots ?? [], linkedCosts) };
  });
  const realizedSavings = improvementResults.length && improvementResults.every(item => item.result.netSavings !== undefined) ? improvementResults.reduce((sum, item) => sum + (item.result.netSavings || 0), 0) : undefined;
  const layersConfig = [
    { id: 'supply' as const, label: '供给保障', count: layers.supply.length ? `${layers.supply.filter(row => row.singleSource).length} 个单一来源` : '未采集' },
    { id: 'delivery' as const, label: '交付履约', count: procurementRecords.length ? `${layers.delivery.length} 条订单行` : '未采集' },
    { id: 'quality' as const, label: '质量与综合成本', count: inboundRecordsExist ? `${layers.quality.length} 条异常` : '未采集' },
    { id: 'cost' as const, label: '成本改善', count: layers.costChanges.length ? `${layers.costChanges.length} 条参考价` : '未采集' },
    { id: 'responsibility' as const, label: '责任闭环', count: `${decisionActions.length} 项跟进` },
  ];
  const signals = [
    { label: '单一来源暴露', value: layers.supply.length ? `${layers.supply.filter(row => row.singleSource).length} 个产品` : '未采集', layer: 'supply' as const },
    { label: '入仓未交数量', value: inboundRecordsExist ? `${layers.delivery.reduce((sum, row) => sum + row.remainingQuantity, 0)}` : '未采集', layer: 'delivery' as const },
    { label: '未关闭异常', value: inboundRecordsExist ? `${layers.quality.filter(issue => !issue.resolved).length} 条` : '未采集', layer: 'quality' as const },
    { label: '年度已实现净降本', value: realizedSavings === undefined ? '未采集' : money(realizedSavings), layer: 'cost' as const },
    { label: '逾期责任事项', value: `${overdueActions} 项`, layer: 'responsibility' as const },
  ];
  const metricDefinitions: Record<string, string> = {
    '单一来源暴露': '所选月度入仓记录中，仅有一家实际供方的产品数。未关联来源时不参与判断。',
    '入仓未交数量': '已登记入仓采购单行的订购数量减累计实收数量；月度入仓汇总不能反推未交。',
    '未关闭异常': '已登记采购履约异常中，尚无处理关闭记录的条数。未登记不等于无异常。',
    '年度已实现净降本': '同供应商、同 SKU 可比基准价与实际采购价之差乘实际入仓数量，再扣除已核实且未计入结算的增量费用。',
    '逾期责任事项': '已登记且未关闭、期限早于今天的责任事项；未登记不等于无风险。',
  };
  const focusLayer = (layer: typeof activeLayer) => {
    setActiveLayer(layer);
    document.getElementById('supplier-active-decision-theme')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  return <>
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">供应商管理决策总览</h2><p className="mt-1 text-sm text-muted">指标只覆盖当前已登记并关联的业务记录；缺少来源或基准时明确显示未采集。</p></div><label className="flex items-center gap-2 text-sm">入仓成本月份<select aria-label="入仓成本月份" className={`${input} !mt-0 !w-auto`} value={period} onChange={event => setSelection(event.target.value)}>{!periods.length && <option value="">未采集</option>}{periods.map(value => <option key={value}>{value}</option>)}</select></label></div>
      <div className="mt-5 overflow-x-auto rounded-md border border-line">
        <table aria-label="管理决策信号" className="w-full min-w-[880px] table-fixed text-left">
          <thead><tr>{signals.map(signal => <th key={signal.label} className="border-b border-r border-line bg-paper px-4 py-3 text-xs font-medium text-muted last:border-r-0">{signal.label} <span aria-label={`${signal.label}口径说明`} title={metricDefinitions[signal.label]} className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-line text-[10px]">?</span></th>)}</tr></thead>
          <tbody><tr>{signals.map(signal => <td key={signal.label} className="border-r border-line p-0 align-top last:border-r-0"><button type="button" aria-label={`${signal.label}：${signal.value}`} onClick={() => focusLayer(signal.layer)} className="h-full min-h-20 w-full px-4 py-4 text-left text-base font-semibold hover:bg-action-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-action">{signal.value}<span className="mt-2 block text-xs font-normal text-action">查看依据 →</span></button></td>)}</tr></tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">入仓/成本按所选月度快照；采购交付按已登记采购单；代发按已归档周期；各自口径不混算。总监只读查看。</p>
    </section>
    <nav aria-label="供应商决策主题" role="tablist" className="flex gap-2 overflow-x-auto rounded-lg border border-line bg-surface p-2">{layersConfig.map(layer => <button key={layer.id} type="button" role="tab" aria-selected={activeLayer === layer.id} className={`min-w-40 flex-1 rounded-md px-3 py-3 text-left ${activeLayer === layer.id ? 'bg-action-soft text-action' : 'text-muted hover:bg-paper'}`} onClick={() => setActiveLayer(layer.id)}><span className="block whitespace-nowrap text-sm font-medium">{layer.label}</span><span className="mt-1 block text-xs">{layer.count}</span></button>)}</nav>
    <div id="supplier-active-decision-theme">
    {activeLayer === 'supply' && <section role="region" aria-label="供给保障" className="rounded-lg border border-line bg-surface p-5"><div><h2 className="text-lg font-semibold">供给保障</h2><p className="mt-1 text-xs text-muted">集中度是供给暴露，不等同供方绩效差；登记备选不等于已验证可替代。</p></div>{layers.supply.length ? <div className="mt-4 overflow-x-auto"><table aria-label="供给保障" className={`${procurementTable} min-w-[900px]`}><thead><tr>{['产品', '实际供方数', '最大供方占比', '本期实际供方', '登记备选 / 已验证替代', '处理入口'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{layers.supply.map(row => <tr key={row.productKey}><td>{row.productName}</td><td>{row.actualSupplierCount}{row.singleSource && <div className="mt-1 text-xs text-warning">单一来源暴露</div>}</td><td>{percent(row.maxSupplierShare)}</td><td>{row.actualSupplierNames.join('、') || '供应商待关联'}</td><td>{row.registeredBackupCount} 家已登记 / {row.verifiedBackupCount} 家已验证</td><td><Link className="mr-3 text-action" href="/product-master">维护供货关系</Link><Link className="text-action" href={`/supplier-records?kind=purchase&snapshotIds=${encodeURIComponent(row.sourceSnapshotIds.join(','))}`}>查看来源</Link></td></tr>)}</tbody></table></div> : <EmptyLayer message={`${period || '所选月份'}暂无入仓供给快照；供给集中度未采集。`} href="/product-master" action="查看入仓产品" />}</section>}
    {activeLayer === 'delivery' && <section role="region" aria-label="交付履约" className="rounded-lg border border-line bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">交付履约</h2><p className="mt-1 text-xs text-muted">入仓采购与代发周期分开判断，不共用分母或绩效指标。</p></div><div role="group" aria-label="履约业务类型" className="flex gap-2"><button type="button" aria-pressed={deliveryMode === 'warehouse'} className={deliveryMode === 'warehouse' ? primary : button} onClick={() => setDeliveryMode('warehouse')}>入仓采购</button><button type="button" aria-pressed={deliveryMode === 'dropship'} className={deliveryMode === 'dropship' ? primary : button} onClick={() => setDeliveryMode('dropship')}>代发周期</button></div></div>
      {deliveryMode === 'warehouse' ? <><p className="mt-3 text-xs text-muted">展示采购行实际发货/收货和履约时长；仅当同一 SKU 的承诺到货日和实际到货日均已采集，才判断准时。</p>{layers.delivery.length ? <div className="mt-4 overflow-x-auto"><table aria-label="交付履约" className={`${procurementTable} min-w-[1180px]`}><thead><tr>{['采购单 / 产品', '供应商', '负责人', '下单日', '承诺到货', '实际发货 / 到货', '下单至实际到货', '订购 / 发货 / 到货 / 未交'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{layers.delivery.map(row => <tr key={`${row.procurementId}:${row.lineId}`}><td>{row.orderNo}<div className="mt-1 text-xs text-muted">{row.productName}</div></td><td>{row.supplierName}</td><td>{row.owner}</td><td>{row.orderDate || '未采集'}</td><td>{row.promisedArrivalDate || '承诺到货未采集'}</td><td>{row.actualShipmentDate || '未发货'} / {row.actualArrivalDate || '未到货'}</td><td>{row.observedLeadDays == null ? '未完成收货' : `${row.observedLeadDays} 天`}</td><td>{row.orderedQuantity} / {row.shippedQuantity} / {row.receivedQuantity} / 未交 {row.remainingQuantity}</td></tr>)}</tbody></table></div> : <EmptyLayer message="暂无已登记的入仓采购履约订单行；该范围的交付事实未采集。" href="/procurement/fulfillment" action="查看采购履约" />}{directorOverview.nativePerformance.filter(snapshot => snapshot.businessMode === 'inbound').length > 0 && <div className="mt-5"><NativeSupplierPerformancePanel snapshots={directorOverview.nativePerformance.filter(snapshot => snapshot.businessMode === 'inbound')} /></div>}</> : <><DropshipDecisionPanel summary={dropship} />{directorOverview.nativePerformance.filter(snapshot => snapshot.businessMode === 'dropship').length > 0 && <div className="mt-5"><NativeSupplierPerformancePanel snapshots={directorOverview.nativePerformance.filter(snapshot => snapshot.businessMode === 'dropship')} /></div>}</>}
    </section>}
    {activeLayer === 'delivery' && selectedNativePerformance.length === 0 && <NativeSupplierPerformancePanel snapshots={[]} />}
    {activeLayer === 'quality' && <section role="region" aria-label="质量与综合成本" className="rounded-lg border border-line bg-surface p-5"><div><h2 className="text-lg font-semibold">质量与综合成本</h2><p className="mt-1 text-xs text-muted">异常来自采购履约记录；进入采购履约“办理履约”登记处理、关联增量费用。预计费用不进入实绩，已计入结算的费用不会重复扣减。</p></div>{layers.quality.length ? <div className="mt-4 overflow-x-auto"><table aria-label="质量与综合成本" className={`${procurementTable} min-w-[1100px]`}><thead><tr>{['订单 / 产品', '供应商', '异常日期 / 类型', '数量', '责任', '依据 / 处理', '已核实结算外费用', '结算口径', '录入入口'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{layers.quality.map(issue => <tr key={issue.id}><td>{issue.orderNo}<div className="mt-1 text-xs text-muted">{issue.productName}</div></td><td>{issue.supplierName}</td><td>{issue.date} · {issue.issueType}</td><td>{issue.quantity ?? '未采集'}</td><td>{issue.responsibility}</td><td>{issue.evidence}{issue.resolved ? ' · 已关闭' : ' · 待关闭'}</td><td>{issue.verifiedExtraCost == null ? '未采集' : money(issue.verifiedExtraCost)}</td><td>{issue.costInclusionStatus}</td><td><Link aria-label={`打开${issue.orderNo} ${issue.issueType}异常来源`} className="text-action" href={issue.sourceHref}>查看并办理 →</Link></td></tr>)}</tbody></table></div> : <div className="mt-4 rounded-md border border-dashed border-line bg-paper/40 p-5"><p className="font-medium">{inboundRecordsExist ? '当前已登记采购记录中没有质量异常' : '质量异常记录未采集'}</p><p className="mt-1 text-sm text-muted">此判断只覆盖已登记记录，不代表完整批次质量合格率。发现异常后在采购履约单中登记，录入后会自动归入此处。</p><Link className={`${button} mt-3`} href="/procurement/fulfillment">进入采购履约 →</Link></div>}</section>}
    {activeLayer === 'cost' && <section role="region" aria-label="成本改善" className="rounded-lg border border-line bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">年度成本改善</h2><p className="mt-1 text-xs text-muted">机会值是目标差额，不是实绩；已实现净降本只按同供应商、同 SKU、有效期内的实际入仓数量及可比结算价计算，已纳入结算的异常费用不重复扣减。</p></div><div className="flex gap-2"><Link className={button} href="/supplier-lifecycle/improvements">查看项目台账</Link><Link className={primary} href="/supplier-lifecycle/improvements/new">新建降本项目 →</Link></div></div><div className="mt-4 grid overflow-hidden border border-line sm:grid-cols-2"><div className="border-b border-line p-4 sm:border-b-0 sm:border-r"><p className="text-xs text-muted">进行中改善项目</p><p className="mt-2 text-xl font-semibold">{improvementProjects.filter(project => project.status === 'active').length} 项</p></div><div className="p-4"><p className="text-xs text-muted">年度已实现净降本</p><p className="mt-2 text-xl font-semibold">{realizedSavings === undefined ? '未采集' : money(realizedSavings)}</p></div></div>{improvementResults.length ? <div className="mt-4 overflow-x-auto"><table aria-label="年度成本改善项目摘要" className={`${procurementTable} min-w-[1000px]`}><thead><tr>{['项目 / 负责人', '供应商 / SKU', '基准 → 目标', '实际采购单价', '实际入仓量', '已实现净降本', '判断 / 来源'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{improvementResults.map(({project, result})=>{const supplier=data.suppliers.find(item=>item.id===project.supplierId);const sku=data.skuMasters?.find(item=>item.id===project.skuMasterId);return <tr key={project.id}><td>{project.title}<div className="mt-1 text-xs text-muted">{project.owner} · {project.effectiveFrom} 至 {project.effectiveTo}</div></td><td>{supplier?.shortName||supplier?.name||'供应商缺失'}<div className="mt-1 text-xs text-muted">{sku?.shortName||sku?.productName||project.skuMasterId}</div></td><td>{money(project.baselineUnitPrice)} → {money(project.targetUnitPrice)}</td><td>{money(result.actualUnitPrice)}</td><td>{result.quantity||'未采集'}</td><td>{money(result.netSavings)}</td><td>{result.status}<div className="mt-1"><Link className="text-action" href="/supplier-records?kind=purchase">查看入仓来源 →</Link></div></td></tr>})}</tbody></table></div> : <EmptyLayer message="尚无年度成本改善项目。创建项目时绑定供应商、SKU、基准价与可比凭证；实际履约数据不会重复录入。" href="/supplier-lifecycle/improvements/new" action="建立降本项目" />}</section>}
    {activeLayer === 'responsibility' && <section role="region" aria-label="责任闭环" className="rounded-lg border border-line bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">本期需跟进 · 责任闭环</h2><p className="mt-1 text-xs text-muted">只汇集已关联来源依据的待跟进事项；代发经营指标在履约主题中独立查看。</p></div><Badge warning={decisionActions.length > 0}>{decisionActions.length} 项跟进</Badge></div>{decisionActions.length ? <div className="mt-4 overflow-x-auto"><table aria-label="本期需跟进" className={`${procurementTable} min-w-[1080px]`}><thead><tr>{['事项 / 证据', '业务', '供应商 / 产品', '负责人 / 期限', '下一步动作', '来源与处理'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{decisionActions.map(action => <tr key={action.id}><td>{action.title}<div className="mt-1 text-xs text-muted">{action.evidence}</div></td><td>{lifecycleActionLabel(action)}</td><td>{action.supplierName}<div className="mt-1 text-xs text-muted">{action.productScope}</div></td><td>{action.owner}<div className="mt-1 text-xs text-muted">{action.dueDate}</div></td><td>{action.nextAction}</td><td><Link className="mr-3 text-action" href={action.sourceHref}>查看依据</Link><Link className="text-action" href={action.actionHref}>打开跟进 →</Link></td></tr>)}</tbody></table></div> : <div className="py-7"><p className="text-sm text-muted">暂无符合关注规则且有来源依据的跟进事项；这不等于所有供应商无风险。</p><Link className={`${button} mt-3`} href="/supplier-lifecycle/performance/new">登记跟进事项 →</Link></div>}</section>}
    </div>
  </>;
}
function EmptyLayer({ message, href, action }: { message: string; href: string; action: string }) {
  return <div className="mt-4 rounded-md border border-dashed border-line bg-paper/40 p-5"><p className="text-sm text-muted">{message}</p><Link className={`${button} mt-3`} href={href}>{action} →</Link></div>;
}

function DropshipDecisionPanel({ summary, showRiskRows = true }: { summary: DropshipDecisionSummary; showRiskRows?: boolean }) {
  return <section className="rounded-lg border border-line bg-surface p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">代发经营监控</h2><span title="取最新已归档周期。正式风险判断要求周期订单量至少20单；风险阈值依据当前系统规则，显示的数值来自原始周期数据。" aria-label="代发风险口径说明" className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-line text-xs text-muted">?</span></div>{summary.periodEnd && <p className="mt-1 text-xs text-muted">最新归档周期：{summary.periodLabel}</p>}</div>{summary.pendingActiveCount > 0 && <Link className={button} href="/supplier-records?kind=dropship_period#pending-dropship">处理 {summary.pendingActiveCount} 条待建档 →</Link>}</div>
    {summary.periodEnd ? <div className="mt-5 grid overflow-hidden border border-line bg-surface sm:grid-cols-2 xl:grid-cols-4">{[['周期订单量',String(summary.totalOrders)],['周期 GMV',`¥${summary.totalGmv.toFixed(2)}`],['加权 48H 揽收率',summary.weightedPickup48Rate == null ? '未采集' : `${summary.weightedPickup48Rate.toFixed(1)}%`],['加权退款率',summary.weightedRefundRate == null ? '未采集' : `${summary.weightedRefundRate.toFixed(1)}%`]].map(([label,value])=><div className="border-b border-line p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0" key={label}><p className="text-xs text-muted">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}</div> : <p className="py-6 text-sm text-muted">尚无已确认归档的代发周期数据。</p>}
    <div className="mt-4 flex flex-wrap gap-3 text-xs"><Badge>{summary.scoreableCount} 家可评价</Badge><Badge warning={summary.riskCount > 0}>{summary.riskCount} 家需关注</Badge><Badge warning={summary.missingDataCount > 0}>{summary.missingDataCount} 家数据待补</Badge><Badge>{summary.trendLabel}</Badge><Badge warning={summary.pendingActiveCount > 0}>{summary.pendingActiveCount} 家待建档</Badge><Badge>{summary.pendingInsufficientCount} 家样本不足</Badge></div>
    {showRiskRows && (summary.risks.length ? <div className="mt-5 overflow-x-auto"><table aria-label="代发风险供应商" className={`${procurementTable} min-w-[1120px]`}><thead><tr>{['供应商 / 周期','订单量 / GMV','48小时揽收率','支签时长','退款率 / 拒退率','3分钟响应率','风险依据','建议动作'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{summary.risks.map(item=><tr key={item.supplierId}><td><Link className="text-action" href={`/suppliers/${item.supplierId}`}>{item.supplierName}</Link><Link className="mt-1 block text-xs text-action" aria-label={`核对${item.supplierName}原始记录`} href={`/supplier-records?supplierId=${encodeURIComponent(item.supplierId)}&kind=dropship_period&recordId=${encodeURIComponent(item.sourceRecordId)}`}>{summary.periodLabel} · 核对来源</Link></td><td>{item.paidOrders} 单 / ¥{item.gmv.toFixed(2)}</td><td>{item.metrics.pickup48Rate == null ? '未采集' : `${item.metrics.pickup48Rate}%`}</td><td>{item.metrics.paymentToSignHours == null ? '未采集' : `${item.metrics.paymentToSignHours} 小时`}</td><td>{item.metrics.refundRate == null ? '未采集' : `${item.metrics.refundRate}%`} / {item.metrics.rejectReturnRate == null ? '未采集' : `${item.metrics.rejectReturnRate}%`}</td><td>{item.metrics.response3mRate == null ? '未采集' : `${item.metrics.response3mRate}%`}</td><td><div className="flex min-w-48 flex-wrap gap-1.5">{item.reasons.map(reason=><span key={reason} className="rounded border border-danger-soft bg-danger-soft/40 px-2 py-1 text-xs text-danger">{reason}</span>)}</div></td><td><Link className="text-action" aria-label={`为${item.supplierName}提出处理建议`} href={`/supplier-lifecycle/performance/new?supplierId=${encodeURIComponent(item.supplierId)}&businessMode=dropship&sourceRecordId=${encodeURIComponent(item.sourceRecordId)}&riskReason=${encodeURIComponent(item.reasons.join('；'))}`}>负责人提出建议 →</Link></td></tr>)}</tbody></table></div> : <p className="py-6 text-sm text-muted">当前最新周期没有达到正式判断门槛的风险记录。</p>)}
  </section>;
}

const nativeMetricNames: Record<string, string> = {
  qualityPassRate: '质检合格率', purchaseReturnRate: '采购退货率',
  onTimeDeliveryRateCount: '到货准时率（次数）', onTimeDeliveryRateQuantity: '到货准时率（数量）',
  shortageRateCount: '缺货率（次数）', shortageRateQuantity: '缺货率（数量）',
  overDeliveryRateCount: '多送率（次数）', overDeliveryRateQuantity: '多送率（数量）',
};

function NativeSupplierPerformancePanel({ snapshots }: { snapshots: Array<NativeSupplierPerformanceSnapshot & { supplierName: string }> }) {
  return <section className="rounded-lg border border-line bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">聚水潭原生绩效结果</h2><p className="mt-1 text-xs text-muted">按业务类型、供应商和评分周期保留原始结果；不与工作台风险规则或自定义评分混算。</p></div><span title="聚水潭评分方案允许配置权重；只有导入实际评分结果后才显示得分。工作台不会根据方案配置自行重算。" aria-label="原生绩效口径说明" className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-line text-xs text-muted">?</span></div>
    {snapshots.length ? <div className="mt-4 overflow-x-auto"><table aria-label="聚水潭原生绩效结果" className={`${procurementTable} min-w-[1050px]`}><thead><tr>{['业务', '供应商', '评分周期', '评分方案 / 版本', '原始得分 / 等级', '方案指标原值', '来源批次'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{snapshots.map(snapshot => <tr key={snapshot.id}><td>{snapshot.businessMode === 'inbound' ? '入仓' : '代发'}</td><td><Link className="text-action" href={`/suppliers/${snapshot.supplierId}`}>{snapshot.supplierName}</Link></td><td>{snapshot.periodStart} 至 {snapshot.periodEnd}</td><td>{snapshot.schemeName}{snapshot.schemeVersion ? ` · ${snapshot.schemeVersion}` : ''}</td><td>{snapshot.totalScore == null ? '未采集' : `${snapshot.totalScore} 分`}{snapshot.grade ? ` · ${snapshot.grade}` : ''}</td><td>{Object.entries(snapshot.metrics).length ? <div className="flex max-w-[420px] flex-wrap gap-2">{Object.entries(snapshot.metrics).map(([key, value]) => <span key={key} className="rounded bg-paper px-2 py-1 text-xs">{nativeMetricNames[key] ?? key} {value == null ? '未采集' : `${value}${key.toLowerCase().includes('rate') ? '%' : ''}`}</span>)}</div> : '未采集'}</td><td>{snapshot.sourceFileName || snapshot.sourceSystem} · {snapshot.importBatchId}</td></tr>)}</tbody></table></div> : <div className="mt-4 rounded-md border border-dashed border-line bg-paper/40 p-5"><p className="font-medium">目前只有评分方案配置，尚未导入评分结果。</p><p className="mt-1 text-sm text-muted">方案权重和指标配置不是供应商绩效结果；这里不会推算分数，也不代表供应商无风险。待取得聚水潭评分结果表或接口字段后，按原始业务类型、周期和方案版本导入。</p></div>}
  </section>;
}

function RecordList({ data, section }: { data: LocalWorkbenchData; section: LifecycleSection }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const all = (data.supplierLifecycleRecords ?? []).filter(r => r.section === section);
  const records = all.filter(r => (!status || r.status === status) && [r.title, r.productScope, ...r.supplierIds.map(id => data.suppliers.find(s => s.id === id)?.name ?? '')].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <section className={panel}><div className="flex flex-wrap items-center gap-3"><input aria-label="搜索事项" placeholder="搜索事项、产品或供应商" className={`${input} !mt-0 max-w-sm`} value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="筛选状态" className={`${input} !mt-0 !w-auto`} value={status} onChange={e => setStatus(e.target.value)}><option value="">全部状态</option>{Object.entries(statusNames).map(([key, name]) => <option key={key} value={key}>{key === 'completed' ? lifecycleSections[section].done : name}</option>)}</select><span className="text-xs text-muted">{all.length} 条记录</span></div>{!records.length ? <div className="py-16 text-center"><h2 className="font-medium">{all.length ? '没有匹配的事项' : '尚未建立事项'}</h2><p className="mt-2 text-sm text-muted">{all.length ? '调整搜索或状态筛选。' : '新建时先写事项名称和产品范围，其余信息随执行补充。'}</p></div> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-line text-xs text-muted"><tr>{['事项／产品范围', '供应商', '状态', '下一步', '负责人／期限', ''].map((h, i) => <th key={i} className="p-3">{h}</th>)}</tr></thead><tbody>{records.map(r => <tr className="border-b border-line" key={r.id}><td className="max-w-xs p-3"><Link href={recordUrl(r)} className="font-medium text-action">{r.priority === 'high' ? '重点 · ' : ''}{r.title}</Link><p className="mt-1 truncate text-xs text-muted">{r.productScope}</p></td><td className="max-w-48 p-3">{r.supplierIds.map(id => data.suppliers.find(s => s.id === id)?.name ?? '档案已缺失').join('、') || '待选择'}</td><td className="p-3"><Status record={r} /></td><td className="max-w-60 p-3">{isOpen(r) ? r.nextAction || '待明确' : r.result || '—'}</td><td className="p-3"><p>{r.owner || '待指定'}</p><p className={`mt-1 text-xs ${overdue(r) ? 'text-danger' : 'text-muted'}`}>{r.dueDate || '未设期限'}{overdue(r) ? ' · 逾期' : ''}</p></td><td className="p-3"><Link href={recordUrl(r)} className="text-action">查看</Link></td></tr>)}</tbody></table></div>}</section>;
}

function RecordDetail({ data, record: r, saved }: { data: LocalWorkbenchData; record: LifecycleRecord; saved?: boolean }) {
  const config = lifecycleSections[r.section];
  const source = data.supplierLifecycleRecords?.find(s => s.id === r.sourceId);
  const children = data.supplierLifecycleRecords?.filter(s => s.sourceId === r.id) ?? [];
  return <>
    {saved && <p role="status" className="rounded-xl bg-action-soft p-4 text-sm">已保存到本机。云端同步结果请查看工作台同步状态。</p>}
    {r.hasConflict && <p role="alert" className="rounded-xl bg-warning-soft p-4 text-sm">发现不同设备的并行修改，双方版本已保留在下方修改记录中。当前结论需重新核对，请编辑并确认，不要据此直接执行。</p>}
    <section className={panel}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 flex gap-2"><Status record={r} />{r.priority === 'high' && <Badge warning>重点事项</Badge>}</div><h2 className="text-xl font-semibold">{r.title}</h2><p className="mt-2 text-sm text-muted">{r.productScope}</p></div><div className="flex gap-2"><Link className={button} href={`${root}/${r.section}`}>返回列表</Link><Link className={primary} href={`${recordUrl(r)}/edit`}>编辑记录</Link></div></div><dl className="mt-6 grid gap-5 border-t border-line pt-5 md:grid-cols-3"><Value label="关联供应商">{r.supplierIds.length ? r.supplierIds.map(id => <Link key={id} className="mr-3 text-action" href={`/suppliers/${id}`}>{data.suppliers.find(s => s.id === id)?.name ?? '档案已缺失'}</Link>) : '尚未选择'}</Value><Value label="负责人／期限">{r.owner || '待指定'} · {r.dueDate || '未设期限'}{overdue(r) ? '（已逾期）' : ''}</Value><Value label="下一步">{isOpen(r) ? r.nextAction || '尚未明确' : '本事项已结束'}</Value></dl></section>
    <section className={panel}><h3 className="mb-4 font-semibold">结论与依据</h3><dl className="space-y-5">{r.section === 'sourcing' && <Value label="入围供应商">{r.selectedSupplierIds?.map(id => data.suppliers.find(s => s.id === id)?.name ?? '档案已缺失').join('、') || '尚未决定'}</Value>}<Value label="当前结论">{r.result || '尚未记录结论'}</Value><Value label="证据／书面确认">{r.evidence || '尚未记录依据，不能据此认定已完成验证'}</Value></dl></section>
    {config.fields.some(([key]) => r.fields[key]?.trim()) && <section className={panel}><h3 className="mb-5 font-semibold">已记录的执行内容</h3><dl className="grid gap-6 md:grid-cols-2">{config.fields.filter(([key]) => r.fields[key]?.trim()).map(([key, label]) => <Value key={key} label={label}>{r.fields[key]}</Value>)}</dl></section>}
    {!!r.offerIds.length && <section className={panel}><h3 className="mb-4 font-semibold">关联报价 · 仅供比价，不计入实际采购额</h3><div className="divide-y divide-line">{r.offerIds.map(id => { const offer = data.offers.find(o => o.id === id); return <div className="flex flex-wrap justify-between gap-3 py-3 text-sm" key={id}><span>{offer?.name ?? '报价已缺失'} · {data.suppliers.find(s => s.id === offer?.supplierId)?.name ?? offer?.supplierName}</span><span>{offer?.quotedPrice || offer?.taxedUnitPrice || '请查看报价明细'} · {offer?.leadTime || '交期待确认'}</span></div>; })}</div><Link className={`${button} mt-3`} href="/offers">查看货盘报价</Link></section>}
    <section className={panel}><h3 className="mb-4 font-semibold">业务关联</h3>{source && <p className="mb-3 text-sm">来源：<Link className="text-action" href={recordUrl(source)}>{source.title} · {lifecycleSections[source.section].title}</Link></p>}{children.map(child => <p key={child.id} className="mb-3 text-sm"><Link className="text-action" href={recordUrl(child)}>{lifecycleSections[child.section].title} · {child.title}</Link></p>)}{r.status === 'completed' && !r.hasConflict && config.next ? <Link className={button} href={`${root}/${config.next}/new?from=${encodeURIComponent(r.id)}`}>基于此记录新建{lifecycleSections[config.next].title}</Link> : <p className="text-sm text-muted">关联记录承接供应商和产品范围，不自动替你确认准入或合作。</p>}</section>
    <details className={panel}><summary className="cursor-pointer text-sm">修改记录 · 当前第 {r.revision} 版 · {new Date(r.updatedAt).toLocaleString('zh-CN')}　展开</summary><p className="mt-3 text-xs text-muted">保留业务记录的旧版本；此记录不是审批签章。</p>{!r.history.length && <p className="mt-3 text-sm text-muted">首次创建，暂无旧版本。</p>}{r.history.map(v => <details key={v.revision} className="mt-4 border-t border-line pt-3"><summary className="cursor-pointer text-sm">第 {v.revision} 版 · {statusNames[v.status]} · {new Date(v.updatedAt).toLocaleString('zh-CN')}</summary><dl className="mt-4 space-y-3"><Value label="事项／范围">{v.title} · {v.productScope}</Value><Value label="结论">{v.result || '未记录'}</Value><Value label="依据">{v.evidence || '未记录'}</Value>{config.fields.filter(([k]) => v.fields[k]).map(([k, label]) => <Value key={k} label={label}>{v.fields[k]}</Value>)}</dl></details>)}</details>
  </>;
}

function RecordEditor({ data, section, record, source, supplierId, businessMode }: { data: LocalWorkbenchData; section: LifecycleSection; record?: LifecycleRecord; source?: LifecycleRecord; supplierId?: string; businessMode?: 'inbound' | 'dropship' }) {
  const router = useRouter();
  const [draft, setDraft] = useState<LifecycleRecord>(() => {
    const ids = source?.section === 'sourcing' ? source.selectedSupplierIds ?? [] : source?.supplierIds ?? [];
    return record ?? { ...emptyLifecycleRecord(section), supplierIds: supplierId && data.suppliers.some(item => item.id === supplierId) ? [supplierId] : [], businessMode, ...(source ? { title: source.title, productScope: source.productScope, supplierIds: [...ids], offerIds: source.offerIds.filter(id => data.offers.some(o => o.id === id && o.supplierId && ids.includes(o.supplierId))), sourceId: source.id, priority: source.priority, owner: source.owner, businessMode: source.businessMode } : {}) };
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  useEffect(() => {
    function guard(e: MouseEvent) {
      const anchor = e.target instanceof Element ? e.target.closest('a') : null;
      if (!dirty || !anchor || anchor.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      if (!window.confirm('有未保存的修改，确定离开并放弃吗？')) { e.preventDefault(); e.stopPropagation(); }
    }
    document.addEventListener('click', guard, true);
    return () => document.removeEventListener('click', guard, true);
  }, [dirty]);
  const update = (patch: Partial<LifecycleRecord>) => { setDraft(d => ({ ...d, ...patch, ...(patch.supplierIds ? { selectedSupplierIds: (d.selectedSupplierIds ?? []).filter(id => patch.supplierIds!.includes(id)) } : {}) })); setDirty(true); };
  const config = lifecycleSections[section];
  const text = (key: 'title' | 'productScope' | 'owner' | 'dueDate' | 'nextAction' | 'result' | 'evidence', label: string, multiline = false, required = false) => <label className="block text-sm">{label}{multiline ? <textarea className={input} rows={3} required={required} value={draft[key]} onChange={e => update({ [key]: e.target.value })} /> : <input className={input} type={key === 'dueDate' ? 'date' : 'text'} required={required} value={draft[key]} onChange={e => update({ [key]: e.target.value })} />}</label>;
  function save(e: React.FormEvent) {
    e.preventDefault(); if (saving) return; setError('');
    try { const saved = saveLifecycleRecord(draft); setDirty(false); setSaving(true); router.push(`${recordUrl(saved)}?saved=1`); }
    catch (e) { setError(e instanceof Error ? e.message : '保存失败，请重试'); }
  }
  const quotes = data.offers.filter(o => o.supplierId && draft.supplierIds.includes(o.supplierId));
  return <form onSubmit={save} className="space-y-5">
    {record?.hasConflict && <section className={`${panel} bg-warning-soft`}><p className="mb-3 text-sm">有并行修改，请在详情页的修改记录中对照双方版本后再保存。</p><label className="text-sm"><input type="checkbox" checked={!draft.hasConflict} onChange={e => update({ hasConflict: !e.target.checked })} /> 我已核对冲突版本，当前内容是确认后的结果</label></section>}
    {draft.supplierIds.some(id => !data.suppliers.some(s => s.id === id)) && <section className={panel}><p className="mb-3 text-sm text-danger">部分供应商档案已缺失，请移除失效关联后重新选择。</p><button className={button} type="button" onClick={() => update({ supplierIds: draft.supplierIds.filter(id => data.suppliers.some(s => s.id === id)), offerIds: draft.offerIds.filter(id => data.offers.some(o => o.id === id && o.supplierId && data.suppliers.some(s => s.id === o.supplierId))) })}>移除失效关联</button></section>}
    <section className={panel}><h2 className="font-semibold">{record ? '编辑事项' : '新建事项'}</h2><p className="mt-2 text-xs text-muted">仅带 * 的项目为草稿必填。完成时再检查关键结果和依据；不适用的内容不用填。</p>{source && <p className="mt-3 text-sm text-action">承接自：{source.title}（只继承范围与关联，不继承完成状态）</p>}<div className="mt-5 grid gap-5 md:grid-cols-2">{text('title', '事项名称 *', false, true)}{text('productScope', '产品／SKU范围 *', false, true)}{['agreements', 'performance'].includes(section) && <label className="block text-sm">适用业务<select aria-label="事项适用业务" className={input} value={draft.businessMode ?? ''} onChange={e => update({ businessMode: e.target.value ? e.target.value as 'inbound' | 'dropship' : undefined })}><option value="">待明确</option><option value="inbound">采购入仓</option><option value="dropship">一件代发</option></select></label>}<label className="block text-sm">状态<select className={input} value={draft.status} onChange={e => update({ status: e.target.value as LifecycleStatus })}>{Object.entries(statusNames).map(([key, name]) => <option value={key} key={key}>{key === 'completed' ? config.done : name}</option>)}</select></label><label className="block text-sm">重要性<select className={input} value={draft.priority} onChange={e => update({ priority: e.target.value as 'normal' | 'high' })}><option value="normal">常规</option><option value="high">重点</option></select></label>{text('owner', '负责人')}{text('dueDate', '处理期限')}</div></section>
    <section className={panel}><h3 className="font-semibold">关联现有资料</h3><p className="mt-2 text-xs text-muted">寻源可选多家候选；准入与合作请明确本次决定适用哪些供应商和产品。</p><fieldset className="mt-4"><legend className="text-sm">供应商</legend><div className="mt-3 grid max-h-52 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{data.suppliers.filter(s => !s.archivedAt || draft.supplierIds.includes(s.id)).map(s => <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.supplierIds.includes(s.id)} onChange={e => { const ids = e.target.checked ? [...draft.supplierIds, s.id] : draft.supplierIds.filter(id => id !== s.id); update({ supplierIds: ids, offerIds: draft.offerIds.filter(id => data.offers.some(o => o.id === id && o.supplierId && ids.includes(o.supplierId))) }); }} />{s.name}</label>)}</div></fieldset>{!data.suppliers.length && <p className="mt-3 text-sm text-muted">尚无供应商档案。可以先保存草稿，再到供应商档案新增。</p>}<p className="mt-4"><Link href="/suppliers" target="_blank" className="text-sm text-action">另页查看供应商档案 ↗</Link></p>{!!quotes.length && <fieldset className="mt-5 border-t border-line pt-4"><legend className="text-sm">报价记录（可选）</legend><div className="max-h-48 space-y-3 overflow-y-auto">{quotes.map(o => <label key={o.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.offerIds.includes(o.id)} onChange={e => update({ offerIds: e.target.checked ? [...draft.offerIds, o.id] : draft.offerIds.filter(id => id !== o.id) })} />{o.name} · {data.suppliers.find(s => s.id === o.supplierId)?.name} · {o.quotedPrice || '查看原报价'}</label>)}</div></fieldset>}</section>
    <section className={panel}><h3 className="mb-5 font-semibold">本环节执行内容</h3><div className="grid gap-5 md:grid-cols-2">{config.fields.map(([key, label, hint]) => <label key={key} className="block text-sm">{label}<textarea className={input} rows={4} value={draft.fields[key] ?? ''} placeholder={hint} onChange={e => update({ fields: { ...draft.fields, [key]: e.target.value } })} /></label>)}</div></section>
    {section === 'sourcing' && draft.supplierIds.length > 0 && <section className={panel}><h3 className="font-semibold">入围决定</h3><p className="mt-2 text-xs text-muted">候选不等于入围。只有这里明确选中的供应商会带入下一环节。</p><div className="mt-4 flex flex-wrap gap-4">{draft.supplierIds.map(id => <label className="flex items-center gap-2 text-sm" key={id}><input type="checkbox" checked={draft.selectedSupplierIds?.includes(id) ?? false} onChange={e => update({ selectedSupplierIds: e.target.checked ? [...(draft.selectedSupplierIds ?? []), id] : (draft.selectedSupplierIds ?? []).filter(s => s !== id) })} />{data.suppliers.find(s => s.id === id)?.name ?? '档案已缺失'}</label>)}</div></section>}
    <section className={panel}><h3 className="mb-5 font-semibold">结果与后续</h3><div className="grid gap-5 md:grid-cols-2">{text('result', '结论／决定及原因', true)}{text('evidence', '依据／证据位置', true)}</div><p className="mt-2 text-xs text-muted">填写原始记录的链接、文件名或回执编号；本版不上传附件，不把供应商口头承诺当作已验证事实。</p><div className="mt-5">{text('nextAction', '下一步动作')}</div></section>
    <footer className="sticky bottom-3 rounded-xl border border-line bg-surface p-4 shadow-lg">{error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}<div className="flex items-center justify-between gap-3"><p className="text-xs text-muted">{saving ? '已保存到本机，正在打开详情…' : dirty ? '有未保存修改' : '保存后返回只读详情'}</p><div className="flex gap-3"><button type="button" className={button} onClick={() => { if (!dirty || window.confirm('放弃本次未保存的修改？')) router.push(record ? recordUrl(record) : `${root}/${section}`); }}>取消</button><button className={primary} disabled={saving} type="submit">{saving ? '已保存' : '保存并查看'}</button></div></div></footer>
  </form>;
}
