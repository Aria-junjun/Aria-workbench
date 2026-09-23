'use client';
import React, { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { BusinessEvidenceFiles } from './business-evidence-files';
import { useWorkbenchData } from '@/features/workbench/workbench-store';
import { SupplierBusinessLedger } from './supplier-business-ledger';
import { SupplierStageRecords } from './supplier-stage-records';
import { BusinessFacts, BusinessSection, businessSecondary } from './business-record-dialog';
import { deriveSupplierBusinessModes } from '@/features/workbench/dropship-decision-loop';

const tabs = [ ['overview','综合概况'], ['identity','基础与资质'], ['offers','产品与报价'], ['admission','送样与准入'], ['agreements','合作约定'], ['performance','履约与改善'], ['exits','暂停与退出'] ] as const;
export function SupplierProfileWorkspace({ supplierId, performance, overview, onEdit }: { supplierId: string; performance?: ReactNode; overview?: ReactNode; onEdit: () => void }) {
  const data = useWorkbenchData();
  const [tab, setTab] = useState<string>('overview');
  const supplier = data.suppliers.find(s => s.id === supplierId);
  if (!supplier) return null;
  const business = (data.supplierBusinessRecords ?? []).filter(r => r.supplierIds.includes(supplierId));
  const stages = (data.supplierLifecycleRecords ?? []).filter(r => r.supplierIds.includes(supplierId));
  const offers = data.offers.filter(o => o.supplierId === supplierId || (!o.supplierId && o.supplierName === supplier.name));
  const pending = stages.filter(r => !['completed','cancelled'].includes(r.status));
  const scopes = [...new Set([...business.map(r => r.productScope), ...stages.map(r => r.productScope)].filter(Boolean))];
  const modes = deriveSupplierBusinessModes(data, supplierId);
  return <div className="space-y-6">
    {modes.length > 0 && <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted">合作模式</span>{modes.map(mode => <span className="rounded bg-action-soft px-2 py-1 text-action" key={mode}>{mode === 'dropship' ? '代发' : '入仓'}</span>)}</div>}
    <nav aria-label="供应商档案页签" className="flex gap-6 overflow-x-auto border-b border-line">{tabs.map(([key,label]) => <button type="button" aria-pressed={tab === key} key={key} className={'shrink-0 border-b-2 px-1 py-4 text-sm ' + (tab === key ? 'border-action font-semibold text-action' : 'border-transparent text-muted hover:text-ink')} onClick={() => setTab(key)}>{label}</button>)}</nav>
    <div key={tab}>
      {tab === 'overview' && <>
        <BusinessSection title="合作全貌"><BusinessFacts values={[[ '当前合作状态', supplier.archivedAt ? '已停用' : supplier.cooperationLevel || '尚未记录合作等级'], ['涉及产品 / SKU',scopes.join('、') || '尚无业务记录'], ['主要风险',supplier.riskTags.length ? <span className="text-red-600">{supplier.riskTags.join('、')}</span> : '尚未记录风险标签'], ['关键合作条件', stages.filter(r => r.section === 'agreements' && r.status === 'completed').map(r => r.fields.terms).filter(Boolean).join('\n') || '暂无已确认约定']]} /></BusinessSection>
        <BusinessSection title="待办与重要异常">{pending.length ? <ul className="divide-y divide-line">{pending.map(r => <li key={r.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><Link className="text-action" href={'/supplier-lifecycle/' + r.section + '/' + r.id}>{r.title} ↗</Link><span>{r.nextAction || '待明确下一步'} · {r.owner || '待分配'}</span><span className={r.dueDate && r.dueDate < new Date().toLocaleDateString('sv-SE') ? 'text-red-600' : 'text-muted'}>{r.dueDate || '未设期限'}</span></li>)}</ul> : <p className="text-sm text-muted">暂无未完成的管理事项；不代表所有合作均已核验。</p>}</BusinessSection>
        {overview}
      </>}
      {tab === 'identity' && <>
        <BusinessSection title="主体与联系方式" action={<button type="button" onClick={onEdit} className={businessSecondary}>编辑基础资料</button>}><BusinessFacts values={[[ '供应商名称', supplier.name], ['联系人',supplier.contactName], ['联系方式',supplier.contactMethod], ['地区',supplier.location], ['供应商类型',({factory:'工厂',trader:'贸易商',unknown:'尚未判断'} as Record<string,string>)[supplier.supplierType || 'unknown'] || supplier.supplierType], ['主营品类',supplier.categories.join('、')], ['来源平台',supplier.sourcePlatform], ['店铺链接',supplier.storeUrl && /^https?:\/\//i.test(supplier.storeUrl) ? <a className="text-action" href={supplier.storeUrl} target="_blank" rel="noreferrer">查看店铺 ↗</a> : supplier.storeUrl], ['生产 / 资质补充资料',supplier.notes]]} /></BusinessSection>
        <BusinessSection title="资质与核验依据" action={<button className={businessSecondary} type="button" onClick={() => setTab('admission')}>记录核验 / 上传证件</button>}><p className="mb-4 text-sm text-muted">只展示已记录的验证要求和实际核验结果；未记录的证照不标记为合格。</p>{stages.filter(r => r.section === 'admission').map(r => <div className="border-b border-line py-4" key={r.id}><Link className="text-sm text-action" href={'/supplier-lifecycle/admission/' + r.id}>{r.title} ↗</Link><div className="mt-4"><BusinessFacts values={[[ '适用范围',r.productScope], ['验证要求',r.fields.standard], ['实际核验',r.fields.verification], ['核验依据',r.evidence]]} /><BusinessEvidenceFiles fields={r.fields} /></div></div>)}{!stages.some(r => r.section === 'admission') && <p className="text-sm text-muted">暂无核验依据，请在「送样与准入」记录真实核验情况。</p>}</BusinessSection>
      </>}
      {tab === 'offers' && <BusinessSection title="该供应商的产品与历史报价" action={<Link className={businessSecondary} href="/offers">维护货盘报价 ↗</Link>}><p className="mb-5 text-sm text-muted">这里是历史资料，不自动进入当前采购比价。打开原报价可查看 SKU、规格、税运口径及版本资料。</p><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-line text-xs text-muted">{['产品 / 报价','规格','价格','税运口径','起订量','交期','原始记录'].map(h => <th key={h} className="px-2 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{offers.map(o => <tr key={o.id} className="border-b border-line/60"><td className="px-2 py-4">{o.name}</td><td className="px-2 py-4">{o.specs || o.keySpecs || '未记录'}</td><td className="px-2 py-4">{o.quotedPrice || o.taxedUnitPrice || '未记录'}</td><td className="px-2 py-4">{o.taxFreightTerms || '口径待确认'}</td><td className="px-2 py-4">{o.moq || '未记录'}</td><td className="px-2 py-4">{o.leadTime || '未记录'}</td><td className="px-2 py-4"><Link className="text-action" href={'/offers/' + o.id}>查看 / 编辑 ↗</Link></td></tr>)}</tbody></table>{!offers.length && <p className="py-10 text-center text-sm text-muted">该供应商暂无产品报价。</p>}</div></BusinessSection>}
      {tab === 'admission' && <><BusinessSection title="寄样与逐项核验"><SupplierBusinessLedger supplierId={supplierId} kinds={['sample','inspection']} embedded /></BusinessSection><BusinessSection title="准入决定 · 按产品范围"><SupplierStageRecords section="admission" supplierId={supplierId} /></BusinessSection></>}
      {tab === 'agreements' && <><SupplierStageRecords section="agreements" supplierId={supplierId} />{business.some(r => r.kind === 'agreement') && <BusinessSection title="历史合作约定台账"><SupplierBusinessLedger supplierId={supplierId} kinds={['agreement']} embedded /></BusinessSection>}</>}
      {tab === 'performance' && <>{modes.includes('dropship') && <BusinessSection title="代发履约"><SupplierBusinessLedger supplierId={supplierId} kinds={['dropship_period']} embedded /></BusinessSection>}{modes.includes('inbound') && <BusinessSection title="入仓履约"><SupplierBusinessLedger supplierId={supplierId} kinds={['purchase']} embedded /></BusinessSection>}<BusinessSection title="异常与整改闭环"><SupplierStageRecords section="performance" supplierId={supplierId} /></BusinessSection><BusinessSection title="月度履约与成本依据">{performance}</BusinessSection></>}
      {tab === 'exits' && <SupplierStageRecords section="exits" supplierId={supplierId} />}
    </div>
  </div>;
}
