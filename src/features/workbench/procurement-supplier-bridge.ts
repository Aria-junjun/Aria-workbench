import type { LocalSupplier } from './local-store';
import { fulfillmentProgress, fulfillmentTotals, openFulfillmentIssues } from './procurement-fulfillment';
import { normalizeLineItems, type ProcurementRecord } from './procurement';
import type { SupplierBusinessRecord } from './supplier-business';

export type ProcurementSupplierProjection = SupplierBusinessRecord & {
  sourceType: 'procurement';
  sourceId: string;
  sourceProjectTitle: string;
};

const iso = (value?: string) => value ? `${value}T00:00:00.000Z` : new Date(0).toISOString();

export function projectProcurementSupplierRecords(records: ProcurementRecord[], suppliers: LocalSupplier[]): ProcurementSupplierProjection[] {
  const projected: ProcurementSupplierProjection[] = [];
  for (const record of records) {
    if (record.section !== 'fulfillment' || !record.fulfillment) continue;
    const data = record.fulfillment;
    for (const orderLine of data.lines) {
      const line = normalizeLineItems(record).find(item => item.id === orderLine.lineId);
      const candidate = record.supplierCandidates?.find(item => item.id === orderLine.supplierId || item.supplierId === orderLine.supplierId);
      const masterId = suppliers.some(item => item.id === orderLine.supplierId) ? orderLine.supplierId : candidate?.supplierId && suppliers.some(item => item.id === candidate.supplierId) ? candidate.supplierId : '';
      const common = {
        supplierIds: masterId ? [masterId] : [], offerIds: [], productScope: line?.productName || record.productName,
        owner: data.owner, attachmentIds: [], revision: 1, createdAt: iso(data.orderDate), updatedAt: iso(data.events.at(-1)?.date || data.orderDate),
        sourceType: 'procurement' as const, sourceId: record.id, sourceProjectTitle: record.title,
        pendingArchive: !masterId, pendingSupplierName: masterId ? undefined : orderLine.supplierName,
      };
      const totals = fulfillmentTotals(data, orderLine.lineId);
      const shipments = data.events.filter(event => event.kind === 'shipment' && event.lineId === orderLine.lineId);
      const receipts = data.events.filter(event => event.kind === 'receipt' && event.lineId === orderLine.lineId);
      if (data.mode === 'sample') {
        projected.push({ ...common, id: `procurement:${record.id}:${orderLine.supplierId}:${orderLine.lineId}:sample`, kind: 'sample', title: `${line?.productName || record.productName} · 采购样品`, status: totals.received >= orderLine.quantity ? 'completed' : shipments.length ? 'active' : 'draft', fields: { quantity: String(orderLine.quantity), specification: line?.specification || '', sentDate: shipments[0]?.date || '', receivedDate: receipts.at(-1)?.date || '', carrier: shipments[0]?.carrier || '', trackingNo: shipments[0]?.trackingNo || '', evidenceNote: `来源采购项目：${record.title}` } });
        const inspection = [...data.events].reverse().find(event => event.kind === 'inspection' && event.lineId === orderLine.lineId);
        if (inspection) projected.push({ ...common, id: `procurement:${record.id}:${orderLine.supplierId}:${orderLine.lineId}:inspection`, kind: 'inspection', title: `${line?.productName || record.productName} · 核样`, status: inspection.verdict === '通过' ? 'completed' : 'active', fields: { sampleId: `procurement:${record.id}:${orderLine.supplierId}:${orderLine.lineId}:sample`, date: inspection.date, specification: line?.specification || '', verdict: inspection.verdict || '', evidenceNote: [inspection.note, inspection.evidence].filter(Boolean).join('；'), checks: JSON.stringify([{ name: '采购样品核验', method: '采购履约记录', standard: line?.requirements || '按采购要求', actual: inspection.note, verdict: inspection.verdict === '通过' ? 'pass' : inspection.verdict === '不通过' ? 'fail' : 'pending' }]) } });
      } else {
        const progress = fulfillmentProgress(record);
        projected.push({ ...common, id: `procurement:${record.id}:${orderLine.supplierId}:${orderLine.lineId}:purchase`, kind: 'purchase', title: `${line?.productName || record.productName} · ${data.mode === 'warehouse' ? '入仓采购' : '一件代发'}`, status: progress.ready ? 'completed' : 'active', fields: { orderNo: data.orderNo, specification: line?.specification || '', quantity: String(orderLine.quantity), shippedQuantity: String(totals.shipped), receivedQuantity: String(totals.received), rejectedQuantity: String(totals.rejected), shipDate: shipments[0]?.date || '', receivedDate: receipts.at(-1)?.date || '', receivingAddress: data.destination, fulfillmentMode: data.mode, stage: progress.stage, issueCount: String(openFulfillmentIssues(data).filter(event => event.lineId === orderLine.lineId).length), notes: `来源采购项目：${record.title}` } });
      }
    }
  }
  return projected;
}

export function mergeSupplierBusinessRecords(manual: SupplierBusinessRecord[], projected: ProcurementSupplierProjection[]) {
  const projectedIds = new Set(projected.map(item => item.id));
  return [...projected, ...manual.filter(item => !projectedIds.has(item.id))];
}

export function linkProcurementSupplier(records: ProcurementRecord[], fulfillmentId: string, supplierName: string, masterId: string) {
  if (!masterId) return records;
  return records.map(record => {
    if (record.id !== fulfillmentId || !record.fulfillment) return record;
    const oldIds = record.fulfillment.lines.filter(line => line.supplierName === supplierName).map(line => line.supplierId);
    return { ...record, supplierCandidates: record.supplierCandidates?.map(candidate => oldIds.includes(candidate.id) || oldIds.includes(candidate.supplierId || '') || candidate.name === supplierName ? { ...candidate, supplierId: masterId } : candidate), fulfillment: { ...record.fulfillment, lines: record.fulfillment.lines.map(line => line.supplierName === supplierName ? { ...line, supplierId: masterId } : line) } };
  });
}
