'use client';

import React from 'react';
import { businessInput } from './business-record-dialog';
import type { ProcurementLineItem } from '@/features/workbench/procurement';

// Shared by request entry and inquiry detail; optional fields preserve older records.
export const procurementTable = 'w-full border-collapse border border-line text-left text-sm [&_th]:border [&_th]:border-line [&_th]:bg-action-soft/50 [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-ink [&_td]:border [&_td]:border-line [&_td]:bg-surface [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td]:break-words [&_tbody_tr:hover_td]:bg-paper';

export function validProductUrl(value: string) {
  if (!value.trim()) return true;
  try { return ['http:', 'https:'].includes(new URL(value.trim()).protocol); } catch { return false; }
}

export function ProductLink({ value, label = '查看产品' }: { value?: string; label?: string }) {
  return value && validProductUrl(value) ? <a className="text-action underline underline-offset-4" href={value.trim()} target="_blank" rel="noopener noreferrer">{label} ↗</a> : <span className="text-muted">未记录</span>;
}

export function ProcurementLineFields({ item, onChange }: { item: ProcurementLineItem; onChange: (item: ProcurementLineItem) => void }) {
  return <div className="grid gap-4 text-sm sm:grid-cols-2">
    <label>产品属性<select className={businessInput} value={item.productType || ''} onChange={e => onChange({ ...item, productType: e.target.value })}><option value="">待确认</option><option>新产品</option><option>已有产品</option></select></label>
    <label>收货地点 / 仓库<input className={businessInput} value={item.receivingLocation || ''} onChange={e => onChange({ ...item, receivingLocation: e.target.value })} /></label>
    <label className="sm:col-span-2">需求参考链接（产品或图片）<input className={businessInput} type="url" placeholder="https://" value={item.referenceUrl || ''} onChange={e => onChange({ ...item, referenceUrl: e.target.value })} /></label>
    <label className="sm:col-span-2">关键要求 / 验收标准<textarea className={businessInput} rows={3} placeholder="如材质、尺寸、包装和验收要求" value={item.requirements || ''} onChange={e => onChange({ ...item, requirements: e.target.value })} /></label>
  </div>;
}

export function ProcurementLineFacts({ item }: { item: ProcurementLineItem }) {
  return <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
    <div><dt className="text-xs text-muted">产品属性</dt><dd className="mt-1">{item.productType || '待确认'}</dd></div>
    <div><dt className="text-xs text-muted">收货地点 / 仓库</dt><dd className="mt-1">{item.receivingLocation || '未记录'}</dd></div>
    <div><dt className="text-xs text-muted">需求参考</dt><dd className="mt-1"><ProductLink value={item.referenceUrl} label="查看参考产品 / 图片" /></dd></div>
    <div className="sm:col-span-2"><dt className="text-xs text-muted">关键要求 / 验收标准</dt><dd className="mt-1 whitespace-pre-wrap">{item.requirements || '未记录'}</dd></div>
  </dl>;
}
