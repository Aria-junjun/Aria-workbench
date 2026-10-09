'use client';

import React from 'react';
import { businessSecondary } from './business-record-dialog';
import { ProductLink, procurementTable } from './procurement-line-details';
import type { ProcurementLineItem, QuoteOffer, SupplierCandidate } from '@/features/workbench/procurement';

export function ProcurementSkuComparison({ line, candidates, offers, locked, onEditOffer, onSelect }: {
  line: ProcurementLineItem; candidates: SupplierCandidate[]; offers: QuoteOffer[]; locked: boolean;
  onEditOffer: (candidateId: string, lineId: string) => void; onSelect: (lineId: string) => void;
}) {
  const selected = offers.find(offer => offer.lineItemId === line.id && offer.selected && candidates.some(candidate => candidate.id === offer.supplierCandidateId));
  const supplier = candidates.find(candidate => candidate.id === selected?.supplierCandidateId);
  return <section className="mb-8 last:mb-0" aria-label={`${line.productName}对比`}>
    <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1"><h4 className="font-semibold">{line.productName} · 对比</h4><span className="text-xs text-muted">{line.sku || '暂无 SKU'} · 采购数量：{line.quantity || '未定'} {line.unit || ''}</span></div>
    <div className="w-full overflow-x-auto"><table className={`${procurementTable} min-w-[1140px] table-fixed`}>
      <thead><tr><th className="w-[17%]">供应商 / 商品</th><th className="w-[8%] text-right">产品单价</th><th className="w-[7%] text-right">邮费</th><th className="w-[9%] text-right">综合成本</th><th className="w-[22%]">售后成本 / 约定</th><th className="w-[6%] text-right">税点</th><th className="w-[7%] text-right">起订量</th><th className="w-[15%]">交期 / 截单</th><th className="w-[9%]">报价操作</th></tr></thead>
      <tbody>{candidates.map(candidate => {
        const saved = offers.find(offer => offer.lineItemId === line.id && offer.supplierCandidateId === candidate.id);
        return <tr key={candidate.id}>
          <td><p className="font-medium">{candidate.name}</p><div className="mt-1 text-xs">{saved?.productUrl ? <ProductLink value={saved.productUrl} label="供应商商品" /> : <span className="text-muted">{saved ? '商品链接未填' : '未报价'}</span>}</div>{saved?.note && <p className="mt-2 whitespace-pre-wrap text-xs text-muted">备注：{saved.note}</p>}</td>
          <td className="text-right tabular-nums">{saved?.productUnitPrice || saved?.unitPrice || '—'}</td><td className="text-right tabular-nums">{saved?.freight || '—'}</td><td className="text-right font-semibold tabular-nums">{saved?.comprehensiveCost || '—'}</td><td className="whitespace-pre-wrap">{saved?.afterSalesCost || '—'}</td><td className="text-right tabular-nums">{saved?.taxRate || '—'}</td><td className="text-right tabular-nums">{saved?.moq || '—'}</td><td className="whitespace-pre-wrap">{saved?.leadTime || '—'}</td><td>{!locked ? <button className="whitespace-nowrap text-action hover:underline" onClick={() => onEditOffer(candidate.id, line.id)} type="button">{saved ? '编辑报价' : '录入报价'}</button> : <span className="text-muted">已锁定</span>}</td>
        </tr>;
      })}</tbody>
    </table></div>
    <div className="mt-3 flex flex-wrap items-start justify-between gap-4 border-l-2 border-red-400 bg-red-50/50 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-2 text-sm text-red-700"><p className="font-semibold">最终选用：{supplier?.name || '待确定'}</p><p className="whitespace-pre-wrap break-words leading-6"><span className="font-medium">选用原因：</span>{selected?.selectionReason || '待填写'}</p></div>
      {!locked && <button className={businessSecondary} onClick={() => onSelect(line.id)} type="button">{selected ? '修改选用' : '确定选用'}</button>}
    </div>
  </section>;
}
