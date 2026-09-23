'use client';
import React, { useEffect, useState } from 'react';
import { useWorkbenchData } from '@/features/workbench/workbench-store';
import { loadLocalWorkbenchData, saveLocalWorkbenchData, type LocalWorkbenchData } from '@/features/workbench/local-store';
import { inspectionChecks, newBusinessRecord, saveBusinessRecord, type InspectionCheck, type SupplierBusinessKind, type SupplierBusinessRecord } from '@/features/workbench/supplier-business';
import { loadProcurementRecords, saveProcurementRecords } from '@/features/workbench/procurement';
import { linkProcurementSupplier, mergeSupplierBusinessRecords, projectProcurementSupplierRecords } from '@/features/workbench/procurement-supplier-bridge';
import { BusinessRecordDialog, BusinessSection, BusinessFacts, businessInput, businessPrimary, businessSecondary } from './business-record-dialog';
import { procurementTable } from './procurement-line-details';
import { analyzeDropshipPeriod, dropshipMetricsFromRecord, dropshipOverview, sampleBandNames } from '@/features/workbench/dropship-period-performance';
import { recordNames as names, recordStatuses as statuses, recordGroups } from './supplier-record-fields';
import { DropshipPerformanceImportDialog } from './dropship-performance-import-dialog';
import { resolvePendingDropshipSupplier } from '@/features/workbench/dropship-decision-loop';
import type { PendingDropshipSupplier } from '@/features/workbench/dropship-performance-import';

