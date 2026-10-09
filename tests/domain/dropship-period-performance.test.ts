import { describe, expect, it } from 'vitest';
import { analyzeDropshipPeriod, buildProductSupplierComparison, buildSupplierPerformanceOverview, dropshipMetricsFromRecord, dropshipOverview, type DropshipPeriodMetrics } from '@/features/workbench/dropship-period-performance';
import { normalizeWorkbenchData } from '@/features/workbench/local-store';

const metrics = (patch: Partial<DropshipPeriodMetrics> = {}): DropshipPeriodMetrics => ({ periodStart: '2026-09-04', periodEnd: '2026-09-18', platform: '1688', paidOrders: 120, gmv: 6000, pickup48Rate: 99, paymentToSignHours: 50, refundRate: 3, rejectReturnRate: 0, response3mRate: 90, ...patch });

describe('dropship period performance', () => {
  it('aggregates supplier performance for one, four, or thirteen periods without changing source records', () => {
    const base = (id:string, supplierId:string, end:string, orders:number, gmv:number, refund:number) => ({ id, kind:'dropship_period' as const, supplierIds:[supplierId], offerIds:[], productScope:'全店代发', status:'completed' as const, title:end, owner:'', fields:{periodStart:end,periodEnd:end,platform:'1688',paidOrders:String(orders),gmv:String(gmv),pickup48Rate:'100',paymentToSignHours:'50',refundRate:String(refund),afterSalesRate:String(refund)}, attachmentIds:[], revision:1, createdAt:'', updatedAt:'' });
    const data = normalizeWorkbenchData({ suppliers:[{id:'s1',name:'供应商甲',shortName:'甲厂',categories:[],riskTags:[],createdAt:''}], supplierBusinessRecords:[base('1','s1','2026-09-07',10,100,2),base('2','s1','2026-09-14',30,300,4),base('3','s1','2026-09-21',60,600,6),base('4','s1','2026-09-28',100,1000,8)] });
    const result = buildSupplierPerformanceOverview(data, 4);
    expect(result[0]).toMatchObject({supplierName:'甲厂', periodCount:4, paidOrders:200, gmv:2000, refundRate:6.5});
    expect(data.supplierBusinessRecords).toHaveLength(4);
  });
  it('compares suppliers horizontally for one product and retains the source period', () => {
    const result = buildProductSupplierComparison({
      suppliers:[{ id:'s1', name:'甲厂', categories:[], riskTags:[], createdAt:'' }, { id:'s2', name:'乙厂', categories:[], riskTags:[], createdAt:'' }],
      dropshipProductPeriods:[
        { id:'p1', businessKey:'p1', productName:'毛毡板', supplierId:'s1', businessMode:'dropship', periodStart:'2026-09-01', periodEnd:'2026-09-07', platform:'1688', fileName:'a.xlsx', importedAt:'', paidOrders:100, gmv:1000, pickup48Rate:99, paymentToSignHours:40, refundRate:2, rejectReturnRate:1 },
        { id:'p2', businessKey:'p2', productName:'毛毡板', supplierId:'s2', businessMode:'dropship', periodStart:'2026-09-01', periodEnd:'2026-09-07', platform:'1688', fileName:'a.xlsx', importedAt:'', paidOrders:80, gmv:900, pickup48Rate:96, paymentToSignHours:50, refundRate:4, rejectReturnRate:2 },
      ],
    } as never, '毛毡板');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ supplierName:'甲厂', productName:'毛毡板', paidOrders:100, pickup48Rate:99, periodStart:'2026-09-01' });
  });
  it('uses order volume as a sample gate', () => {
    expect(analyzeDropshipPeriod(metrics({ paidOrders: 10 })).sampleBand).toBe('insufficient');
    expect(analyzeDropshipPeriod(metrics({ paidOrders: 50 })).sampleBand).toBe('observe');
    expect(analyzeDropshipPeriod(metrics({ paidOrders: 100 })).sampleBand).toBe('scoreable');
  });

  it('keeps missing scale metrics unknown and does not evaluate them as zero-volume risk data', () => {
    const imported = dropshipMetricsFromRecord({ id:'blank', kind:'dropship_period', supplierIds:['a'], offerIds:[], productScope:'全店代发', status:'completed', title:'空白规模', owner:'', fields:{ periodStart:'2026-09-04', periodEnd:'2026-09-18', platform:'1688' }, attachmentIds:[], revision:1, createdAt:'', updatedAt:'' });

    expect(imported.paidOrders).toBeUndefined();
    expect(imported.gmv).toBeUndefined();
    expect(analyzeDropshipPeriod(imported)).toEqual({ sampleBand:'unknown', risks:[] });
  });

  it('flags high-volume operational risks without turning platform rank into a score', () => {
    const result = analyzeDropshipPeriod(metrics({ paidOrders: 500, pickup48Rate: 89, refundRate: 13, response3mRate: 40 }));
    expect(result.risks).toEqual(expect.arrayContaining(['揽收时效异常', '退款率偏高', '客服响应偏低', '高量高风险']));
  });

  it('builds weighted overview values', () => {
    const summary = dropshipOverview([metrics({ paidOrders: 100, pickup48Rate: 90, refundRate: 10 }), metrics({ paidOrders: 300, pickup48Rate: 100, refundRate: 2 })]);
    expect(summary.totalOrders).toBe(400);
    expect(summary.weightedPickup48Rate).toBeCloseTo(97.5);
    expect(summary.weightedRefundRate).toBeCloseTo(4);
  });
});
