import type { LocalSupplier, LocalWorkbenchData } from './local-store';
import type { PendingDropshipSupplier } from './dropship-performance-import';
import type { SupplierBusinessRecord } from './supplier-business';
import { analyzeDropshipPeriod, dropshipMetricsFromRecord, dropshipOverview } from './dropship-period-performance';
import { loadProcurementRecords } from './procurement';

export type DropshipRiskItem = { supplierId: string; supplierName: string; paidOrders: number; gmv: number; reasons: string[] };
export type DropshipDecisionSummary = {
  periodStart: string; periodEnd: string; periodLabel: string; totalOrders: number; totalGmv: number;
  weightedPickup48Rate?: number; weightedRefundRate?: number; scoreableCount: number; riskCount: number;
  missingDataCount: number; trendLabel: string;
  pendingActiveCount: number; pendingInsufficientCount: number; risks: DropshipRiskItem[];
};
export type PendingDropshipAction = { type: 'link'; supplierId: string } | { type: 'create' } | { type: 'observe' } | { type: 'archive' };
export type SupplierBusinessMode = 'dropship' | 'inbound';

/** Derives cooperation modes from business evidence without changing the supplier master. */
export function deriveSupplierBusinessModes(data: LocalWorkbenchData, supplierId: string): SupplierBusinessMode[] {
  const records = (data.supplierBusinessRecords ?? []).filter(record => record.supplierIds.includes(supplierId));
  const routings = (data.dropshipProductRoutings ?? []).filter(routing => routing.supplierId === supplierId);
  const fulfillmentModes = loadProcurementRecords().flatMap(record => {
    if (record.section !== 'fulfillment' || !record.fulfillment) return [];
    const candidateIds = new Set((record.supplierCandidates ?? []).filter(candidate => candidate.supplierId === supplierId).map(candidate => candidate.id));
    return record.fulfillment.lines.some(line => line.supplierId === supplierId || candidateIds.has(line.supplierId)) ? [record.fulfillment.mode] : [];
  });
  const hasDropship = records.some(record => record.kind === 'dropship_period' || (record.kind === 'purchase' && record.fields.fulfillmentMode === 'dropship'))
    || routings.some(routing => routing.businessMode === 'dropship') || fulfillmentModes.includes('dropship');
  const hasInbound = records.some(record => record.kind === 'purchase' && record.fields.fulfillmentMode === 'warehouse')
    || routings.some(routing => routing.businessMode === 'inbound')
    || fulfillmentModes.includes('warehouse');
  return [hasDropship && 'dropship', hasInbound && 'inbound'].filter(Boolean) as SupplierBusinessMode[];
}

const activePending = (item: PendingDropshipSupplier) => !item.status || item.status === 'active';
export function buildDropshipDecisionSummary(data: LocalWorkbenchData): DropshipDecisionSummary {
  const all = (data.supplierBusinessRecords ?? []).filter(record => record.kind === 'dropship_period');
  const latestEnd = all.map(record => record.fields.periodEnd || '').sort().reverse()[0] || '';
  const records = all.filter(record => record.fields.periodEnd === latestEnd);
  const metrics = records.map(dropshipMetricsFromRecord);
  const overview = dropshipOverview(metrics);
  const risks = records.flatMap(record => {
    const metric = dropshipMetricsFromRecord(record);
    const analysis = analyzeDropshipPeriod(metric);
    if (metric.paidOrders == null || metric.gmv == null || metric.paidOrders < 20 || !analysis.risks.length) return [];
    return [{ supplierId: record.supplierIds[0] || '', supplierName: data.suppliers.find(item => item.id === record.supplierIds[0])?.name || '档案缺失', paidOrders: metric.paidOrders, gmv: metric.gmv, reasons: analysis.risks }];
  }).sort((a, b) => b.paidOrders - a.paidOrders);
  const pending = (data.pendingDropshipSuppliers ?? []).filter(activePending);
  const start = records.map(record => record.fields.periodStart || '').sort()[0] || '';
  const periodCount = new Set(all.map(record => `${record.fields.periodStart}|${record.fields.periodEnd}`)).size;
  const missingDataCount = records.filter(record => ['pickup48Rate','refundRate','response3mRate'].some(key => record.fields[key] == null || record.fields[key] === '')).length;
  return { periodStart:start, periodEnd:latestEnd, periodLabel:start && latestEnd ? `${start} 至 ${latestEnd}` : '暂无正式周期数据', ...overview, riskCount:risks.length, missingDataCount, trendLabel:periodCount > 1 ? '可查看周期趋势' : '暂无趋势', pendingActiveCount:pending.length, pendingInsufficientCount:pending.filter(item => item.filingBand === 'insufficient').length, risks };
}

