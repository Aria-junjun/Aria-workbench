import { describe, expect, it } from 'vitest';
import { acceptProcurementRequest, createQuoteProject, newProcurementRecord } from '../../src/features/workbench/procurement';
import { directProcurementEntry, deleteDraftFulfillment } from '../../src/features/workbench/procurement-entry';

describe('直接采购入口与安全删除', () => {
  it('直接入池可承接、询价，不补造需求申请', () => {
    const pool = { ...directProcurementEntry('pool'), title: '领导加派', sourceKind: '领导加派', sourceNote: '会议安排' };
    const accepted = acceptProcurementRequest([pool], pool.id);
    const task = accepted.find(item => item.section === 'task')!;
    const quoted = createQuoteProject(accepted, task.id);
    expect(quoted.some(item => item.section === 'request')).toBe(false);
    expect(task.sourceId).toBe(pool.id);
    expect(quoted.find(item => item.section === 'quote')?.sourceId).toBe(task.id);
  });
  it('直接任务可发起询价', () => {
    const task = directProcurementEntry('task');
    expect(task.status).toBe('accepted');
    expect(createQuoteProject([task], task.id)).toHaveLength(2);
  });
  it('只删除指定的无业务草稿', () => {
    const a = newProcurementRecord('fulfillment');
    const b = newProcurementRecord('fulfillment');
    expect(deleteDraftFulfillment([a, b], a.id)).toEqual([b]);
    expect(() => deleteDraftFulfillment([{ ...a, orderNo: 'PO-1' }], a.id)).toThrow();
    expect(() => deleteDraftFulfillment([a, { ...b, sourceId: a.id }], a.id)).toThrow();
  });
});