const allKinds: SupplierBusinessKind[] = ['sample', 'inspection', 'agreement', 'purchase', 'dropship_period'];
type Props = { supplierId?: string; kinds?: SupplierBusinessKind[]; embedded?: boolean };
export function SupplierBusinessLedger({ supplierId, kinds = allKinds, embedded = false }: Props) {
  const data = useWorkbenchData();
  const [tab, setTab] = useState<SupplierBusinessKind>(() => {
    if (typeof window !== 'undefined') {
      const requested = new URLSearchParams(window.location.search).get('kind') as SupplierBusinessKind | null;
      if (requested && kinds.includes(requested)) return requested;
    }
    return kinds[0];
  });
  const [supplierFilter, setSupplierFilter] = useState(supplierId || '');
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<SupplierBusinessRecord | null>(null);
  const [viewing, setViewing] = useState<SupplierBusinessRecord | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState<{ record: SupplierBusinessRecord; masterId: string } | null>(null);
  const [importingPeriod, setImportingPeriod] = useState(false);
  const [importRevision, setImportRevision] = useState(0);
  const records = mergeSupplierBusinessRecords(data.supplierBusinessRecords ?? [], projectProcurementSupplierRecords(loadProcurementRecords(), data.suppliers));
  useEffect(() => { setSupplierFilter(supplierId || ''); setDraft(null); setViewing(null); setSelected([]); }, [supplierId]);
  const visible = records.filter(r => r.kind === tab && (!supplierFilter || r.supplierIds.includes(supplierFilter)));
  const selectedRecords = visible.filter(r => selected.includes(r.id));
  const periodMetrics = visible.filter(r => r.kind === 'dropship_period').map(dropshipMetricsFromRecord);
  const periodOverview = dropshipOverview(periodMetrics);
  const supplierName = (r: SupplierBusinessRecord) => r.supplierIds.map(id => data.suppliers.find(s => s.id === id)?.name || '关联档案缺失').join('、') || r.pendingSupplierName || '待关联供应商';
  const changeTab = (key: SupplierBusinessKind) => { setTab(key); setDraft(null); setViewing(null); setSelected([]); setError(''); };
  const change = (key: string, value: string) => setDraft(current => {
    if (!current) return current;
    if (key === '__title') return { ...current, title: value };
    if (key === '__scope') return { ...current, productScope: value };
    if (key === '__owner') return { ...current, owner: value };
    if (key === '__status') return { ...current, status: value as SupplierBusinessRecord['status'] };
    if (key === '__supplier') return { ...current, supplierIds: value ? [value] : [], fields: { ...current.fields, sampleId: '' } };
    if (key === 'sampleId') {
      const sample = records.find(r => r.id === value && r.kind === 'sample');
      return { ...current, supplierIds: sample?.supplierIds ?? current.supplierIds, productScope: sample?.productScope ?? current.productScope, fields: { ...current.fields, sampleId: value, specification: sample?.fields.specification ?? '' } };
    }
    return { ...current, fields: { ...current.fields, [key]: value } };
  });
  const save = () => {
    if (!draft || uploading) return;
    try {
      const current = loadLocalWorkbenchData();
      if (draft.supplierIds.some(id => !current.suppliers.some(s => s.id === id))) throw new Error('供应商关联已失效，请重新选择');
      const savedRecords = saveBusinessRecord(current, draft);
      saveLocalWorkbenchData({ ...current, supplierBusinessRecords: savedRecords });
      setViewing(savedRecords[0]); setDraft(null); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败，请重试'); }
  };
  const upload = async (file?: File) => {
    if (!file || !draft) return;
    setUploading(true); setError('');
    try {
      const form = new FormData(); form.set('file', file);
      const response = await fetch('/api/supplier-attachments', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '上传失败');
      const attachment = result.attachment;
      setDraft(current => current ? { ...current, attachmentIds: [...current.attachmentIds, attachment.id], fields: { ...current.fields, ['attachmentName:' + attachment.id]: file.name } } : current);
    } catch (e) { setError(e instanceof Error ? e.message : '上传失败'); } finally { setUploading(false); }
  };
  const closeEdit = () => { if (!uploading) { setDraft(null); setError(''); } };
  return <div className={embedded ? 'space-y-5' : 'mx-auto max-w-[1440px] space-y-5 py-6'}>
    {importingPeriod && <DropshipPerformanceImportDialog onClose={() => setImportingPeriod(false)} onImported={() => setImportRevision(value => value + 1)} />}
    {!embedded && <header><p className="text-xs tracking-widest text-action">供应商 · 业务记录</p><h1 className="mt-2 text-2xl font-semibold">供应商业务台账</h1><p className="mt-2 text-sm text-muted">按业务查看真实记录；按供应商追溯来源。报价资料库不自动进入当前询价。</p></header>}
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line pb-4">
      {kinds.map(key => <button className={tab === key ? 'text-sm font-semibold text-action' : 'text-sm text-muted hover:text-ink'} key={key} onClick={() => changeTab(key)} type="button">{names[key]}</button>)}
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {!supplierId && <select aria-label="按供应商筛选" className="max-w-52 rounded-md border-0 bg-paper px-3 py-2 text-sm" value={supplierFilter} onChange={e => { setSupplierFilter(e.target.value); setSelected([]); setViewing(null); setDraft(null); }}><option value="">全部供应商</option>{data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        {tab === 'dropship_period' && <button className={businessSecondary} onClick={() => setImportingPeriod(true)} type="button">批量导入周期履约</button>}
        <button className={businessPrimary} onClick={() => { setViewing(null); setError(''); setDraft(newBusinessRecord(tab, supplierFilter)); }} type="button">新增{names[tab]}</button>
      </div>
    </div>
    {tab === 'dropship_period' && <div className="grid overflow-hidden border border-line bg-surface sm:grid-cols-4"><Metric label="周期订单量" value={String(periodOverview.totalOrders)} /><Metric label="周期GMV" value={`¥${periodOverview.totalGmv.toFixed(2)}`} /><Metric label="加权48H揽收率" value={periodOverview.weightedPickup48Rate == null ? '未采集' : `${periodOverview.weightedPickup48Rate.toFixed(1)}%`} /><Metric label="风险记录" value={String(periodOverview.riskCount)} danger={periodOverview.riskCount > 0} /></div>}
    {!supplierId && records.some(record => record.pendingArchive) && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">有 {new Set(records.filter(record => record.pendingArchive).map(record => record.pendingSupplierName)).size} 家已发生履约的临时供应商待建立或关联正式档案。</div>}
    <div className="overflow-x-auto"><table className={`${procurementTable} min-w-[760px] table-fixed`}>
      <thead><tr className="border-b border-line text-xs text-muted">{['对比', '供应商 / 产品', '记录', '状态', ...(tab === 'sample' ? ['寄出 / 收到', '样品版本'] : tab === 'inspection' ? ['来源寄样', '检验结果'] : tab === 'agreement' ? ['约定版本', '供应商确认'] : tab === 'dropship_period' ? ['订单 / GMV', '履约表现'] : ['订单号', '发货 / 收货']), '操作'].map(h => <th className="px-2 py-3 font-medium" key={h}>{h}</th>)}</tr></thead>
      <tbody>{visible.map(r => <tr key={r.id} className="border-b border-line/60 hover:bg-paper/60">
        <td className="px-2 py-4"><input type="checkbox" aria-label={'选择' + (r.title || names[r.kind])} checked={selected.includes(r.id)} onChange={() => setSelected(old => old.includes(r.id) ? old.filter(id => id !== r.id) : [...old, r.id])} /></td>
        <td className="px-2 py-4">{supplierName(r)}<p className="mt-1 text-xs text-muted">{r.productScope}</p></td>
        <td className="px-2 py-4"><button type="button" className="text-action hover:underline" onClick={() => setViewing(r)}>{r.title || names[r.kind]}</button>{r.sourceType === 'procurement' && <span className="ml-2 whitespace-nowrap rounded bg-action-soft px-2 py-1 text-xs text-action">采购履约同步</span>}</td>
        <td className="px-2 py-4">{statuses[r.status]}</td>
        <td className="px-2 py-4">{tab === 'sample' ? [r.fields.sentDate || '未寄出', r.fields.receivedDate || '未签收'].join(' / ') : tab === 'inspection' ? records.find(s => s.id === r.fields.sampleId)?.title || '来源待关联' : tab === 'agreement' ? r.fields.version || '未记录' : tab === 'dropship_period' ? `${r.fields.paidOrders || 0}单 / ¥${r.fields.gmv || 0}` : r.fields.orderNo || '未记录'}</td>
        <td className="max-w-64 px-2 py-4">{tab === 'sample' ? r.fields.specification || '未记录' : tab === 'inspection' ? <span className={inspectionChecks(r).some(c => c.verdict === 'fail') ? 'text-red-600' : ''}>{checkSummary(r)}</span> : tab === 'agreement' ? r.fields.receipt || '待确认' : tab === 'dropship_period' ? <PeriodResult record={r} /> : (r.fields.shippedQuantity || '—') + ' / ' + (r.fields.receivedQuantity || '—')}</td>
        <td className="px-2 py-4"><button type="button" className="mr-3 text-action hover:underline" onClick={() => setViewing(r)}>查看详情</button>{r.pendingArchive && <button type="button" className="text-action hover:underline" onClick={() => setLinking({ record: r, masterId: '' })}>关联档案</button>}</td>
      </tr>)}</tbody></table>{!visible.length && <p className="py-12 text-center text-sm text-muted">暂无{names[tab]}，只在实际发生业务时登记。</p>}</div>
    {tab === 'dropship_period' && !supplierId && <PendingDropshipQueue data={importRevision ? loadLocalWorkbenchData() : data} />}
    {tab === 'dropship_period' && !supplierId && ((importRevision ? loadLocalWorkbenchData() : data).dropshipProductPeriods ?? []).length > 0 && <BusinessSection title="周期商品表现"><p className="mb-3 text-xs text-muted">原表没有供应商关系，因此只保存商品事实，不自动归属供应商。</p><div className="overflow-x-auto"><table className={`${procurementTable} min-w-[680px]`}><thead><tr>{['商品','周期','订单 / GMV','揽收 / 退款'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{((importRevision ? loadLocalWorkbenchData() : data).dropshipProductPeriods ?? []).map(item=><tr key={item.id}><td>{item.productName}</td><td>{item.periodStart} 至 {item.periodEnd} · {item.platform}</td><td>{item.paidOrders}单 / ¥{item.gmv}</td><td>{item.pickup48Rate ?? '—'}% / {item.refundRate ?? '—'}%</td></tr>)}</tbody></table></div></BusinessSection>}
    {selectedRecords.length > 1 && <BusinessSection title="临时横向对比"><p className="mb-4 text-xs text-muted">只比较本次选中的寄样或核样，不写入历史结论。</p><p className="mb-4 text-xs text-muted">请先核对产品、规格与测试口径是否一致；不同口径不作优劣排名。</p><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr><th className="p-3">对比项目</th>{selectedRecords.map(r => <th className="p-3" key={r.id}>{supplierName(r)} · {r.title}</th>)}</tr></thead><tbody>{(['productScope','specification','quantity','checks','evidenceNote'] as const).map(key => <tr className="border-b border-line" key={key}><td className="p-3 text-muted">{{productScope:'产品范围',specification:'规格版本',quantity:'数量',checks:'核样结果',evidenceNote:'依据 / 备注'}[key]}</td>{selectedRecords.map(r => <td className="whitespace-pre-wrap p-3" key={r.id}>{key === 'productScope' ? r.productScope : key === 'checks' ? checkSummary(r) : r.fields[key] || '未记录'}</td>)}</tr>)}</tbody></table></div></BusinessSection>}
    {viewing && !draft && <BusinessRecordDialog title={viewing.title || names[viewing.kind]} onClose={() => setViewing(null)} footer={<><button type="button" className={businessSecondary} onClick={() => setViewing(null)}>收起</button>{viewing.sourceType !== 'procurement' && viewing.kind === 'sample' && <button type="button" className={businessSecondary} onClick={() => { const next = newBusinessRecord('inspection', viewing.supplierIds[0]); setDraft({ ...next, productScope: viewing.productScope, fields: { sampleId: viewing.id, specification: viewing.fields.specification || '' } }); setViewing(null); }}>基于此样品核样</button>}{viewing.sourceType !== 'procurement' && <button type="button" className={businessPrimary} onClick={() => { setDraft(viewing); setViewing(null); }}>编辑</button>}</>}>
      {viewing.sourceType === 'procurement' && <div className="mb-4 border border-line bg-action-soft/30 px-4 py-3 text-sm"><strong>来自采购履约，只读</strong><p className="mt-1 text-xs text-muted">来源项目：{viewing.sourceProjectTitle}。请在采购履约中修正原始事实。</p></div>}
      <BusinessSection title="记录信息"><BusinessFacts values={[[ '供应商', supplierName(viewing)], ['产品范围', viewing.productScope], ['负责人', viewing.owner], ['状态', statuses[viewing.status]]]} /></BusinessSection>
      {viewing.kind === 'inspection' && <BusinessSection title="样品来源"><button className="text-sm text-action" type="button" onClick={() => { const sample = records.find(r => r.kind === 'sample' && r.id === viewing.fields.sampleId); if (sample) setViewing(sample); }}>{records.find(r => r.id === viewing.fields.sampleId)?.title || '来源寄样缺失'}</button></BusinessSection>}
      {recordGroups[viewing.kind].map(group => <BusinessSection key={group.title} title={group.title}><BusinessFacts values={group.fields.map(([key,label]) => [label, viewing.fields[key]])} /></BusinessSection>)}
      {viewing.kind === 'inspection' && <BusinessSection title="逐项检验结果"><CheckTable checks={inspectionChecks(viewing)} />{!inspectionChecks(viewing).length && <BusinessFacts values={['standard','method','actual','verdict'].map((key,i) => [['核样标准','核样方法','实测结果','核样判定'][i], viewing.fields[key]])} />}</BusinessSection>}
      <BusinessSection title="原始依据"><p className="whitespace-pre-wrap text-sm">{viewing.fields.evidenceNote || '未记录依据'}</p><Attachments record={viewing} /></BusinessSection>
    </BusinessRecordDialog>}
    {linking && <BusinessRecordDialog title={`关联供应商档案 · ${linking.record.pendingSupplierName || ''}`} onClose={() => setLinking(null)} footer={<><button className={businessSecondary} type="button" onClick={() => setLinking(null)}>取消</button><button className={businessPrimary} disabled={!linking.masterId} type="button" onClick={() => { const next = linkProcurementSupplier(loadProcurementRecords(), linking.record.sourceId || '', linking.record.pendingSupplierName || '', linking.masterId); saveProcurementRecords(next); setLinking(null); }}>确认关联</button></>}><p className="mb-4 text-sm text-muted">只关联供应商身份，不修改采购单、物流、核样或异常事实。若尚未建档，请先到供应商档案新增后再返回关联。</p><label className="text-sm">选择已有供应商<select aria-label="选择已有供应商" className={businessInput} value={linking.masterId} onChange={e => setLinking({ ...linking, masterId: e.target.value })}><option value="">请选择</option>{data.suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label></BusinessRecordDialog>}
    {draft && <BusinessRecordDialog title={(draft.id ? '编辑' : '新增') + names[draft.kind]} onClose={closeEdit} footer={<><span className="mr-auto text-xs text-muted">保存到本机 · 取消不会改动原记录</span><button type="button" className={businessSecondary} disabled={uploading} onClick={closeEdit}>取消</button><button type="button" className={businessPrimary} disabled={uploading} onClick={save}>{uploading ? '正在上传…' : '保存记录'}</button></>}>
      <BusinessSection title="关联对象"><div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm">标题<input className={businessInput} value={draft.title} onChange={e => change('__title', e.target.value)} /></label>
        <label className="text-sm">产品范围 / SKU<input className={businessInput} value={draft.productScope} onChange={e => change('__scope', e.target.value)} /></label>
        <label className="text-sm">供应商<select className={businessInput} value={draft.supplierIds[0] || ''} onChange={e => change('__supplier', e.target.value)}><option value="">请选择系统供应商</option>{data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-sm">状态<select className={businessInput} value={draft.status} onChange={e => change('__status', e.target.value)}>{Object.entries(statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-sm">负责人<input className={businessInput} value={draft.owner} onChange={e => change('__owner', e.target.value)} /></label>
        {draft.kind === 'inspection' && <label className="text-sm">关联寄样记录<select className={businessInput} value={draft.fields.sampleId || ''} onChange={e => change('sampleId', e.target.value)}><option value="">请选择寄样记录</option>{records.filter(r => r.kind === 'sample' && (!draft.supplierIds.length || r.supplierIds.some(id => draft.supplierIds.includes(id)))).map(r => <option key={r.id} value={r.id}>{r.title || '未命名寄样'} · {r.productScope}</option>)}</select></label>}
      </div></BusinessSection>
      {recordGroups[draft.kind].map(group => <BusinessSection key={group.title} title={group.title}><div className="grid gap-5 sm:grid-cols-2">{group.fields.map(([key,label,type]) => <label className={type === 'textarea' ? 'text-sm sm:col-span-2' : 'text-sm'} key={key}>{label}{type === 'textarea' ? <textarea rows={3} className={businessInput} value={draft.fields[key] || ''} onChange={e => change(key,e.target.value)} /> : <input className={businessInput} type={type || 'text'} step={type === 'number' ? 'any' : undefined} value={draft.fields[key] || ''} onChange={e => change(key,e.target.value)} />}</label>)}</div></BusinessSection>)}
      {draft.kind === 'inspection' && <BusinessSection title="逐项核样" action={<button className={businessSecondary} type="button" onClick={() => change('checks', JSON.stringify([...inspectionChecks(draft), { name:'',method:'',standard:'',actual:'',verdict:'pending' }]))}>添加检验项目</button>}><p className="mb-4 text-xs text-muted">记录预设标准和实测结果；核验完成不等于供应商全部产品准入。</p><CheckTable checks={inspectionChecks(draft)} onChange={checks => change('checks',JSON.stringify(checks))} /></BusinessSection>}
      <BusinessSection title="依据与附件"><label className="text-sm">依据 / 备注<textarea rows={3} className={businessInput} value={draft.fields.evidenceNote || ''} onChange={e => change('evidenceNote',e.target.value)} /></label><label className="mt-4 block text-sm text-action">上传原始资料<input type="file" disabled={uploading} className="mt-2 block max-w-full text-xs" onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void upload(file); }} /></label><p className="mt-2 text-xs text-muted">附件原件保存在本机；上传不代表已核验。</p><Attachments record={draft} /></BusinessSection>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </BusinessRecordDialog>}
  </div>;
}
function PendingDropshipQueue({ data }: { data: LocalWorkbenchData }) {
  const [status,setStatus] = useState<'active'|'observing'|'archived'|'resolved'>('active');
  const [links,setLinks] = useState<Record<string,string>>({});
  const rows = (data.pendingDropshipSuppliers ?? []).filter(item => (item.status || 'active') === status);
  const act = (item: PendingDropshipSupplier, type: 'link'|'create'|'observe'|'archive') => {
    try { saveLocalWorkbenchData(resolvePendingDropshipSupplier(loadLocalWorkbenchData(),item.id,type === 'link' ? {type,supplierId:links[item.id] || ''} : {type})); }
    catch (cause) { window.alert(cause instanceof Error ? cause.message : '处理失败'); }
  };
  if (!(data.pendingDropshipSuppliers ?? []).length) return null;
  return <BusinessSection title="待建档供应商">
    <div id="pending-dropship" className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">系统只给建议，不自动建档。处理后仍保留来源和周期证据。</p><select aria-label="待建档状态筛选" className={businessInput} value={status} onChange={event=>setStatus(event.target.value as typeof status)}><option value="active">待处理</option><option value="observing">继续观察</option><option value="resolved">已归档到档案</option><option value="archived">已存档</option></select></div>
    <div className="overflow-x-auto"><table className={`${procurementTable} min-w-[1050px]`}><thead><tr>{['来源商家','周期','订单 / GMV','系统建议 / 依据','关联已有档案','处理'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(item=><tr key={item.id}><td>{item.sourceName}<p className="mt-1 text-xs text-muted">{item.status === 'observing' ? '观察中' : item.status === 'resolved' ? '已处理' : item.status === 'archived' ? '已存档' : '待处理'}</p></td><td>{item.periodStart} 至 {item.periodEnd}<p className="mt-1 text-xs text-muted">{item.platform} · {item.sourceFileName}</p></td><td>{item.paidOrders ?? '未采集'}单 / ¥{item.gmv ?? '未采集'}</td><td>{{unknown:'订单量待补，不参与门槛判断',insufficient:'样本不足，继续观察',eligible:'达到观察门槛，建议建档',priority:'重点候选，优先确认'}[item.filingBand]}<p className="mt-1 text-xs text-muted">依据：周期订单量 {item.paidOrders ?? '未采集'} 单</p></td><td><select aria-label={`${item.sourceName}关联档案`} className={businessInput} value={links[item.id] || ''} onChange={event=>setLinks(old=>({...old,[item.id]:event.target.value}))}><option value="">请选择</option>{data.suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></td><td><div className="flex min-w-56 flex-wrap gap-2"><button className="text-action" type="button" onClick={()=>act(item,'link')} aria-label={`关联${item.sourceName}`}>关联</button><button className="text-action" type="button" onClick={()=>act(item,'create')}>新建档案</button><button className="text-action" type="button" onClick={()=>act(item,'observe')}>继续观察</button><button className="text-muted" type="button" onClick={()=>act(item,'archive')}>存档</button></div></td></tr>)}</tbody></table>{!rows.length && <p className="py-8 text-center text-sm text-muted">当前筛选状态没有记录。</p>}</div>
  </BusinessSection>;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="border-b border-line p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-xs text-muted">{label}</p><p className={`mt-1 text-xl font-semibold ${danger ? 'text-red-600' : ''}`}>{value}</p></div>;
}
function PeriodResult({ record }: { record: SupplierBusinessRecord }) {
  const metrics = dropshipMetricsFromRecord(record);
  const result = analyzeDropshipPeriod(metrics);
  return <div><p>{metrics.pickup48Rate == null ? '未采集揽收率' : `${metrics.pickup48Rate}%揽收`} · {metrics.refundRate == null ? '未采集退款率' : `${metrics.refundRate}%退款`}</p><div className="mt-1 flex flex-wrap gap-1"><span className="rounded bg-paper px-2 py-0.5 text-xs text-muted">{sampleBandNames[result.sampleBand]}</span>{result.risks.slice(0, 2).map(risk => <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600" key={risk}>{risk}</span>)}</div></div>;
}
function checkSummary(record: SupplierBusinessRecord) {
  const checks = inspectionChecks(record);
  return checks.length ? checks.map(c => c.name + '：' + c.actual + '（' + ({pass:'通过',fail:'未通过',pending:'待核验'}[c.verdict] || '待核验') + '）').join('\n') : record.fields.actual || record.fields.verdict || '未记录检验结果';
}
function CheckTable({ checks, onChange }: { checks: InspectionCheck[]; onChange?: (checks: InspectionCheck[]) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-line">{['检验项目','核样方法','合格标准','实测结果','判定', ...(onChange ? ['操作'] : [])].map(label => <th className="px-2 py-3 text-xs font-medium text-muted" key={label}>{label}</th>)}</tr></thead><tbody>{checks.map((check,index) => <tr className="border-b border-line/60" key={index}>{(['name','method','standard','actual'] as const).map((key, col) => <td className="p-2" key={key}>{onChange ? <input aria-label={['检验项目','核样方法','合格标准','实测结果'][col] + (index + 1)} className={businessInput} value={check[key]} onChange={e => onChange(checks.map((c,i) => i === index ? {...c,[key]:e.target.value} : c))} /> : check[key]}</td>)}<td className="p-2">{onChange ? <select aria-label={'判定' + (index + 1)} className={businessInput} value={check.verdict} onChange={e => onChange(checks.map((c,i) => i === index ? {...c,verdict:e.target.value as InspectionCheck['verdict']} : c))}><option value="pending">待核验</option><option value="pass">通过</option><option value="fail">未通过</option></select> : <span className={check.verdict === 'fail' ? 'text-red-600' : ''}>{{pass:'通过',fail:'未通过',pending:'待核验'}[check.verdict]}</span>}</td>{onChange && <td className="p-2"><button type="button" className="text-xs text-red-600" onClick={() => onChange(checks.filter((_,i) => i !== index))}>移除</button></td>}</tr>)}</tbody></table>{!checks.length && <p className="py-5 text-sm text-muted">暂无逐项检验记录。</p>}</div>;
}
function Attachments({ record }: { record: SupplierBusinessRecord }) {
  return <ul className="mt-3 space-y-2 text-sm">{record.attachmentIds.map((id,index) => <li key={id}><a className="text-action hover:underline" target="_blank" rel="noreferrer" href={'/api/supplier-attachments/' + encodeURIComponent(id)}>{record.fields['attachmentName:' + id] || '原始附件 ' + (index + 1)} ↗</a></li>)}</ul>;
}
