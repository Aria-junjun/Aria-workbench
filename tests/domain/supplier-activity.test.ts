import { describe, expect, it } from 'vitest';
import { classifySupplierActivity } from '@/features/workbench/supplier-activity';
import type { LocalWorkbenchData } from '@/features/workbench/local-store';

const base: LocalWorkbenchData = {
  suppliers: [
    { id: 'active', name: '活跃供应商', categories: [], riskTags: [], createdAt: '2026-01-01' },
    { id: 'low', name: '低活跃供应商', categories: [], riskTags: [], createdAt: '2026-01-01' },
    { id: 'inbound', name: '入仓供应商', categories: [], riskTags: [], createdAt: '2026-01-01' },
    { id: 'unknown', name: '无近期数据', categories: [], riskTags: [], createdAt: '2026-01-01' },
  ],
  communications: [], offers: [], products: [], tasks: [], knowledgeCards: [], knowledgeBooks: [], decisionTools: [], knowledgeApplications: [], decisionCases: [], researchReports: [],
  supplierBusinessRecords: [
    { id: 'a', kind: 'dropship_period', supplierIds: ['active'], offerIds: [], productScope: '', status: 'completed', title: '', owner: '', fields: { periodStart: '2026-09-01', periodEnd: '2026-09-15', paidOrders: '30' }, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
    { id: 'l', kind: 'dropship_period', supplierIds: ['low'], offerIds: [], productScope: '', status: 'completed', title: '', owner: '', fields: { periodStart: '2026-09-10', periodEnd: '2026-09-20', paidOrders: '29' }, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
    { id: 'old', kind: 'dropship_period', supplierIds: ['low'], offerIds: [], productScope: '', status: 'completed', title: '', owner: '', fields: { periodStart: '2026-07-01', periodEnd: '2026-07-30', paidOrders: '1000' }, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
    { id: 'i', kind: 'purchase', supplierIds: ['inbound'], offerIds: [], productScope: '', status: 'completed', title: '', owner: '', fields: { fulfillmentMode: 'warehouse' }, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
  ],
};

describe('supplier activity classification', () => {
  it('puts suppliers with fewer than 30 recent paid orders into low activity without applying the rule to inbound suppliers', () => {
    const result = classifySupplierActivity(base, new Date('2026-09-29T12:00:00Z'));
    expect(result).toEqual({ active: { band: 'active', paidOrders: 30 }, low: { band: 'low', paidOrders: 29 }, inbound: { band: 'not-applicable' }, unknown: { band: 'unknown' } });
  });

  it('excludes periods whose end date is outside the latest 30 calendar days', () => {
    const data = { ...base, supplierBusinessRecords: base.supplierBusinessRecords?.filter(record => record.id !== 'a') };
    expect(classifySupplierActivity(data, new Date('2026-09-29T12:00:00Z')).low).toEqual({ band: 'low', paidOrders: 29 });
  });
});
