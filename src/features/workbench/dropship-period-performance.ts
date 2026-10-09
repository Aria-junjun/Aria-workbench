import type { SupplierBusinessRecord } from './supplier-business';
import type { LocalWorkbenchData } from './local-store';

export type DropshipPeriodMetrics = {
  periodStart: string; periodEnd: string; platform: string; paidOrders?: number; gmv?: number;
  pickup48Rate?: number; paymentToSignHours?: number; refundRate?: number; rejectReturnRate?: number; response3mRate?: number;
  afterSalesCount?: number; afterSalesRate?: number; rejectedAfterSalesCount?: number; rejectedAfterSalesRate?: number;
  averageRefundSeconds?: number; lighthouseScore?: number; platformRank?: number;
};

export type ProductSupplierComparisonRow = DropshipPeriodMetrics & {
  productName: string;
  supplierId: string;
  supplierName: string;
  sourceFile?: string;
  sourceLevel: 'product-period';
};

export type SupplierPerformanceOverviewRow = DropshipPeriodMetrics & {
  supplierId: string;
  supplierName: string;
  periodCount: number;
  riskCount: number;
  risks: string[];
  sampleBand: SampleBand;
};

export type SampleBand = 'unknown' | 'insufficient' | 'observe' | 'scoreable';
export const sampleBandNames: Record<SampleBand, string> = { unknown:'数据待补', insufficient: '样本不足', observe: '观察期', scoreable: '可评价' };

export function analyzeDropshipPeriod(metrics: DropshipPeriodMetrics) {
  const sampleBand: SampleBand = metrics.paidOrders == null ? 'unknown' : metrics.paidOrders < 20 ? 'insufficient' : metrics.paidOrders < 100 ? 'observe' : 'scoreable';
  const risks: string[] = [];
  if (sampleBand === 'unknown') return { sampleBand, risks };
  if (metrics.pickup48Rate != null && metrics.pickup48Rate < 95) risks.push('揽收时效异常');
  if (metrics.paymentToSignHours != null && metrics.paymentToSignHours > 72) risks.push('签收时长偏高');
  if ((metrics.refundRate != null && metrics.refundRate > 10) || (metrics.afterSalesRate != null && metrics.afterSalesRate > 10)) risks.push('退款率偏高');
  if ((metrics.rejectReturnRate != null && metrics.rejectReturnRate > 10) || (metrics.rejectedAfterSalesRate != null && metrics.rejectedAfterSalesRate > 10)) risks.push('拒退风险');
  if (metrics.response3mRate != null && metrics.response3mRate < 70) risks.push('客服响应偏低');
  if (metrics.paidOrders != null && metrics.paidOrders >= 100 && risks.length) risks.push('高量高风险');
  return { sampleBand, risks };
}

export function dropshipOverview(items: DropshipPeriodMetrics[]) {
  const totalOrders = items.reduce((sum, item) => sum + (item.paidOrders ?? 0), 0);
  const weighted = (read: (item: DropshipPeriodMetrics) => number | undefined) => {
    const valid = items.filter(item => read(item) != null && item.paidOrders != null);
    const orders = valid.reduce((sum,item) => sum + (item.paidOrders ?? 0),0);
    return orders ? valid.reduce((sum,item) => sum + (read(item) as number) * (item.paidOrders ?? 0),0) / orders : undefined;
  };
  return { totalOrders, totalGmv: items.reduce((sum, item) => sum + (item.gmv ?? 0), 0), weightedPickup48Rate: weighted(item => item.pickup48Rate), weightedRefundRate: weighted(item => item.refundRate), scoreableCount: items.filter(item => analyzeDropshipPeriod(item).sampleBand === 'scoreable').length, riskCount: items.filter(item => analyzeDropshipPeriod(item).risks.length > 0).length };
}

const number = (value?: string) => value == null || value === '' ? undefined : Number(value);
export function dropshipMetricsFromRecord(record: SupplierBusinessRecord): DropshipPeriodMetrics {
  return { periodStart: record.fields.periodStart || '', periodEnd: record.fields.periodEnd || '', platform: record.fields.platform || '', paidOrders: number(record.fields.paidOrders), gmv: number(record.fields.gmv), pickup48Rate: number(record.fields.pickup48Rate), paymentToSignHours: number(record.fields.paymentToSignHours), refundRate: number(record.fields.refundRate), rejectReturnRate: number(record.fields.rejectReturnRate), response3mRate: number(record.fields.response3mRate), afterSalesCount: number(record.fields.afterSalesCount), afterSalesRate: number(record.fields.afterSalesRate), rejectedAfterSalesCount: number(record.fields.rejectedAfterSalesCount), rejectedAfterSalesRate: number(record.fields.rejectedAfterSalesRate), averageRefundSeconds: number(record.fields.averageRefundSeconds), lighthouseScore: number(record.fields.lighthouseScore), platformRank: number(record.fields.platformRank) };
}

