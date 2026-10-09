'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { BusinessEvidenceFiles } from './business-evidence-files';
import { useWorkbenchData } from '@/features/workbench/workbench-store';
import { emptyLifecycleRecord, lifecycleSections, statusNames, type LifecycleRecord, type LifecycleSection } from '@/features/workbench/supplier-lifecycle';
import { saveLifecycleRecord } from '@/features/workbench/supplier-lifecycle-store';
import { BusinessRecordDialog, BusinessSection, BusinessFacts, businessInput, businessPrimary, businessSecondary } from './business-record-dialog';

export const stagePresentation: Record<LifecycleSection, { noun: string; scope: string; result: string; evidence: string; columns: string[] }> = {
  sourcing: { noun: '寻源决定', scope: '本次需求 / 产品范围', result: '入围方案与选择理由', evidence: '当前项目报价与比较依据', columns: ['requirement', 'comparison'] },
  admission: { noun: '准入核验', scope: '准入产品 / SKU范围', result: '准入决定与适用限制', evidence: '核样记录 / 资质核验依据', columns: ['verification', 'issues'] },
  agreements: { noun: '合作约定', scope: '约定适用产品 / SKU', result: '双方确认的最终约定', evidence: '协议 / 回执位置', columns: ['version', 'receipt'] },
  performance: { noun: '异常与改善', scope: '受影响产品 / SKU', result: '整改是否关闭及复核结论', evidence: '订单 / 质量 / 售后原始依据', columns: ['actual', 'review'] },
  exits: { noun: '暂停与退出', scope: '影响产品 / SKU', result: '暂停或退出决定', evidence: '调整依据 / 交接凭据', columns: ['replacement', 'closure'] },
};

