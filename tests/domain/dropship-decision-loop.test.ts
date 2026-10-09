import { describe, expect, it } from 'vitest';
import { buildDropshipDecisionSummary, resolvePendingDropshipSupplier } from '@/features/workbench/dropship-decision-loop';
import { normalizeWorkbenchData } from '@/features/workbench/local-store';

const supplier = (id: string, name: string) => ({ id, name, categories: [], riskTags: [], createdAt: '' });
const period = (id: string, supplierId: string, orders: number, pickup: number, refund: number, start = '2026-09-14') => ({
  id, kind: 'dropship_period' as const, supplierIds: [supplierId], offerIds: [], productScope: '全店代发', status: 'completed' as const,
  title: '周期履约', owner: '', attachmentIds: [], revision: 1, createdAt: '', updatedAt: '',
  fields: { periodStart: start, periodEnd: start === '2026-09-14' ? '2026-09-20' : '2026-09-13', platform: '1688', paidOrders: String(orders), gmv: String(orders * 10), pickup48Rate: String(pickup), paymentToSignHours: '50', refundRate: String(refund), rejectReturnRate: '0', response3mRate: '90' },
});

describe('dropship decision loop', () => {
  it('does not turn missing rates into zero-value risks or weighted metrics', () => {
    const data = normalizeWorkbenchData({ suppliers:[supplier('a','缺字段商家')], supplierBusinessRecords:[{
      id:'missing',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'全店',status:'completed',title:'周期',owner:'',attachmentIds:[],revision:1,createdAt:'',updatedAt:'',fields:{periodStart:'2026-09-14',periodEnd:'2026-09-20',platform:'1688',paidOrders:'40',gmv:'500'}
    }]});
    const result = buildDropshipDecisionSummary(data);
    expect(result.riskCount).toBe(0);
    expect(result.missingDataCount).toBe(1);
    expect(result.weightedPickup48Rate).toBeUndefined();
    expect(result.trendLabel).toBe('暂无趋势');
  });
  it('summarizes only the latest period and excludes small samples from formal risk ranking', () => {
    const data = normalizeWorkbenchData({ suppliers: [supplier('a', '高量风险商家'), supplier('b', '低样本商家')], supplierBusinessRecords: [
      period('new-a', 'a', 120, 90, 12), period('new-b', 'b', 10, 80, 20), period('old', 'a', 999, 100, 0, '2026-09-07'),
    ], pendingDropshipSuppliers: [
      { id: 'p1', sourceName: '待建档甲', platform: '1688', periodStart: '2026-09-14', periodEnd: '2026-09-20', paidOrders: 30, gmv: 300, filingBand: 'eligible', sourceFileName: 'a.xlsx', createdAt: '' },
      { id: 'p2', sourceName: '小样本', platform: '1688', periodStart: '2026-09-14', periodEnd: '2026-09-20', paidOrders: 2, gmv: 20, filingBand: 'insufficient', sourceFileName: 'a.xlsx', createdAt: '' },
    ] });
    const result = buildDropshipDecisionSummary(data);
    expect(result.periodLabel).toBe('2026-09-14 至 2026-09-20');
    expect(result.totalOrders).toBe(130);
    expect(result.risks.map(item => item.supplierName)).toEqual(['高量风险商家']);
    expect(result.risks[0].reasons).toContain('高量高风险（日均 17.1 单）');
    expect(result.risks[0].reasons).toContain('退款率 12%');
    expect(result.pendingActiveCount).toBe(2);
    expect(result.pendingInsufficientCount).toBe(1);
  });

  it('links, creates, observes and archives pending suppliers without deleting history', () => {
    const pending = { id: 'p1', sourceName: '来源商家', platform: '1688', periodStart: '2026-09-14', periodEnd: '2026-09-20', paidOrders: 30, gmv: 300, filingBand: 'eligible' as const, sourceFileName: 'a.xlsx', createdAt: '', afterSalesRejectCount:2, afterSalesRejectRate:6.67, lighthouseAfterSales:4, lighthouseQuality:3.5, lighthouseScore:3.9 };
    const base = normalizeWorkbenchData({ suppliers: [supplier('a', '正式商家')], pendingDropshipSuppliers: [pending] });
    const linked = resolvePendingDropshipSupplier(base, 'p1', { type: 'link', supplierId: 'a' });
    expect(linked.pendingDropshipSuppliers?.[0].status).toBe('resolved');
    expect(linked.supplierBusinessRecords?.[0].supplierIds).toEqual(['a']);
    expect(linked.supplierBusinessRecords?.[0].fields).toMatchObject({ rejectedAfterSalesCount:'2', rejectedAfterSalesRate:'6.67', lighthouseAfterSales:'4', lighthouseQuality:'3.5', lighthouseScore:'3.9' });
    const created = resolvePendingDropshipSupplier(base, 'p1', { type: 'create' });
    expect(created.suppliers.some(item => item.name === '来源商家')).toBe(true);
    expect(created.supplierBusinessRecords).toHaveLength(1);
    const observed = resolvePendingDropshipSupplier(base, 'p1', { type: 'observe' });
    expect(observed.pendingDropshipSuppliers?.[0].status).toBe('observing');
    const archived = resolvePendingDropshipSupplier(observed, 'p1', { type: 'archive' });
    expect(archived.pendingDropshipSuppliers?.[0].status).toBe('archived');
    expect(archived.pendingDropshipSuppliers?.[0].sourceName).toBe('来源商家');
  });
});