export function buildSupplierPerformanceOverview(data: LocalWorkbenchData, weeks: 1 | 4 | 13 = 1): SupplierPerformanceOverviewRow[] {
  const records = (data.supplierBusinessRecords ?? []).filter(record => record.kind === 'dropship_period');
  const periodEnds = [...new Set(records.map(record => record.fields.periodEnd).filter(Boolean))].sort((a, b) => b.localeCompare(a)).slice(0, weeks);
  const selected = new Set(periodEnds);
  const grouped = new Map<string, DropshipPeriodMetrics[]>();
  for (const record of records) {
    if (!selected.has(record.fields.periodEnd || '')) continue;
    for (const supplierId of record.supplierIds) {
      const list = grouped.get(supplierId) ?? [];
      list.push(dropshipMetricsFromRecord(record));
      grouped.set(supplierId, list);
    }
  }
  const weighted = (items: DropshipPeriodMetrics[], read: (item: DropshipPeriodMetrics) => number | undefined) => {
    const valid = items.filter(item => read(item) != null && item.paidOrders != null);
    const orders = valid.reduce((sum, item) => sum + (item.paidOrders ?? 0), 0);
    return orders ? valid.reduce((sum, item) => sum + (read(item) as number) * (item.paidOrders ?? 0), 0) / orders : undefined;
  };
  return [...grouped.entries()].map(([supplierId, items]) => {
    const first = items[0];
    const aggregate: DropshipPeriodMetrics = {
      periodStart: periodEnds.at(-1) ?? '', periodEnd: periodEnds[0] ?? '', platform: first.platform,
      paidOrders: items.some(item => item.paidOrders != null) ? items.reduce((sum, item) => sum + (item.paidOrders ?? 0), 0) : undefined,
      gmv: items.some(item => item.gmv != null) ? items.reduce((sum, item) => sum + (item.gmv ?? 0), 0) : undefined,
      pickup48Rate: weighted(items, item => item.pickup48Rate), paymentToSignHours: weighted(items, item => item.paymentToSignHours),
      refundRate: weighted(items, item => item.refundRate), rejectReturnRate: weighted(items, item => item.rejectReturnRate), response3mRate: weighted(items, item => item.response3mRate),
      afterSalesCount: items.reduce((sum, item) => sum + (item.afterSalesCount ?? 0), 0), afterSalesRate: weighted(items, item => item.afterSalesRate),
    };
    const assessment = analyzeDropshipPeriod(aggregate);
    return { ...aggregate, supplierId, supplierName: data.suppliers.find(supplier => supplier.id === supplierId)?.shortName || data.suppliers.find(supplier => supplier.id === supplierId)?.name || '供应商档案缺失', periodCount: new Set(items.map(item => `${item.platform}|${item.periodStart}|${item.periodEnd}`)).size, riskCount: assessment.risks.length, risks: assessment.risks, sampleBand: assessment.sampleBand };
  }).sort((a, b) => (b.paidOrders ?? 0) - (a.paidOrders ?? 0));
}

export function buildProductSupplierComparison(data: LocalWorkbenchData, productName: string): ProductSupplierComparisonRow[] {
  return (data.dropshipProductPeriods ?? [])
    .filter(item => item.businessMode === 'dropship' && item.productName === productName && item.supplierId)
    .map(item => ({
      productName: item.productName,
      supplierId: item.supplierId as string,
      supplierName: data.suppliers.find(supplier => supplier.id === item.supplierId)?.name ?? '供应商档案缺失',
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
      platform: item.platform,
      paidOrders: item.paidOrders,
      gmv: item.gmv,
      pickup48Rate: item.pickup48Rate,
      paymentToSignHours: item.paymentToSignHours,
      refundRate: item.refundRate,
      rejectReturnRate: item.rejectReturnRate,
      sourceFile: item.fileName,
      sourceLevel: 'product-period' as const,
    }));
}

export function validateDropshipMetrics(metrics: DropshipPeriodMetrics) {
  if (!metrics.periodStart || !metrics.periodEnd || metrics.periodEnd < metrics.periodStart) throw new Error('请填写有效统计周期');
  if (!metrics.platform.trim()) throw new Error('请填写数据平台');
  if (metrics.paidOrders == null || metrics.gmv == null || !Number.isFinite(metrics.paidOrders) || metrics.paidOrders < 0 || !Number.isFinite(metrics.gmv) || metrics.gmv < 0) throw new Error('请填写有效的订单量和GMV');
  for (const [label, value] of [['48小时揽收率', metrics.pickup48Rate], ['退款率', metrics.refundRate], ['拒退率', metrics.rejectReturnRate], ['3分钟响应率', metrics.response3mRate]] as const) if (value != null && (!Number.isFinite(value) || value < 0 || value > 100)) throw new Error(`${label}应在0到100之间`);
}
