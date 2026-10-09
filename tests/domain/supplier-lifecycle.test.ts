import { describe, expect, it } from 'vitest';
import { buildProcurementStructure, commitLifecycleRecord, mergeLifecycleRecords, type LifecycleRecord } from '@/features/workbench/supplier-lifecycle';
import { normalizeWorkbenchData, mergeDemandRecords } from '@/features/workbench/local-store';

const draft = (): LifecycleRecord => ({ id: 'r1', section: 'sourcing', title: '白板供应优化', productScope: '白板贴', supplierIds: [], offerIds: [], status: 'draft', priority: 'normal', owner: '', dueDate: '', nextAction: '', result: '', evidence: '', fields: {}, revision: 0, createdAt: '', updatedAt: '', history: [] });
describe('supplier lifecycle decisions', () => {
  it('retains source evidence and reserved director review fields across revisions', () => {
    const first = commitLifecycleRecord([], { ...draft(), section: 'performance', businessMode: 'dropship', supplierIds: ['a'], sourceRecordIds: ['period-1'], directorReview: { status: 'not_requested' } });
    const next = commitLifecycleRecord([first], { ...first, evidence: 'period-1' });
    expect(next.sourceRecordIds).toEqual(['period-1']);
    expect(next.directorReview?.status).toBe('not_requested');
    expect(next.history[0].sourceRecordIds).toEqual(['period-1']);
    const altered = { ...first, sourceRecordIds: ['period-2'] };
    expect(mergeLifecycleRecords([first], [altered])[0].hasConflict).toBe(true);
  });
  it('allows minimal drafts but not unsupported completed decisions', () => {
    expect(commitLifecycleRecord([], draft()).revision).toBe(1);
    expect(() => commitLifecycleRecord([], { ...draft(), status: 'completed' })).toThrow('供应商');
    expect(() => commitLifecycleRecord([], { ...draft(), supplierIds: ['s'], status: 'completed', result: '入围' })).toThrow('依据');
  });
  it('retains previous versions and rejects stale edits', () => {
    const first = commitLifecycleRecord([], draft());
    const next = commitLifecycleRecord([first], { ...first, title: '新标题' });
    expect(next.history[0].title).toBe('白板供应优化');
    expect(() => commitLifecycleRecord([next], first)).toThrow('其他');
  });
  it('requires explicit sourcing winners from the candidate list', () => {
    const completed = { ...draft(), supplierIds: ['a', 'b'], status: 'completed' as const, result: '选乙', evidence: '报价记录', fields: { comparison: '乙交期更短' } };
    expect(() => commitLifecycleRecord([], completed)).toThrow('入围');
    expect(() => commitLifecycleRecord([], { ...completed, selectedSupplierIds: ['c'] })).toThrow('候选');
    expect(commitLifecycleRecord([], { ...completed, selectedSupplierIds: ['b'] }).selectedSupplierIds).toEqual(['b']);
  });
  it('preserves lifecycle data through normalization and cloud merge', () => {
    const first = commitLifecycleRecord([], draft());
    expect(normalizeWorkbenchData({ supplierLifecycleRecords: [first] }).supplierLifecycleRecords).toEqual([first]);
    expect(mergeDemandRecords({ supplierLifecycleRecords: [first] }, {}).supplierLifecycleRecords).toEqual([first]);
  });
  it('preserves both concurrent branches and requires conflict review', () => {
    const first = commitLifecycleRecord([], draft());
    const left = commitLifecycleRecord([first], { ...first, result: '左端' });
    const right = commitLifecycleRecord([first], { ...first, result: '右端' });
    const merged = mergeLifecycleRecords([left], [right])[0];
    expect(merged.hasConflict).toBe(true);
    const unchangedLocal = { ...merged, hasConflict: false, history: [] };
    expect(mergeLifecycleRecords([merged], [unchangedLocal])[0].hasConflict).toBe(true);
    expect([merged.result, ...merged.history.map(r => r.result)]).toEqual(expect.arrayContaining(['左端', '右端']));
    expect(() => commitLifecycleRecord([merged], merged)).toThrow('冲突');
    const resolved = commitLifecycleRecord([merged], { ...merged, hasConflict: false });
    expect(resolved.hasConflict).toBe(false);
    expect(mergeLifecycleRecords([merged], [resolved])[0].hasConflict).toBe(false);
    expect(mergeLifecycleRecords([first], [left])[0].hasConflict).not.toBe(true);
  });
});
describe('procurement structure uses actual settlement facts', () => {
  const base = { suppliers: [{ id: 's1', name: '甲', categories: [], riskTags: [], createdAt: '' }], skuMasters: [], offers: [{ quotedPriceNum: 99999 }] };
  const row = (id: string, extra = {}) => ({ id, skuMasterId: 'sku', period: '2026-08', sourceFileName: '入仓.xlsx', sourceSheetName: '数据', importedAt: '', ...extra });
  it('uses known amounts including unmapped bucket, never quotes or unknown as zero', () => {
    const data = normalizeWorkbenchData({ ...base, offers: [], monthlyInboundSnapshots: [row('1', { supplierId: 's1', productFamilyKey: '白板', settlementAmount: 100 }), row('2', { settlementAmount: 50 }), row('3', { supplierId: 's1' }), row('4', { period: '2026-07', settlementAmount: 900 })] });
    const summary = buildProcurementStructure(data, '2026-08');
    expect(summary.knownAmount).toBe(150);
    expect(summary.missingAmountCount).toBe(1);
    expect(summary.supplierRows.find(r => r.id === 's1')?.share).toBeCloseTo(2 / 3);
    expect(summary.unmappedSupplierAmount).toBe(50);
    expect(summary.productRows.some(r => r.name === '未关联产品')).toBe(true);
  });
  it('shows no data rather than zero and will not guess ambiguous supplier names', () => {
    expect(buildProcurementStructure(normalizeWorkbenchData({}), '').knownAmount).toBeUndefined();
    const data = normalizeWorkbenchData({ suppliers: [...base.suppliers, { ...base.suppliers[0], id: 's2' }], monthlyInboundSnapshots: [row('1', { supplierName: '甲', settlementAmount: 40 })] });
    expect(buildProcurementStructure(data, '2026-08').unmappedSupplierAmount).toBe(40);
  });
});
