import { newProcurementRecord, type ProcurementRecord } from './procurement';

export function directProcurementEntry(section: 'pool' | 'task'): ProcurementRecord {
  return { ...newProcurementRecord(section), status: section === 'task' ? 'accepted' : 'pending', sourceKind: '', sourceNote: '', nextAction: section === 'task' ? '发起询价' : '等待采购承接' };
}

export function fulfillmentDeletionBlock(records: ProcurementRecord[], id: string): string {
  const record = records.find(item => item.id === id && item.section === 'fulfillment');
  if (!record) return '履约单不存在';
  if (records.some(item => item.sourceId === id)) return '已有后续关联记录，不能删除';
  if (record.fulfillment || record.orderNo || (record.fulfillmentStage && record.fulfillmentStage !== '待下单')) return '已确认采购单或存在业务记录，不能删除';
  return '';
}

export function deleteDraftFulfillment(records: ProcurementRecord[], id: string): ProcurementRecord[] {
  const reason = fulfillmentDeletionBlock(records, id);
  if (reason) throw new Error(reason);
  return records.filter(item => item.id !== id);
}
