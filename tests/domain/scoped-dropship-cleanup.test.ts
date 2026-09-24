import { describe, expect, it } from 'vitest';
import { applyScopedDropshipCleanup, listDropshipImportBatches, previewScopedDropshipCleanup, type DropshipCleanupScope } from '@/features/workbench/scoped-dropship-cleanup';
import { normalizeWorkbenchData } from '@/features/workbench/local-store';

const scope: DropshipCleanupScope = { platform: '1688', periodStart: '2026-09-04', periodEnd: '2026-09-18' };

function fixture() {
  return normalizeWorkbenchData({
    suppliers: [{ id: 'supplier-a', name: '供应商A', categories: [], riskTags: [], createdAt: '' }],
    supplierBusinessRecords: [
      { id: 'target', kind: 'dropship_period', supplierIds: ['supplier-a'], offerIds: [], productScope: '商品A', status: 'completed', title: '目标周期', owner: '', fields: { platform: '1688', periodStart: '2026-09-04', periodEnd: '2026-09-18' }, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
      { id: 'sample', kind: 'sample', supplierIds: ['supplier-a'], offerIds: [], productScope: '商品A', status: 'completed', title: '寄样', owner: '', fields: {}, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
      { id: 'other-period', kind: 'dropship_period', supplierIds: ['supplier-a'], offerIds: [], productScope: '商品A', status: 'completed', title: '其他周期', owner: '', fields: { platform: '1688', periodStart: '2026-09-19', periodEnd: '2026-09-25' }, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
    ],
    pendingDropshipSuppliers: [
      { id: 'pending-target', sourceName: '供应商A', platform: '1688', periodStart: '2026-09-04', periodEnd: '2026-09-18', paidOrders: 10, filingBand: 'insufficient', sourceFileName: 'a.xlsx', createdAt: '' },
      { id: 'pending-other', sourceName: '供应商A', platform: '1688', periodStart: '2026-09-19', periodEnd: '2026-09-25', paidOrders: 10, filingBand: 'insufficient', sourceFileName: 'b.xlsx', createdAt: '' },
    ],
    dropshipProductPeriods: [
      { id: 'product-target', businessKey: 'target', productName: '商品A', supplierId: 'supplier-a', businessMode: 'dropship', platform: '1688', periodStart: '2026-09-04', periodEnd: '2026-09-18', fileName: 'a.xlsx', importedAt: '', sourceSheetName: '商品服务', sourceRowNumber: 2 },
      { id: 'product-other', businessKey: 'other', productName: '商品A', supplierId: 'supplier-a', businessMode: 'dropship', platform: '1688', periodStart: '2026-09-19', periodEnd: '2026-09-25', fileName: 'b.xlsx', importedAt: '', sourceSheetName: '商品服务', sourceRowNumber: 2 },
    ],
    supplierAliasMappings: [{ id: 'alias-a', platform: '1688', sourceName: '供应商简称', normalizedSourceName: '供应商简称', supplierId: 'supplier-a', confirmedAt: '' }],
    dropshipProductRoutings: [{ id: 'route-a', platform: '1688', productName: '商品A', normalizedProductName: '商品a', supplierId: 'supplier-a', businessMode: 'dropship', confirmedAt: '' }],
  });
}

describe('scoped dropship cleanup', () => {
  it('lists each distinct platform and period batch once across all import collections', () => {
    const batches = listDropshipImportBatches(fixture());
    expect(batches).toEqual([
      { platform:'1688', periodStart:'2026-09-19', periodEnd:'2026-09-25' },
      { platform:'1688', periodStart:'2026-09-04', periodEnd:'2026-09-18' },
    ]);
  });

  it('previews exact removal counts without mutating the snapshot', () => {
    const data = fixture();
    const before = JSON.stringify(data);
    const preview = previewScopedDropshipCleanup(data, scope);
    expect(preview.counts).toEqual({ supplierBusinessRecords: 1, pendingDropshipSuppliers: 1, dropshipProductPeriods: 1, supplierAliasMappings: 0, dropshipProductRoutings: 0 });
    expect(preview.total).toBe(3);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('removes only the exact platform and period while preserving masters and unrelated business data', () => {
    const data = fixture();
    const next = applyScopedDropshipCleanup(data, scope);
    expect(next.suppliers).toEqual(data.suppliers);
    expect(next.supplierBusinessRecords?.map(item => item.id)).toEqual(['sample', 'other-period']);
    expect(next.pendingDropshipSuppliers?.map(item => item.id)).toEqual(['pending-other']);
    expect(next.dropshipProductPeriods?.map(item => item.id)).toEqual(['product-other']);
    expect(next.supplierAliasMappings?.map(item => item.id)).toEqual(['alias-a']);
    expect(next.dropshipProductRoutings?.map(item => item.id)).toEqual(['route-a']);
  });

  it('always retains alias and product routing mappings because batch ownership is not provable', () => {
    const data = fixture();
    data.supplierBusinessRecords = data.supplierBusinessRecords?.filter(item => item.id !== 'other-period');
    data.dropshipProductPeriods = data.dropshipProductPeriods?.filter(item => item.id !== 'product-other');
    const preview = previewScopedDropshipCleanup(data, scope);
    expect(preview.counts.supplierAliasMappings).toBe(0);
    expect(preview.counts.dropshipProductRoutings).toBe(0);
    const next = applyScopedDropshipCleanup(data, scope);
    expect(next.supplierAliasMappings).toEqual(data.supplierAliasMappings);
    expect(next.dropshipProductRoutings).toEqual(data.dropshipProductRoutings);
  });

  it('does not match near dates or another platform', () => {
    const data = fixture();
    const wrongDate = previewScopedDropshipCleanup(data, { ...scope, periodEnd: '2026-09-19' });
    const wrongPlatform = previewScopedDropshipCleanup(data, { ...scope, platform: '1688 ' });
    expect(wrongDate.total).toBe(0);
    expect(wrongPlatform.total).toBe(0);
  });
});
