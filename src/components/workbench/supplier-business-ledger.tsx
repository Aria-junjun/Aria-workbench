'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWorkbenchData } from '@/features/workbench/workbench-store';
import { loadLocalWorkbenchData, saveLocalWorkbenchData, type LocalWorkbenchData } from '@/features/workbench/local-store';
import { inspectionChecks, newBusinessRecord, saveBusinessRecord, type InspectionCheck, type SupplierBusinessKind, type SupplierBusinessRecord } from '@/features/workbench/supplier-business';
import { loadProcurementRecords, saveProcurementRecords } from '@/features/workbench/procurement';
import { linkProcurementSupplier, mergeSupplierBusinessRecords, projectProcurementSupplierRecords } from '@/features/workbench/procurement-supplier-bridge';
import { BusinessRecordDialog, BusinessSection, BusinessFacts, businessInput, businessPrimary, businessSecondary } from './business-record-dialog';
import { procurementTable } from './procurement-line-details';
import { analyzeDropshipPeriod, buildProductSupplierComparison, buildSupplierPerformanceOverview, dropshipMetricsFromRecord, dropshipOverview, sampleBandNames } from '@/features/workbench/dropship-period-performance';
import { aggregateInboundBySupplier, groupInboundImportBatches, removeInboundImportBatch, selectInboundSnapshotsByWindow, type InboundImportBatch, type InboundWindow } from '@/features/workbench/supplier-fulfillment-ledger';
import { recordNames as names, recordStatuses as statuses, recordGroups } from './supplier-record-fields';
import { DropshipPerformanceImportDialog } from './dropship-performance-import-dialog';
import { resolvePendingDropshipSupplier } from '@/features/workbench/dropship-decision-loop';
import type { DropshipImportMode, PendingDropshipSupplier } from '@/features/workbench/dropship-performance-import';
import { applyScopedDropshipCleanup, listDropshipImportBatches, previewScopedDropshipCleanup, type DropshipCleanupScope } from '@/features/workbench/scoped-dropship-cleanup';