export function SupplierStageRecords({ section, supplierId, businessMode, sourceRecordId, riskReason, initialMode, recordId, sourceId, onRouteClose }: {
  section: LifecycleSection; supplierId?: string; businessMode?: 'inbound' | 'dropship'; sourceRecordId?: string; riskReason?: string; initialMode?: 'new' | 'edit' | 'detail'; recordId?: string; sourceId?: string; onRouteClose?: () => void;
}) {
  const data = useWorkbenchData();
  const records = data.supplierLifecycleRecords ?? [];
  const existing = records.find(r => r.id === recordId && r.section === section);
  const source = records.find(r => r.id === sourceId);
  const config = lifecycleSections[section], presentation = stagePresentation[section];
  const [view, setView] = useState<LifecycleRecord | null>(initialMode === 'detail' ? existing || null : null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const rows = records.filter(r => r.section === section && (!supplierId || r.supplierIds.includes(supplierId)));
  const update = (patch: Partial<LifecycleRecord>) => setDraft(d => d ? { ...d, ...patch } : d);
  const names = (r: LifecycleRecord) => r.supplierIds.map(id => data.suppliers.find(s => s.id === id)?.name || '档案缺失').join('、');
  const label = (key: string) => config.fields.find(([k]) => k === key)?.[1] || key;
  const sourceCandidates = [
    ...(data.supplierBusinessRecords ?? []).filter(r => (r.kind === 'dropship_period' || r.kind === 'purchase') && (!supplierId || r.supplierIds.includes(supplierId))),
    ...(data.monthlyInboundSnapshots ?? []).flatMap(snapshot => {
      const matches = snapshot.supplierName ? data.suppliers.filter(supplier => supplier.name.trim().toLowerCase() === snapshot.supplierName!.trim().toLowerCase()) : [];
      const resolvedId = snapshot.supplierId || (matches.length === 1 ? matches[0].id : undefined);
      return resolvedId && (!supplierId || resolvedId === supplierId) ? [{ id: `inbound-snapshot:${snapshot.id}`, kind: 'inbound_snapshot' as const, supplierIds: [resolvedId], title: `${snapshot.period} · ${snapshot.sourceFileName}`, productScope: snapshot.operatingProductCode || snapshot.skuMasterId, fields: { fulfillmentMode: 'warehouse' } }] : [];
    }),
  ];
  const create = () => {
    const businessSource = sourceRecordId ? sourceCandidates.find(item => item.id === sourceRecordId) : undefined;
    const sourceBusinessRecord = (data.supplierBusinessRecords ?? []).find(item => item.id === sourceRecordId);
    const periodLabel = sourceBusinessRecord ? `${sourceBusinessRecord.fields.periodStart || ''} 至 ${sourceBusinessRecord.fields.periodEnd || ''}`.trim() : '';
    const evidence = businessSource ? [
      riskReason ? `系统风险提示（待负责人核验）：${riskReason}` : '',
      periodLabel ? `统计周期：${periodLabel}` : '',
      sourceBusinessRecord?.fields.paidOrders ? `订单量：${sourceBusinessRecord.fields.paidOrders}` : '',
      sourceBusinessRecord?.fields.gmv ? `GMV：¥${sourceBusinessRecord.fields.gmv}` : '',
      `原始记录：${businessSource.title}`,
    ].filter(Boolean).join('；') : '';
    return {
      ...emptyLifecycleRecord(section),
      supplierIds: supplierId ? [supplierId] : source?.selectedSupplierIds?.length ? source.selectedSupplierIds : source?.supplierIds || [],
      businessMode: businessMode ?? source?.businessMode,
      sourceId: source?.id,
      productScope: businessSource?.productScope || source?.productScope || '',
      title: businessSource ? `代发履约复核 · ${businessSource.title}` : source?.title || '',
      sourceRecordIds: businessSource ? [businessSource.id] : [],
      evidence,
    };
  };
  const [draft, setDraft] = useState<LifecycleRecord | null>(initialMode === 'new' ? create() : initialMode === 'edit' ? existing || null : null);
  const close = () => { if (uploading) return; setView(null); setDraft(null); setError(''); onRouteClose?.(); };
  const save = () => { if (!draft || uploading) return; try { const saved = saveLifecycleRecord(draft); setDraft(null); setView(saved); setError(''); } catch (e) { setError(e instanceof Error ? e.message : '保存失败'); } };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">{config.purpose}</p><button type="button" className={businessPrimary} onClick={() => { setView(null); setDraft(create()); setError(''); }}>新增{presentation.noun}</button></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-line text-xs text-muted">{[presentation.noun, '供应商 / 适用范围', ...presentation.columns.map(label), '状态 / 期限', '操作'].map(h => <th className="px-2 py-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b border-line/60"><td className="px-2 py-4"><button className="text-action" type="button" onClick={() => setView(r)}>{r.title}</button></td><td className="px-2 py-4">{names(r)}<p className="mt-1 text-xs text-muted">{r.productScope}</p></td>{presentation.columns.map(key => <td className="max-w-64 whitespace-pre-wrap px-2 py-4" key={key}>{r.fields[key] || '未记录'}</td>)}<td className="px-2 py-4"><span className={r.hasConflict || (r.dueDate && r.dueDate < new Date().toLocaleDateString('sv-SE') && !['completed','cancelled'].includes(r.status)) ? 'font-medium text-red-600' : ''}>{r.hasConflict ? '版本冲突' : statusNames[r.status]}</span><p className="mt-1 text-xs text-muted">{r.dueDate || '未设期限'}</p></td><td className="px-2 py-4"><button type="button" className="text-action" onClick={() => setView(r)}>查看详情</button></td></tr>)}</tbody></table>{!rows.length && <p className="py-10 text-center text-sm text-muted">尚无{presentation.noun}记录。</p>}</div>
    {view && !draft && <BusinessRecordDialog title={view.title} onClose={close} footer={<button type="button" className={businessPrimary} onClick={() => { setDraft(view); setView(null); }}>编辑</button>}>
      <BusinessSection title={presentation.noun + '范围'}><BusinessFacts values={[[ '供应商', names(view)], ['适用业务', view.businessMode === 'inbound' ? '采购入仓' : view.businessMode === 'dropship' ? '一件代发' : '待明确'], [presentation.scope,view.productScope], ['负责人',view.owner], ['处理期限',view.dueDate], ['状态',statusNames[view.status]]]} /></BusinessSection>
      <BusinessSection title={section === 'admission' ? '验证标准、结果与限制' : section === 'agreements' ? '约定条款与供应商确认' : section === 'performance' ? '事实、整改与复核' : section === 'exits' ? '影响、替代与未结事项' : '需求与候选差异'}><BusinessFacts values={config.fields.map(([key,label]) => [label,view.fields[key]])} /></BusinessSection>
      <BusinessSection title="结论与原始依据"><BusinessFacts values={[[presentation.result,view.result],[presentation.evidence,view.evidence],['下一步动作',view.nextAction]]} />{view.sourceId && <Link className="mt-4 inline-block text-sm text-action" href={records.find(r => r.id === view.sourceId) ? '/supplier-lifecycle/' + records.find(r => r.id === view.sourceId)!.section + '/' + view.sourceId : '/supplier-lifecycle'}>追溯来源记录 ↗</Link>}</BusinessSection>
      {!!view.sourceRecordIds?.length && <BusinessSection title="关联业务依据">{view.sourceRecordIds.map(id => { const sourceRecord = sourceCandidates.find(r => r.id === id); return sourceRecord ? <Link className="mr-4 text-sm text-action" key={id} href={sourceRecord.kind === 'inbound_snapshot' ? `/supplier-records?supplierId=${encodeURIComponent(sourceRecord.supplierIds[0] || '')}&kind=purchase&snapshotId=${encodeURIComponent(id.slice('inbound-snapshot:'.length))}` : `/supplier-records?supplierId=${encodeURIComponent(sourceRecord.supplierIds[0] || '')}&kind=${sourceRecord.kind}&recordId=${encodeURIComponent(id)}`}>{sourceRecord.title || '查看原始记录'} →</Link> : <span className="mr-4 text-sm text-warning" key={id}>来源记录不可用：{id}</span>; })}</BusinessSection>}
      {view.offerIds.length > 0 && <BusinessSection title="关联报价版本">{view.offerIds.map(id => <Link className="mr-4 text-sm text-action" key={id} href={'/offers/' + id}>{data.offers.find(o => o.id === id)?.name || '报价记录缺失'}</Link>)}</BusinessSection>}
      <BusinessSection title="原始附件"><BusinessEvidenceFiles fields={view.fields} /></BusinessSection><details className="py-4 text-sm"><summary>修改历史 · 第 {view.revision} 版</summary>{view.history.map((version,index) => <div key={index} className="mt-4 border-t border-line pt-4"><p className="mb-3 text-xs text-muted">第 {version.revision} 版 · {version.updatedAt}</p><BusinessFacts values={[[presentation.result,version.result],['原始依据',version.evidence],...config.fields.map(([key,label]): [string,React.ReactNode] => [label,version.fields[key]])]} /></div>)}</details>
    </BusinessRecordDialog>}
    {draft && <BusinessRecordDialog title={(draft.id ? '编辑' : '新增') + presentation.noun} onClose={close} footer={<><span className="mr-auto text-xs text-muted">保存到本机 · 保留历史版本</span><button className={businessSecondary} type="button" onClick={close}>取消</button><button className={businessPrimary} type="button" disabled={uploading} onClick={save}>保存并查看</button></>}>
      <BusinessSection title={presentation.noun + '范围'}><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm">{presentation.noun}名称 *<input className={businessInput} value={draft.title} onChange={e => update({title:e.target.value})} /></label><label className="text-sm">{presentation.scope} *<input className={businessInput} value={draft.productScope} onChange={e => update({productScope:e.target.value})} /></label>{['agreements', 'performance'].includes(section) && <label className="text-sm">适用业务<select aria-label="事项适用业务" className={businessInput} value={draft.businessMode ?? ''} onChange={e => update({businessMode:e.target.value ? e.target.value as 'inbound' | 'dropship' : undefined})}><option value="">待明确</option><option value="inbound">采购入仓</option><option value="dropship">一件代发</option></select></label>}<label className="text-sm">负责人<input className={businessInput} value={draft.owner} onChange={e => update({owner:e.target.value})} /></label><label className="text-sm">处理期限<input type="date" className={businessInput} value={draft.dueDate} onChange={e => update({dueDate:e.target.value})} /></label></div><fieldset className="mt-5"><legend className="mb-3 text-sm">适用供应商</legend><div className="flex flex-wrap gap-4">{data.suppliers.filter(s => !supplierId || s.id === supplierId).map(s => <label key={s.id} className="text-sm"><input type="checkbox" className="mr-2" checked={draft.supplierIds.includes(s.id)} onChange={e => update({supplierIds:e.target.checked ? [...draft.supplierIds,s.id] : draft.supplierIds.filter(id => id !== s.id), offerIds:e.target.checked ? draft.offerIds : draft.offerIds.filter(id => data.offers.find(o => o.id === id)?.supplierId !== s.id)})} />{s.name}</label>)}</div></fieldset></BusinessSection>
      <BusinessSection title={section === 'admission' ? '核验过程与准入限制' : section === 'agreements' ? '双方约定的执行条件' : section === 'performance' ? '异常事实与整改复核' : section === 'exits' ? '退出影响与关闭安排' : '寻源比较依据'}><div className="grid gap-5 sm:grid-cols-2">{config.fields.map(([key,label,hint]) => <label key={key} className="text-sm">{label}<textarea rows={4} className={businessInput} placeholder={hint} value={draft.fields[key] || ''} onChange={e => update({fields:{...draft.fields,[key]:e.target.value}})} /></label>)}</div></BusinessSection>
      <BusinessSection title="决定与后续"><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm">{presentation.result}<textarea rows={3} className={businessInput} value={draft.result} onChange={e => update({result:e.target.value})} /></label><label className="text-sm">{presentation.evidence}<textarea rows={3} className={businessInput} value={draft.evidence} onChange={e => update({evidence:e.target.value})} /></label><label className="text-sm">状态<select className={businessInput} value={draft.status} onChange={e => update({status:e.target.value as LifecycleRecord['status']})}>{Object.entries(statusNames).map(([key,label]) => <option value={key} key={key}>{key === 'completed' ? config.done : label}</option>)}</select></label><label className="text-sm">下一步动作<input className={businessInput} value={draft.nextAction} onChange={e => update({nextAction:e.target.value})} /></label></div></BusinessSection>
      {section === 'performance' && <BusinessSection title="关联原始业务记录"><p className="mb-3 text-xs text-muted">选择已核对的周期、采购或入仓月度记录作为建议依据；原始金额不复制进建议。</p>{sourceCandidates.filter(r => r.supplierIds.some(id => draft.supplierIds.includes(id)) && (draft.businessMode === 'dropship' ? r.kind === 'dropship_period' : draft.businessMode === 'inbound' ? r.kind === 'inbound_snapshot' || r.kind === 'purchase' && r.fields.fulfillmentMode === 'warehouse' : true)).map(r => <label className="mb-2 block text-sm" key={r.id}><input className="mr-2" type="checkbox" aria-label={`关联原始记录：${r.title}`} checked={draft.sourceRecordIds?.includes(r.id) ?? false} onChange={e => update({sourceRecordIds:e.target.checked ? [...(draft.sourceRecordIds ?? []),r.id] : (draft.sourceRecordIds ?? []).filter(id => id !== r.id)})} />{r.title} · {r.productScope}</label>)}</BusinessSection>}
      {section === 'agreements' && <BusinessSection title="明确引用的报价版本"><p className="mb-3 text-xs text-muted">仅关联本次确认的报价，不默认选中历史货盘。</p>{data.offers.filter(o => o.supplierId && draft.supplierIds.includes(o.supplierId)).map(o => <label className="mb-3 block text-sm" key={o.id}><input className="mr-2" type="checkbox" checked={draft.offerIds.includes(o.id)} onChange={e => update({offerIds:e.target.checked ? [...draft.offerIds,o.id] : draft.offerIds.filter(id => id !== o.id)})} />{o.name} · {o.quotedPrice || o.taxedUnitPrice || '口径待确认'}</label>)}</BusinessSection>}
      <BusinessSection title="原始资料"><BusinessEvidenceFiles fields={draft.fields} onBusy={setUploading} onChange={fields => setDraft(current => current ? {...current,fields:{...current.fields,...fields}} : current)} /></BusinessSection>
      {draft.hasConflict && <label className="block py-4 text-sm text-red-600"><input type="checkbox" onChange={e => update({hasConflict:!e.target.checked})} /> 我已查看历史版本并核对并行修改</label>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </BusinessRecordDialog>}
  </div>;
}