function pendingRecord(item: PendingDropshipSupplier, supplierId: string): SupplierBusinessRecord {
  const now = new Date().toISOString();
  return { id:crypto.randomUUID(), kind:'dropship_period', supplierIds:[supplierId], offerIds:[], productScope:'全店代发', status:'completed', title:`${item.periodStart} 至 ${item.periodEnd} · ${item.platform}`, owner:'', attachmentIds:[], revision:1, createdAt:now, updatedAt:now, fields:{ sourceKey:[item.platform,item.periodStart,item.periodEnd,supplierId].join('|'), periodStart:item.periodStart, periodEnd:item.periodEnd, platform:item.platform, dataSource:item.sourceFileName, sourceReferences:JSON.stringify(item.sourceReferences ?? []), paidOrders:String(item.paidOrders ?? ''), gmv:String(item.gmv ?? ''), pickup48Rate:String(item.pickup48Rate ?? ''), paymentToSignHours:String(item.paymentToSignHours ?? ''), refundRate:String(item.refundRate ?? ''), rejectReturnRate:String(item.rejectReturnRate ?? ''), response3mRate:String(item.response3mRate ?? ''), afterSalesCount:String(item.afterSalesCount ?? ''), afterSalesRate:String(item.afterSalesRate ?? ''), rejectedAfterSalesCount:String(item.afterSalesRejectCount ?? ''), rejectedAfterSalesRate:String(item.afterSalesRejectRate ?? ''), averageRefundSeconds:String(item.averageRefundSeconds ?? ''), lighthouseAfterSales:String(item.lighthouseAfterSales ?? ''), lighthouseQuality:String(item.lighthouseQuality ?? ''), lighthouseScore:String(item.lighthouseScore ?? ''), evidenceNote:'由待建档区确认归档' } };
}

export function resolvePendingDropshipSupplier(data: LocalWorkbenchData, pendingId: string, action: PendingDropshipAction): LocalWorkbenchData {
  const item = (data.pendingDropshipSuppliers ?? []).find(value => value.id === pendingId);
  if (!item) throw new Error('待建档记录不存在');
  const now = new Date().toISOString();
  if (action.type === 'observe' || action.type === 'archive') return { ...data, pendingDropshipSuppliers:(data.pendingDropshipSuppliers ?? []).map(value => value.id === pendingId ? { ...value, status:action.type === 'observe' ? 'observing' : 'archived', handledAt:now } : value) };
  let suppliers = data.suppliers;
  let supplierId = action.type === 'link' ? action.supplierId : '';
  if (action.type === 'link' && !suppliers.some(value => value.id === supplierId)) throw new Error('请选择有效供应商档案');
  if (action.type === 'create') {
    supplierId = crypto.randomUUID();
    const supplier: LocalSupplier = { id:supplierId, name:item.sourceName, categories:[], riskTags:[], businessModel:'dropship', sourcePlatform:item.platform, createdAt:now };
    suppliers = [supplier, ...suppliers];
  }
  const record = pendingRecord(item,supplierId);
  return { ...data, suppliers, supplierBusinessRecords:[record, ...(data.supplierBusinessRecords ?? [])], pendingDropshipSuppliers:(data.pendingDropshipSuppliers ?? []).map(value => value.id === pendingId ? { ...value, status:'resolved', handledAt:now, linkedSupplierId:supplierId } : value) };
}
