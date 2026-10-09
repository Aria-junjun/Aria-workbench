import type { LocalOffer, LocalWorkbenchData } from './local-store';
import { dropshipMetricsFromRecord, validateDropshipMetrics } from './dropship-period-performance';

export type SupplierBusinessKind = 'sample' | 'inspection' | 'agreement' | 'purchase' | 'dropship_period';
export type SupplierBusinessStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type InspectionCheck = { name: string; method: string; standard: string; actual: string; verdict: 'pass' | 'fail' | 'pending' };
export type SupplierBusinessRecord = {
  id: string;
  kind: SupplierBusinessKind;
  supplierIds: string[];
  offerIds: string[];
  productScope: string;
  status: SupplierBusinessStatus;
  title: string;
  owner: string;
  fields: Record<string, string>;
  attachmentIds: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
  sourceType?: 'manual' | 'procurement';
  sourceId?: string;
  sourceProjectTitle?: string;
  pendingArchive?: boolean;
  pendingSupplierName?: string;
};

export function businessKind(record: SupplierBusinessRecord) { return record.kind; }
export function newBusinessRecord(kind: SupplierBusinessKind, supplierId = ''): SupplierBusinessRecord {
  const now = new Date().toISOString();
  return { id: '', kind, supplierIds: supplierId ? [supplierId] : [], offerIds: [], productScope: '', status: 'draft', title: '', owner: '', fields: {}, attachmentIds: [], revision: 0, createdAt: now, updatedAt: now };
}

function date(value: string | undefined) { return value ? /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined : undefined; }
export function inspectionChecks(record: SupplierBusinessRecord): InspectionCheck[] {
  try { const value = JSON.parse(record.fields.checks || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}
export function validateBusinessRecord(record: SupplierBusinessRecord, samples: SupplierBusinessRecord[]): void {
  if (!record.productScope.trim()) throw new Error('请填写产品范围');
  if (!record.supplierIds.length) throw new Error('请关联供应商');
  if (record.kind === 'sample') {
    const quantity = Number(record.fields.quantity);
    if (record.fields.quantity && (!Number.isFinite(quantity) || quantity <= 0)) throw new Error('样品数量必须为正数');
    const sent = date(record.fields.sentDate); const received = date(record.fields.receivedDate);
    if (record.fields.sentDate && !sent || record.fields.receivedDate && !received) throw new Error('寄样日期格式应为 YYYY-MM-DD');
    if (sent && received && received < sent) throw new Error('寄样收到日期不能早于寄出日期');
  }
  if (record.kind === 'inspection') {
    const sample = samples.find(item => item.kind === 'sample' && item.id === record.fields.sampleId);
    if (!sample || !sample.supplierIds.some(id => record.supplierIds.includes(id))) throw new Error('核样记录与供应商不匹配');
    if (record.status === 'completed') {
      const checks = inspectionChecks(record);
      if (!date(record.fields.date) || !checks.length || checks.some(item => !item.name || !item.method || !item.standard || !item.actual) || !record.fields.evidenceNote?.trim()) throw new Error('核样完成前必须填写日期、标准、实测结果和依据');
      if (checks.some(item => !['pass','fail'].includes(item.verdict))) throw new Error('核样完成前请逐项明确通过或未通过，待核验项目不能算完成');
    }
  }
  if (record.kind === 'purchase') {
    if (!record.id && !['warehouse', 'dropship'].includes(record.fields.fulfillmentMode || '')) throw new Error('请先选择入仓或代发履约方式');
    if (record.fields.quantity && (!Number.isFinite(Number(record.fields.quantity)) || Number(record.fields.quantity) < 0)) throw new Error('采购数量不能为负数');
  }
  if (record.kind === 'dropship_period') {
    validateDropshipMetrics(dropshipMetricsFromRecord(record));
  }
}

export function comparisonRows(records: SupplierBusinessRecord[], offers: LocalOffer[] = []) {
  const fields: Array<[string, (r: SupplierBusinessRecord) => string]> = [
    ['供应商', r => r.supplierIds.join('、') || '未关联'],
    ['规格版本', r => r.fields.specification || '未填写'],
    ['数量', r => r.fields.quantity || '未填写'],
    ['交期', r => r.fields.leadTime || '未填写'],
    ['状态', r => r.status],
  ];
  return fields.map(([label, read]) => ({ label, values: records.map(read) })).concat([
    { label: '报价', values: records.map(r => r.offerIds.map(id => offers.find(o => o.id === id)?.taxedUnitPrice || offers.find(o => o.id === id)?.quotedPrice || '未填写').join('、') || '未关联') }
  ]);
}

export function compareBusinessRecords(records: SupplierBusinessRecord[], offers: LocalOffer[] = []) {
  return { columns: records.map(r => r.id), rows: comparisonRows(records, offers) };
}

export function saveBusinessRecord(data: LocalWorkbenchData, input: SupplierBusinessRecord, samples = data.supplierBusinessRecords ?? []) {
  validateBusinessRecord(input, samples);
  const existing = samples.find(item => item.id === input.id);
  if (existing && existing.revision !== input.revision) throw new Error('记录已更新，请重新打开后编辑');
  const now = new Date().toISOString();
  const record = { ...input, id: input.id || crypto.randomUUID(), revision: input.revision + 1, createdAt: existing?.createdAt || now, updatedAt: now };
  return [record, ...samples.filter(item => item.id !== record.id)];
}
