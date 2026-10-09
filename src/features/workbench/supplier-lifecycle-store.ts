'use client';
import { loadLocalWorkbenchData, saveLocalWorkbenchData } from './local-store';
import { setWorkbenchSnapshot } from './workbench-store';
import { commitLifecycleRecord, type LifecycleRecord } from './supplier-lifecycle';

export function saveLifecycleRecord(input: LifecycleRecord) {
  const current = loadLocalWorkbenchData();
  const records = current.supplierLifecycleRecords ?? [];
  if (input.supplierIds.some(id => !current.suppliers.some(s => s.id === id))) throw new Error('关联供应商不存在，请重新选择');
  if (input.offerIds.some(id => !current.offers.some(o => o.id === id && o.supplierId && input.supplierIds.includes(o.supplierId)))) throw new Error('报价必须属于已选供应商，请检查关联报价');
  const record = commitLifecycleRecord(records, input);
  saveLocalWorkbenchData({ ...current, supplierLifecycleRecords: [record, ...records.filter(r => r.id !== record.id)] });
  setWorkbenchSnapshot(loadLocalWorkbenchData());
  return record;
}