const allKinds: SupplierBusinessKind[] = ['sample', 'inspection', 'agreement', 'purchase', 'dropship_period'];
type Props = { supplierId?: string; kinds?: SupplierBusinessKind[]; embedded?: boolean; initialKind?: SupplierBusinessKind; sourceSnapshotIds?: string[] };
export function SupplierBusinessLedger({ supplierId, kinds = allKinds, embedded = false, initialKind, sourceSnapshotIds = [] }: Props) {
  const data = useWorkbenchData();
  const [tab, setTab] = useState<SupplierBusinessKind>(() => {
    if (initialKind && kinds.includes(initialKind)) return initialKind;
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
  const [importMode, setImportMode] = useState<DropshipImportMode>('full');
  const [importRevision, setImportRevision] = useState(0);
  const [inboundPage, setInboundPage] = useState(1);
  const [cleanupScope, setCleanupScope] = useState<DropshipCleanupScope | null>(null);
  const [inboundCleanupBatch, setInboundCleanupBatch] = useState<InboundImportBatch | null>(null);
  const [cleanupSuccess, setCleanupSuccess] = useState('');
  const records = mergeSupplierBusinessRecords(data.supplierBusinessRecords ?? [], projectProcurementSupplierRecords(loadProcurementRecords(), data.suppliers));
  useEffect(() => { if (initialKind && kinds.includes(initialKind)) setTab(initialKind); }, [initialKind, kinds]);
  useEffect(() => { setSupplierFilter(supplierId || ''); setInboundPage(1); setDraft(null); setViewing(null); setSelected([]); }, [supplierId]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('recordId');
    if (!id) return;
    const target = records.find(record => record.id === id && (!supplierId || record.supplierIds.includes(supplierId)));
    if (target) { setTab(target.kind); setViewing(target); }
  }, [data.supplierBusinessRecords, supplierId]);
  const visible = records.filter(r => r.kind === tab && (!supplierFilter || r.supplierIds.includes(supplierFilter)));
  const legacyPurchaseRecords = records.filter(record => record.kind === 'purchase' && record.sourceType !== 'procurement' && (!supplierFilter || record.supplierIds.includes(supplierFilter)));
  const selectedRecords = visible.filter(r => selected.includes(r.id));
  const periodMetrics = visible.filter(r => r.kind === 'dropship_period').map(dropshipMetricsFromRecord);
  const periodOverview = dropshipOverview(periodMetrics);
  const focusedSnapshotIds = [...new Set([...sourceSnapshotIds, ...(typeof window === 'undefined' ? [] : [new URLSearchParams(window.location.search).get('snapshotId'), ...(new URLSearchParams(window.location.search).get('snapshotIds') || '').split(',')].filter((id): id is string => !!id))])];
  const inboundSnapshots = (data.monthlyInboundSnapshots ?? []).filter(snapshot => {
    if (focusedSnapshotIds.length && !focusedSnapshotIds.includes(snapshot.id)) return false;
    if (!supplierFilter) return true;
    if (snapshot.supplierId) return snapshot.supplierId === supplierFilter;
    const matches = data.suppliers.filter(supplier => supplier.name.trim().toLowerCase() === snapshot.supplierName?.trim().toLowerCase());
    return matches.length === 1 && matches[0].id === supplierFilter;
  }).sort((a, b) => b.period.localeCompare(a.period));
  const inboundPages = Math.max(1, Math.ceil(inboundSnapshots.length / 10));
  const shownInbound = inboundSnapshots.slice((Math.min(inboundPage, inboundPages) - 1) * 10, Math.min(inboundPage, inboundPages) * 10);
  const importBatches = listDropshipImportBatches(importRevision ? loadLocalWorkbenchData() : data);
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
    {importingPeriod && <DropshipPerformanceImportDialog mode={importMode} onClose={() => setImportingPeriod(false)} onImported={() => setImportRevision(value => value + 1)} />}
    {cleanupScope && <DropshipCleanupDialog scope={cleanupScope} onClose={() => setCleanupScope(null)} onCleaned={() => { setImportRevision(value => value + 1); setCleanupSuccess(`已删除导入批次：${cleanupScope.platform} · ${cleanupScope.periodStart} 至 ${cleanupScope.periodEnd}`); setCleanupScope(null); }} />}
    {inboundCleanupBatch && <InboundCleanupDialog batch={inboundCleanupBatch} onClose={() => setInboundCleanupBatch(null)} onCleaned={() => { setImportRevision(value => value + 1); setCleanupSuccess(`已删除入仓导入批次：${inboundCleanupBatch.sourceFileName} · ${inboundCleanupBatch.period}`); setInboundCleanupBatch(null); }} />}
    {!embedded && <header><p className="text-xs tracking-widest text-action">供应商 · 业务记录</p><h1 className="mt-2 text-2xl font-semibold">供应商业务台账</h1><p className="mt-2 text-sm text-muted">按业务查看真实记录；按供应商追溯来源。报价资料库不自动进入当前询价。</p></header>}
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line pb-4">
      {kinds.map(key => <button className={tab === key ? 'text-sm font-semibold text-action' : 'text-sm text-muted hover:text-ink'} key={key} onClick={() => changeTab(key)} type="button">{names[key]}</button>)}
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {!supplierId && <select aria-label="按供应商筛选" className="max-w-52 rounded-md border-0 bg-paper px-3 py-2 text-sm" value={supplierFilter} onChange={e => { setSupplierFilter(e.target.value); setSelected([]); setViewing(null); setDraft(null); }}><option value="">全部供应商</option>{data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        {tab === 'purchase' && <a className={businessSecondary} href="/product-master">导入入仓数据</a>}
        {tab === 'dropship_period' && <><button className={businessSecondary} onClick={() => { setImportMode('product'); setImportingPeriod(true); }} type="button">导入产品归属</button><button className={businessSecondary} onClick={() => { setImportMode('performance'); setImportingPeriod(true); }} type="button">导入周期履约数据</button></>}
        {tab === 'purchase' ? <Link className={businessPrimary} href="/procurement/fulfillment">前往采购履约工作区</Link> : <button className={businessPrimary} onClick={() => { setViewing(null); setError(''); setDraft(newBusinessRecord(tab, supplierFilter)); }} type="button">新增{names[tab]}</button>}
      </div>
    </div>
    {tab === 'purchase' ? <><SupplierFulfillmentWorkspace
      kind={tab}
      data={importRevision ? loadLocalWorkbenchData() : data}
      supplierFilter={supplierFilter}
      cleanupSuccess={cleanupSuccess}
      sourceSnapshotIds={focusedSnapshotIds}
      onDeleteInbound={setInboundCleanupBatch}
      onDeleteDropship={setCleanupScope}
      onImportDropship={mode => { setImportMode(mode); setImportingPeriod(true); }}
    />{legacyPurchaseRecords.length > 0 && <details className="border border-line bg-surface"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">历史手工采购记录（未纳入履约汇总）· {legacyPurchaseRecords.length} 条</summary><div className="divide-y divide-line border-t border-line">{legacyPurchaseRecords.map(record => <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm" key={record.id}><span>{record.title || '未命名采购记录'} · {supplierName(record)} · {record.productScope || '产品未记录'}</span><button type="button" className="text-action hover:underline" aria-label={`查看历史记录：${record.title || '未命名采购记录'}`} onClick={() => setViewing(record)}>查看原记录</button></div>)}</div></details>}</> : tab === 'dropship_period' ? <SupplierFulfillmentWorkspace
      kind={tab}
      data={importRevision ? loadLocalWorkbenchData() : data}
      supplierFilter={supplierFilter}
      cleanupSuccess={cleanupSuccess}
      sourceSnapshotIds={[]}
      onDeleteInbound={setInboundCleanupBatch}
      onDeleteDropship={setCleanupScope}
      onImportDropship={mode => { setImportMode(mode); setImportingPeriod(true); }}
    /> : <>
    {cleanupSuccess && <p className="border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{cleanupSuccess}</p>}
     {!supplierId && records.some(record => record.pendingArchive) && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">有 {new Set(records.filter(record => record.pendingArchive).map(record => record.pendingSupplierName)).size} 家已发生履约的临时供应商待建立或关联正式档案。</div>}
     <div className="overflow-x-auto"><table className={`${procurementTable} min-w-[760px] table-fixed`}>
       <thead><tr className="border-b border-line text-xs text-muted">{['对比', '供应商 / 产品', '记录', '状态', ...(tab === 'sample' ? ['寄出 / 收到', '样品版本'] : tab === 'inspection' ? ['来源寄样', '检验结果'] : ['约定版本', '供应商确认']), '操作'].map(h => <th className="px-2 py-3 font-medium" key={h}>{h}</th>)}</tr></thead>
       <tbody>{visible.map(r => <tr key={r.id} className="border-b border-line/60 hover:bg-paper/60">
        <td className="px-2 py-4"><input type="checkbox" aria-label={'选择' + (r.title || names[r.kind])} checked={selected.includes(r.id)} onChange={() => setSelected(old => old.includes(r.id) ? old.filter(id => id !== r.id) : [...old, r.id])} /></td>
        <td className="px-2 py-4">{supplierName(r)}<p className="mt-1 text-xs text-muted">{r.productScope}</p></td>
        <td className="px-2 py-4"><button type="button" className="text-action hover:underline" onClick={() => setViewing(r)}>{r.title || names[r.kind]}</button>{r.sourceType === 'procurement' && <span className="ml-2 whitespace-nowrap rounded bg-action-soft px-2 py-1 text-xs text-action">采购履约同步</span>}</td>
        <td className="px-2 py-4">{statuses[r.status]}</td>
        <td className="px-2 py-4">{tab === 'sample' ? [r.fields.sentDate || '未寄出', r.fields.receivedDate || '未签收'].join(' / ') : tab === 'inspection' ? records.find(s => s.id === r.fields.sampleId)?.title || '来源待关联' : r.fields.version || '未记录'}</td>
        <td className="max-w-64 px-2 py-4">{tab === 'sample' ? r.fields.specification || '未记录' : tab === 'inspection' ? <span className={inspectionChecks(r).some(c => c.verdict === 'fail') ? 'text-red-600' : ''}>{checkSummary(r)}</span> : r.fields.receipt || '待确认'}</td>
        <td className="px-2 py-4"><button type="button" className="mr-3 text-action hover:underline" onClick={() => setViewing(r)}>查看详情</button>{r.pendingArchive && <button type="button" className="text-action hover:underline" onClick={() => setLinking({ record: r, masterId: '' })}>关联档案</button>}</td>
      </tr>)}</tbody></table>{!visible.length && <p className="py-8 text-center text-sm text-muted">暂无{names[tab]}，只在实际发生业务时登记。</p>}</div>
    {selectedRecords.length > 1 && <BusinessSection title="临时横向对比"><p className="mb-4 text-xs text-muted">只比较本次选中的寄样或核样，不写入历史结论。</p><p className="mb-4 text-xs text-muted">请先核对产品、规格与测试口径是否一致；不同口径不作优劣排名。</p><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr><th className="p-3">对比项目</th>{selectedRecords.map(r => <th className="p-3" key={r.id}>{supplierName(r)} · {r.title}</th>)}</tr></thead><tbody>{(['productScope','specification','quantity','checks','evidenceNote'] as const).map(key => <tr className="border-b border-line" key={key}><td className="p-3 text-muted">{{productScope:'产品范围',specification:'规格版本',quantity:'数量',checks:'核样结果',evidenceNote:'依据 / 备注'}[key]}</td>{selectedRecords.map(r => <td className="whitespace-pre-wrap p-3" key={r.id}>{key === 'productScope' ? r.productScope : key === 'checks' ? checkSummary(r) : r.fields[key] || '未记录'}</td>)}</tr>)}</tbody></table></div></BusinessSection>}
    </>}
    {viewing && !draft && <BusinessRecordDialog title={viewing.title || names[viewing.kind]} onClose={() => setViewing(null)} footer={<><button type="button" className={businessSecondary} onClick={() => setViewing(null)}>收起</button>{viewing.pendingArchive && <button type="button" className={businessPrimary} onClick={() => { setViewing(null); setLinking({ record: viewing, masterId: '' }); }}>关联正式档案</button>}{viewing.sourceType !== 'procurement' && viewing.kind === 'sample' && <button type="button" className={businessSecondary} onClick={() => { const next = newBusinessRecord('inspection', viewing.supplierIds[0]); setDraft({ ...next, productScope: viewing.productScope, fields: { sampleId: viewing.id, specification: viewing.fields.specification || '' } }); setViewing(null); }}>基于此样品核样</button>}{viewing.sourceType !== 'procurement' && <button type="button" className={businessPrimary} onClick={() => { setDraft(viewing); setViewing(null); }}>编辑</button>}</>}>
      {viewing.sourceType === 'procurement' && <div className="mb-4 border border-line bg-action-soft/30 px-4 py-3 text-sm"><strong>来自采购履约，只读</strong><p className="mt-1 text-xs text-muted">来源项目：{viewing.sourceProjectTitle}。请在采购履约中修正原始事实。</p></div>}
      {viewing.pendingArchive && <div className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><strong>下一步：处理供应商档案</strong><p className="mt-1 text-xs">当前供应商“{viewing.pendingSupplierName || '待关联供应商'}”已经产生履约记录，但尚未关联正式档案。可在下方直接关联。</p></div>}
      <BusinessSection title="记录信息"><BusinessFacts values={[[ '供应商', supplierName(viewing)], ['产品范围', viewing.productScope], ['负责人', viewing.owner], ['状态', statuses[viewing.status]]]} /></BusinessSection>
      {viewing.kind === 'inspection' && <BusinessSection title="样品来源"><button className="text-sm text-action" type="button" onClick={() => { const sample = records.find(r => r.kind === 'sample' && r.id === viewing.fields.sampleId); if (sample) setViewing(sample); }}>{records.find(r => r.id === viewing.fields.sampleId)?.title || '来源寄样缺失'}</button></BusinessSection>}
      {recordGroups[viewing.kind].map(group => <BusinessSection key={group.title} title={group.title}><BusinessFacts values={group.fields.map(([key,label]) => [label, viewing.fields[key]])} /></BusinessSection>)}
      {viewing.kind === 'dropship_period' && Object.entries(viewing.fields).some(([key]) => key.startsWith('raw:')) && <BusinessSection title="原始导入字段"><div className="overflow-x-auto"><table className={`${procurementTable} min-w-[620px]`}><thead><tr><th>原始列名</th><th>原始值</th></tr></thead><tbody>{Object.entries(viewing.fields).filter(([key]) => key.startsWith('raw:')).map(([key,value]) => <tr key={key}><td>{key.slice(4)}</td><td className="whitespace-pre-wrap">{value}</td></tr>)}</tbody></table></div></BusinessSection>}
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
        {draft.kind === 'purchase' && <label className="text-sm">履约方式（决定绩效归账）<select aria-label="履约方式" className={businessInput} value={draft.fields.fulfillmentMode || ''} onChange={e => change('fulfillmentMode', e.target.value)}><option value="">请选择</option><option value="warehouse">采购入仓</option><option value="dropship">一件代发</option></select></label>}
        {draft.kind === 'agreement' && <label className="text-sm">适用业务<select aria-label="约定适用业务" className={businessInput} value={draft.fields.fulfillmentMode || ''} onChange={e => change('fulfillmentMode', e.target.value)}><option value="">待明确</option><option value="warehouse">采购入仓</option><option value="dropship">一件代发</option></select></label>}
        {draft.kind === 'inspection' && <label className="text-sm">关联寄样记录<select className={businessInput} value={draft.fields.sampleId || ''} onChange={e => change('sampleId', e.target.value)}><option value="">请选择寄样记录</option>{records.filter(r => r.kind === 'sample' && (!draft.supplierIds.length || r.supplierIds.some(id => draft.supplierIds.includes(id)))).map(r => <option key={r.id} value={r.id}>{r.title || '未命名寄样'} · {r.productScope}</option>)}</select></label>}
      </div></BusinessSection>
      {recordGroups[draft.kind].map(group => <BusinessSection key={group.title} title={group.title}><div className="grid gap-5 sm:grid-cols-2">{group.fields.map(([key,label,type]) => <label className={type === 'textarea' ? 'text-sm sm:col-span-2' : 'text-sm'} key={key}>{label}{type === 'textarea' ? <textarea rows={3} className={businessInput} value={draft.fields[key] || ''} onChange={e => change(key,e.target.value)} /> : <input className={businessInput} type={type || 'text'} step={type === 'number' ? 'any' : undefined} value={draft.fields[key] || ''} onChange={e => change(key,e.target.value)} />}</label>)}</div></BusinessSection>)}
      {draft.kind === 'inspection' && <BusinessSection title="逐项核样" action={<button className={businessSecondary} type="button" onClick={() => change('checks', JSON.stringify([...inspectionChecks(draft), { name:'',method:'',standard:'',actual:'',verdict:'pending' }]))}>添加检验项目</button>}><p className="mb-4 text-xs text-muted">记录预设标准和实测结果；核验完成不等于供应商全部产品准入。</p><CheckTable checks={inspectionChecks(draft)} onChange={checks => change('checks',JSON.stringify(checks))} /></BusinessSection>}
      <BusinessSection title="依据与附件"><label className="text-sm">依据 / 备注<textarea rows={3} className={businessInput} value={draft.fields.evidenceNote || ''} onChange={e => change('evidenceNote',e.target.value)} /></label><label className="mt-4 block text-sm text-action">上传原始资料<input type="file" disabled={uploading} className="mt-2 block max-w-full text-xs" onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void upload(file); }} /></label><p className="mt-2 text-xs text-muted">附件原件保存在本机；上传不代表已核验。</p><Attachments record={draft} /></BusinessSection>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </BusinessRecordDialog>}
  </div>;
}
type FulfillmentLedgerKind = 'purchase' | 'dropship_period';
type FulfillmentLedgerView = 'overview' | 'batches' | 'comparison';
function SupplierFulfillmentWorkspace({ kind, data, supplierFilter, cleanupSuccess, sourceSnapshotIds, onDeleteInbound, onDeleteDropship, onImportDropship }: {
  kind: FulfillmentLedgerKind;
  data: LocalWorkbenchData;
  supplierFilter: string;
  cleanupSuccess: string;
  sourceSnapshotIds: string[];
  onDeleteInbound: (batch: InboundImportBatch) => void;
  onDeleteDropship: (scope: DropshipCleanupScope) => void;
  onImportDropship: (mode: DropshipImportMode) => void;
}) {
  const [view, setView] = useState<FulfillmentLedgerView>(() => sourceSnapshotIds.length ? 'batches' : 'overview');
  const [purchaseRange, setPurchaseRange] = useState<'month' | 'last3' | 'last12' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [dropshipWeeks, setDropshipWeeks] = useState<1 | 4 | 13>(1);
  const [purchaseSort, setPurchaseSort] = useState<'settlement' | 'quantity'>('settlement');
  const [dropshipSort, setDropshipSort] = useState<'paidOrders' | 'gmv' | 'pickup48Rate' | 'refundRate' | 'response3mRate'>('paidOrders');
  const months = [...new Set((data.monthlyInboundSnapshots ?? []).map(snapshot => snapshot.period))].sort((a, b) => b.localeCompare(a));
  const latestMonth = months[0] || new Date().toISOString().slice(0, 7);
  const activeMonth = months.includes(selectedMonth) ? selectedMonth : latestMonth;
  const inboundWindow: InboundWindow = purchaseRange === 'month'
    ? { kind: 'month', month: activeMonth }
    : purchaseRange === 'last3' || purchaseRange === 'last12'
      ? { kind: 'last_months', endMonth: activeMonth, count: purchaseRange === 'last3' ? 3 : 12 }
      : { kind: 'range', startMonth: rangeStart || months.at(-1) || activeMonth, endMonth: rangeEnd || activeMonth };
  const scopedInbound = selectInboundSnapshotsByWindow(data.monthlyInboundSnapshots ?? [], inboundWindow).filter(snapshot => {
    if (!supplierFilter) return true;
    if (snapshot.supplierId) return snapshot.supplierId === supplierFilter;
    const matches = data.suppliers.filter(supplier => supplier.name.trim().toLowerCase() === snapshot.supplierName?.trim().toLowerCase());
    return matches.length === 1 && matches[0].id === supplierFilter;
  });
  const inboundSummaries = aggregateInboundBySupplier(scopedInbound, data.suppliers);
  const allInboundBatches = groupInboundImportBatches(data.monthlyInboundSnapshots ?? []);
  const inboundBatches = sourceSnapshotIds.length ? allInboundBatches.filter(batch => batch.snapshotIds.some(id => sourceSnapshotIds.includes(id))) : allInboundBatches;
  const focusedInboundSnapshots = sourceSnapshotIds.length ? (data.monthlyInboundSnapshots ?? []).filter(snapshot => sourceSnapshotIds.includes(snapshot.id)) : [];
  const dropshipSummaries = buildSupplierPerformanceOverview(data, dropshipWeeks).filter(row => !supplierFilter || row.supplierId === supplierFilter);
  const dropshipTotals = dropshipOverview(dropshipSummaries);
  const dropshipBatches = listDropshipImportBatches(data);
  const label = kind === 'purchase' ? '采购履约' : '代发周期履约';
  const batchCount = kind === 'purchase' ? inboundBatches.length : dropshipBatches.length;
  const monthLabel = purchaseRange === 'month' ? activeMonth : purchaseRange === 'last3' ? `近3个月（截至 ${activeMonth}）` : purchaseRange === 'last12' ? `近12个月（截至 ${activeMonth}）` : `${inboundWindow.kind === 'range' ? inboundWindow.startMonth : activeMonth} 至 ${inboundWindow.kind === 'range' ? inboundWindow.endMonth : activeMonth}`;
  const sortedInbound = [...inboundSummaries].sort((a, b) => purchaseSort === 'settlement' ? b.knownSettlementAmount - a.knownSettlementAmount : b.receivedQuantity - a.receivedQuantity);
  const sortedDropship = [...dropshipSummaries].sort((a, b) => (b[dropshipSort] ?? Number.NEGATIVE_INFINITY) - (a[dropshipSort] ?? Number.NEGATIVE_INFINITY));
  useEffect(() => { setView(sourceSnapshotIds.length ? 'batches' : 'overview'); }, [kind, sourceSnapshotIds.join('|')]);

  return <div className="space-y-5">
    {cleanupSuccess && <p role="status" className="border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{cleanupSuccess}</p>}
    <section className="border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="font-semibold">{label}</h2><p className="mt-1 text-xs text-muted">总览与对比按供应商汇总；原始导入数据只在批次视图核查。</p></div>
        <label className="flex items-center gap-2 text-sm">{kind === 'purchase' ? '入仓统计周期' : '代发统计周期'}
          {kind === 'purchase' ? <select aria-label="采购统计周期" className={businessInput + ' !mt-0 !w-auto'} value={purchaseRange} onChange={event => setPurchaseRange(event.target.value as typeof purchaseRange)}><option value="month">单月</option><option value="last3">近3个月</option><option value="last12">近12个月</option><option value="custom">自定义月份</option></select>
            : <select aria-label="代发统计周期" className={businessInput + ' !mt-0 !w-auto'} value={dropshipWeeks} onChange={event => setDropshipWeeks(Number(event.target.value) as 1 | 4 | 13)}><option value={1}>单周 / 最近一期</option><option value={4}>近4周</option><option value={13}>滚动13周</option></select>}
        </label>
      </div>
      {kind === 'purchase' && (purchaseRange === 'month' || purchaseRange === 'last3' || purchaseRange === 'last12') && <label className="mt-3 flex items-center gap-2 text-xs text-muted">统计截止月份<select aria-label="采购统计月份" className={businessInput + ' !mt-0 !w-auto'} value={activeMonth} onChange={event => setSelectedMonth(event.target.value)}>{months.map(month => <option key={month} value={month}>{month}</option>)}</select></label>}
      {kind === 'purchase' && purchaseRange === 'custom' && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted"><label>开始月份<select aria-label="采购开始月份" className={businessInput + ' !mt-0 !w-auto'} value={rangeStart || months.at(-1) || activeMonth} onChange={event => setRangeStart(event.target.value)}>{[...months].reverse().map(month => <option key={month}>{month}</option>)}</select></label><label>结束月份<select aria-label="采购结束月份" className={businessInput + ' !mt-0 !w-auto'} value={rangeEnd || activeMonth} onChange={event => setRangeEnd(event.target.value)}>{months.map(month => <option key={month}>{month}</option>)}</select></label></div>}
      {kind === 'purchase' && <p className="mt-2 text-xs text-muted">当前口径：{monthLabel} · 月度入仓快照；缺失值不按 0 计。</p>}
      {kind === 'dropship_period' && <p className="mt-2 text-xs text-muted">按最新的 {dropshipWeeks} 个已导入周期汇总；以记录本身的起止日期展示覆盖范围，不拆分、不估算周期内数据。</p>}
    </section>
    <div role="tablist" aria-label={`${label}视图`} className="inline-flex flex-wrap border border-line bg-surface p-1">
      {([['overview', '供应商总览'], ['batches', '导入批次'], ['comparison', '供应商对比']] as const).map(([key, title]) => <button role="tab" aria-selected={view === key} className={view === key ? 'bg-action-soft px-4 py-2 text-sm font-semibold text-action' : 'px-4 py-2 text-sm text-muted'} key={key} onClick={() => setView(key)} type="button">{title}{key === 'batches' ? ` (${batchCount})` : ''}</button>)}
    </div>

    {view === 'overview' && kind === 'purchase' && <>
      <div className="grid overflow-hidden border border-line bg-surface sm:grid-cols-4"><Metric label="实际入仓数量" value={scopedInbound.some(item => item.receivedQuantity != null) ? inboundSummaries.reduce((sum, row) => sum + row.receivedQuantity, 0).toLocaleString() : '未采集'} /><Metric label="已知结算金额" value={scopedInbound.some(item => item.settlementAmount != null) ? `¥${inboundSummaries.reduce((sum, row) => sum + row.knownSettlementAmount, 0).toFixed(2)}` : '未采集'} /><Metric label="有数据供应商" value={String(inboundSummaries.length)} /><Metric label="金额缺失记录" value={String(inboundSummaries.reduce((sum, row) => sum + row.settlementMissingCount, 0))} /></div>
      <p className="text-xs text-muted">以上为所选月份内已导入的入仓快照，不等同于全部采购或付款记录。当前共 {scopedInbound.length} 条源记录。</p>
    </>}
    {view === 'overview' && kind === 'dropship_period' && <>
      <div className="grid overflow-hidden border border-line bg-surface sm:grid-cols-4"><Metric label="周期订单量" value={String(dropshipTotals.totalOrders)} /><Metric label="周期 GMV" value={`¥${dropshipTotals.totalGmv.toFixed(2)}`} /><Metric label="加权 48H 揽收率" value={dropshipTotals.weightedPickup48Rate == null ? '未采集' : `${dropshipTotals.weightedPickup48Rate.toFixed(1)}%`} /><Metric label="风险供应商" value={String(dropshipSummaries.filter(row => row.riskCount > 0).length)} danger={dropshipSummaries.some(row => row.riskCount > 0)} /></div>
      {dropshipSummaries.some(row => row.riskCount > 0) ? <BusinessSection title="需要关注的供应商"><div className="overflow-x-auto"><table aria-label="代发风险供应商总览" className={`${procurementTable} min-w-[760px]`}><thead><tr>{['供应商','订单量','数据周期','风险依据','样本状态'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{dropshipSummaries.filter(row => row.riskCount > 0).map(row => <tr key={row.supplierId}><td>{row.supplierName}</td><td>{row.paidOrders ?? '未采集'}</td><td>{row.periodStart || '—'} 至 {row.periodEnd || '—'}</td><td className="text-red-700">{row.risks.join('、')}</td><td>{sampleBandNames[row.sampleBand]}</td></tr>)}</tbody></table></div></BusinessSection> : <p className="text-sm text-muted">当前周期没有达到风险提示条件；指标缺失仍显示为未采集，不代表供应商无风险。</p>}
    </>}

    {view === 'batches' && kind === 'purchase' && <BusinessSection title="入仓导入批次"><p className="mb-3 text-xs text-muted">批次删除会同步移除供应商业务台账、入仓产品主表和管理总览中的对应源数据；删除不受供应商筛选影响。供应商档案和商品映射保留。</p><div className="overflow-x-auto"><table aria-label="入仓导入批次" className={`${procurementTable} min-w-[760px]`}><thead><tr>{['来源文件 / 工作表','月份','导入时间','记录数','操作'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{inboundBatches.map(batch => <tr key={batch.id}><td>{batch.sourceFileName}<p className="mt-1 text-xs text-muted">{batch.sourceSheetName}</p></td><td>{batch.period}</td><td>{batch.importedAt || '历史导入（时间未记录）'}</td><td>{batch.snapshotIds.length}</td><td><button aria-label={`删除入仓批次 ${batch.sourceFileName} ${batch.period}`} className="text-red-700" type="button" onClick={() => onDeleteInbound(batch)}>删除批次…</button></td></tr>)}</tbody></table>{!inboundBatches.length && <p className="py-8 text-center text-sm text-muted">当前没有入仓导入批次。</p>}</div></BusinessSection>}
    {view === 'batches' && kind === 'purchase' && sourceSnapshotIds.length > 0 && <BusinessSection title="供给保障来源明细"><p className="mb-3 text-xs text-muted">以下仅展示总览该产品实际引用的入仓快照，不执行名称匹配或数据重算。</p><div className="overflow-x-auto"><table aria-label="供给保障来源明细" className={`${procurementTable} min-w-[900px]`}><thead><tr>{['月份','产品 / SKU','供应商','实际入仓数量','已知结算金额','来源文件 / 工作表'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{focusedInboundSnapshots.map(snapshot => { const sku = data.skuMasters?.find(item => item.id === snapshot.skuMasterId); const supplier = data.suppliers.find(item => item.id === snapshot.supplierId); return <tr key={snapshot.id}><td>{snapshot.period}</td><td>{sku?.shortName || sku?.productName || snapshot.skuMasterId}</td><td>{supplier?.shortName || supplier?.name || snapshot.supplierName || '未关联供应商'}</td><td>{snapshot.receivedQuantity ?? '未采集'}</td><td>{snapshot.settlementAmount == null ? '未采集' : `¥${snapshot.settlementAmount.toFixed(2)}`}</td><td>{snapshot.sourceFileName || '来源文件未记录'} / {snapshot.sourceSheetName || '工作表未记录'}</td></tr>; })}{!focusedInboundSnapshots.length && <tr><td colSpan={6} className="text-center text-muted">找不到这些来源快照；原始记录可能已变更或不存在。</td></tr>}</tbody></table></div></BusinessSection>}
    {view === 'batches' && kind === 'dropship_period' && <>
      <BusinessSection title="代发导入批次"><p className="mb-3 text-xs text-muted">删除按平台和统计周期限定，确认前会列出所有受影响的代发源记录及派生页面；供应商档案和归属映射保留。</p><div className="overflow-x-auto"><table aria-label="代发导入批次" className={`${procurementTable} min-w-[680px]`}><thead><tr>{['平台','统计周期','涉及记录','操作'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{dropshipBatches.map(batch => { const preview = previewScopedDropshipCleanup(data, batch); return <tr key={`${batch.platform}|${batch.periodStart}|${batch.periodEnd}`}><td>{batch.platform}</td><td>{batch.periodStart} 至 {batch.periodEnd}</td><td>{preview.total} 条</td><td><button aria-label={`删除导入批次 ${batch.platform} ${batch.periodStart} 至 ${batch.periodEnd}`} className="text-red-700" type="button" onClick={() => onDeleteDropship(batch)}>删除批次…</button></td></tr>; })}</tbody></table>{!dropshipBatches.length && <p className="py-8 text-center text-sm text-muted">当前没有代发导入批次。</p>}</div></BusinessSection>
      {!supplierFilter && (data.pendingDropshipSuppliers ?? []).length > 0 && <details className="border border-line bg-surface"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">处理待建档供应商（{(data.pendingDropshipSuppliers ?? []).filter(item => (item.status || 'active') === 'active').length} 家待处理）</summary><div className="border-t border-line p-3"><PendingDropshipQueue data={data} /></div></details>}
    </>}

    {view === 'comparison' && kind === 'purchase' && <BusinessSection title="供应商入仓数据对比"><div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span>期间：{monthLabel} · 金额为已知结算额，不等于付款额</span><label className="flex items-center gap-2">排序<select aria-label="入仓对比排序" className={businessInput + ' !mt-0 !w-auto'} value={purchaseSort} onChange={event => setPurchaseSort(event.target.value as typeof purchaseSort)}><option value="settlement">已知结算金额</option><option value="quantity">实际入仓数量</option></select></label></div><div className="overflow-x-auto"><table aria-label="供应商入仓对比" className={`${procurementTable} min-w-[720px]`}><thead><tr>{['供应商','实际入仓数量','已知结算金额','记录数','缺失金额记录'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{sortedInbound.map(row => <tr key={row.supplierId || row.supplierName}><td>{row.supplierName}</td><td>{row.quantityMissingCount === row.recordCount ? '未采集' : row.receivedQuantity.toLocaleString()}</td><td>{row.settlementMissingCount === row.recordCount ? '未采集' : `¥${row.knownSettlementAmount.toFixed(2)}`}</td><td>{row.recordCount}</td><td>{row.settlementMissingCount}</td></tr>)}</tbody></table>{!sortedInbound.length && <p className="py-8 text-center text-sm text-muted">所选期间暂无可对比数据。</p>}</div></BusinessSection>}
    {view === 'comparison' && kind === 'dropship_period' && <BusinessSection title="供应商代发履约对比"><div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span>周期：最新 {dropshipWeeks} 个已导入周期；数据起止日期见表内</span><label className="flex items-center gap-2">排序<select aria-label="代发对比排序" className={businessInput + ' !mt-0 !w-auto'} value={dropshipSort} onChange={event => setDropshipSort(event.target.value as typeof dropshipSort)}><option value="paidOrders">订单量</option><option value="gmv">GMV</option><option value="pickup48Rate">48小时揽收率</option><option value="refundRate">退款率</option><option value="response3mRate">3分钟响应率</option></select></label></div><div className="overflow-x-auto"><table aria-label="供应商代发对比" className={`${procurementTable} min-w-[1120px]`}><thead><tr>{['供应商','周期数','订单量','GMV','48H揽收率','支签到货时长','退款率','拒退率','3分钟响应率','风险'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{sortedDropship.map(row => <tr key={row.supplierId}><td>{row.supplierName}</td><td>{row.periodCount}</td><td>{row.paidOrders ?? '未采集'}</td><td>{row.gmv == null ? '未采集' : `¥${row.gmv.toFixed(2)}`}</td><td>{row.pickup48Rate == null ? '未采集' : `${row.pickup48Rate.toFixed(1)}%`}</td><td>{row.paymentToSignHours == null ? '未采集' : `${row.paymentToSignHours.toFixed(1)}h`}</td><td>{row.refundRate == null ? '未采集' : `${row.refundRate.toFixed(1)}%`}</td><td>{row.rejectReturnRate == null ? '未采集' : `${row.rejectReturnRate.toFixed(1)}%`}</td><td>{row.response3mRate == null ? '未采集' : `${row.response3mRate.toFixed(1)}%`}</td><td>{row.risks.length ? <span className="text-red-700">{row.risks.join('、')}</span> : row.sampleBand === 'scoreable' ? '当前规则未识别风险' : sampleBandNames[row.sampleBand]}</td></tr>)}</tbody></table>{!sortedDropship.length && <p className="py-8 text-center text-sm text-muted">所选周期暂无供应商对比数据。</p>}</div></BusinessSection>}
  </div>;
}
function DropshipCleanupDialog({ scope, onClose, onCleaned }: { scope: DropshipCleanupScope; onClose: () => void; onCleaned: () => void }) {
  const [backupSaved,setBackupSaved] = useState(false);
  const [ackSource,setAckSource] = useState(false);
  const [ackOverview,setAckOverview] = useState(false);
  const [confirmation,setConfirmation] = useState('');
  const [error,setError] = useState('');
  const [captured] = useState(() => { const data=loadLocalWorkbenchData(); return { data, revision:JSON.stringify(data) }; });
  const preview = previewScopedDropshipCleanup(captured.data,scope);
  const confirmationText = `${scope.platform} · ${scope.periodStart} 至 ${scope.periodEnd}`;
  const backup = () => {
    const blob = new Blob([JSON.stringify(captured.data,null,2)],{type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href=url; anchor.download=`供应商业务台账-删除批次前完整备份-${scope.platform}-${scope.periodStart}至${scope.periodEnd}.json`; anchor.click(); URL.revokeObjectURL(url); setBackupSaved(true);
  };
  const clean = () => {
    if (!backupSaved || !ackSource || !ackOverview || confirmation !== confirmationText) return;
    const current = loadLocalWorkbenchData();
    if (JSON.stringify(current) !== captured.revision) {
      setError('数据已发生变化，本次删除已中止。请关闭窗口并重新打开预览后再确认。');
      return;
    }
    saveLocalWorkbenchData(applyScopedDropshipCleanup(captured.data,scope));
    onCleaned();
  };
  const rows: Array<[string,string]> = [['供应商周期履约',`${preview.counts.supplierBusinessRecords} 条`],['待建档供应商',`${preview.counts.pendingDropshipSuppliers} 条`],['商品周期明细',`${preview.counts.dropshipProductPeriods} 条`],['供应商别名映射','全部保留'],['商品路由映射','全部保留']];
  return <BusinessRecordDialog title="确认删除代发导入批次" onClose={onClose} footer={<><button className={businessSecondary} type="button" onClick={onClose}>取消</button><button className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!backupSaved || !ackSource || !ackOverview || confirmation !== confirmationText} type="button" onClick={clean}>确认删除该批次数据</button></>}>
    <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"><strong>删除会影响其他页面的数据</strong><p className="mt-1">删除后，代发业务台账、供应商管理总览及供应商对比中的相关周期数据将同步消失。此操作不可在页面内撤销。</p></div>
    <BusinessSection title="删除影响预览"><div className="overflow-hidden border border-line">{rows.map(([label,value])=><div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm last:border-b-0" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p className="mt-3 text-sm">将删除 <strong className="text-red-600">{preview.total}</strong> 条源数据；供应商档案和商品/供应商映射保留。</p><ul className="mt-2 list-disc pl-5 text-xs text-muted"><li>供应商业务台账的代发周期记录</li><li>管理总览的代发指标及风险判断</li><li>按供应商对比的派生结果</li></ul></BusinessSection>
    <BusinessSection title="删除前备份"><button className={businessSecondary} type="button" onClick={backup}>下载当前工作台完整备份</button><p className="mt-2 text-xs text-muted">{backupSaved ? '备份下载已触发，请确认文件已保存。' : '必须先触发完整 JSON 备份，删除确认才可继续。'}</p></BusinessSection>
    <div className="space-y-3 border border-line p-4 text-sm"><label className="flex items-start gap-3"><input aria-label="确认代发源记录影响" className="mt-1" type="checkbox" checked={ackSource} onChange={event=>setAckSource(event.target.checked)} /><span>我确认删除上述周期的原始代发记录。</span></label><label className="flex items-start gap-3"><input aria-label="确认代发总览同步影响" className="mt-1" type="checkbox" checked={ackOverview} onChange={event=>setAckOverview(event.target.checked)} /><span>我了解管理总览和对比结果会同步变化，供应商档案与映射关系不会删除。</span></label></div>
    <label className="mt-4 block text-sm">输入批次标识以确认删除<input aria-label="代发批次标识复核" className={businessInput} value={confirmation} onChange={event=>setConfirmation(event.target.value)} placeholder={confirmationText} /><span className="mt-1 block text-xs text-muted">请原样输入：{confirmationText}</span></label>
    {error && <p role="alert" className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
  </BusinessRecordDialog>;
}

function InboundCleanupDialog({ batch, onClose, onCleaned }: { batch: InboundImportBatch; onClose: () => void; onCleaned: () => void }) {
  const [backupSaved, setBackupSaved] = useState(false);
  const [ackSource, setAckSource] = useState(false);
  const [ackDerived, setAckDerived] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [captured] = useState(() => {
    const data = loadLocalWorkbenchData();
    return { data, revision: JSON.stringify(data) };
  });
  const confirmationText = `${batch.sourceFileName} · ${batch.sourceSheetName} · ${batch.period} · ${batch.importedAt || '历史导入'}`;
  const batchSnapshots = (captured.data.monthlyInboundSnapshots ?? []).filter(snapshot => batch.snapshotIds.includes(snapshot.id));
  const linkedSuppliers = new Set(batchSnapshots.map(snapshot => snapshot.supplierId).filter(Boolean)).size;
  const backup = () => {
    const blob = new Blob([JSON.stringify(captured.data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `供应商业务台账-删除入仓批次前完整备份-${batch.period}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupSaved(true);
  };
  const clean = () => {
    if (!backupSaved || !ackSource || !ackDerived || confirmation !== confirmationText) return;
    const current = loadLocalWorkbenchData();
    if (JSON.stringify(current) !== captured.revision) {
      setError('数据已发生变化，本次删除已中止。请关闭窗口并重新打开预览后再确认。');
      return;
    }
    saveLocalWorkbenchData(removeInboundImportBatch(captured.data, batch));
    onCleaned();
  };
  return <BusinessRecordDialog title="确认删除入仓导入批次" onClose={onClose} footer={<><button className={businessSecondary} type="button" onClick={onClose}>取消</button><button className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!backupSaved || !ackSource || !ackDerived || confirmation !== confirmationText} type="button" onClick={clean}>确认删除该批次数据</button></>}>
    <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"><strong>删除会影响多个页面的数据</strong><p className="mt-1">该入仓批次会从供应商业务台账、入仓产品主表和供应商管理总览中移除，且无法通过页面撤销。供应商档案、经营产品和供应商商品映射不会删除。</p></div>
    <BusinessSection title="本批次影响范围"><div className="overflow-hidden border border-line">{[['入仓源记录', `${batchSnapshots.length} 条`], ['关联供应商', `${linkedSuppliers} 家`], ['批次月份', batch.period], ['供应商档案与商品映射', '保留']].map(([label, value]) => <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm last:border-b-0" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><ul className="mt-3 list-disc pl-5 text-xs text-muted"><li>供应商业务台账：入仓汇总与供应商对比将重算</li><li>入仓产品主表：本批次实际入仓数量将不再计入</li><li>供应商管理总览：对应入仓指标同步变化</li></ul></BusinessSection>
    <BusinessSection title="删除前备份"><button className={businessSecondary} type="button" onClick={backup}>下载当前工作台完整备份</button><p className="mt-2 text-xs text-muted">{backupSaved ? '备份下载已触发，请确认文件已保存。' : '必须先触发完整 JSON 备份，删除确认才可继续。'}</p></BusinessSection>
    <div className="space-y-3 border border-line p-4 text-sm"><label className="flex items-start gap-3"><input aria-label="确认入仓源记录影响" className="mt-1" type="checkbox" checked={ackSource} onChange={event => setAckSource(event.target.checked)} /><span>我确认删除此批次的入仓源记录。</span></label><label className="flex items-start gap-3"><input aria-label="确认入仓派生数据影响" className="mt-1" type="checkbox" checked={ackDerived} onChange={event => setAckDerived(event.target.checked)} /><span>我了解入仓产品及管理总览的相关汇总会同步变化，供应商档案和映射关系保留。</span></label></div>
    <label className="mt-4 block text-sm">输入批次标识以确认删除<input aria-label="入仓批次标识复核" className={businessInput} value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder={confirmationText} /><span className="mt-1 block text-xs text-muted">请原样输入：{confirmationText}</span></label>
    {error && <p role="alert" className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
  </BusinessRecordDialog>;
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
