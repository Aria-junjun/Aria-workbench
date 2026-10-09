import { describe, expect, it } from 'vitest';
import { aggregateInboundBySupplier, groupInboundImportBatches, removeInboundImportBatch, selectInboundSnapshotsByWindow } from '@/features/workbench/supplier-fulfillment-ledger';
import { normalizeWorkbenchData, type LocalMonthlyInboundSnapshot, type LocalSupplier } from '@/features/workbench/local-store';

const suppliers: LocalSupplier[] = [
  { id: 'a', name: '供应商甲', categories: [], riskTags: [], createdAt: '' },
  { id: 'b', name: '供应商乙', categories: [], riskTags: [], createdAt: '' },
];

const snapshots: LocalMonthlyInboundSnapshot[] = [
  { id: 'a-aug', skuMasterId: 'sku-a', period: '2026-08', supplierId: 'a', receivedQuantity: 10, settlementAmount: 100, sourceFileName: '8月.xlsx', sourceSheetName: '入仓', importedAt: '2026-09-01T01:00:00.000Z', importBatchId: 'batch-aug' },
  { id: 'a-aug-2', skuMasterId: 'sku-b', period: '2026-08', supplierId: 'a', receivedQuantity: 5, sourceFileName: '8月.xlsx', sourceSheetName: '入仓', importedAt: '2026-09-01T01:00:00.000Z', importBatchId: 'batch-aug' },
  { id: 'b-sep', skuMasterId: 'sku-c', period: '2026-09', supplierId: 'b', receivedQuantity: 7, settlementAmount: 70, sourceFileName: '9月.xlsx', sourceSheetName: '入仓', importedAt: '2026-09-29T01:00:00.000Z' },
];

describe('supplier fulfillment ledger selectors', () => {
  it('groups new and legacy inbound snapshots by their import batch identity', () => {
    const batches = groupInboundImportBatches(snapshots);
    expect(batches).toHaveLength(2);
    expect(batches.find(batch => batch.id === 'batch-aug')?.snapshotIds).toEqual(['a-aug', 'a-aug-2']);
    expect(batches.find(batch => batch.id !== 'batch-aug')).toMatchObject({
      period: '2026-09', sourceFileName: '9月.xlsx', sourceSheetName: '入仓', snapshotIds: ['b-sep'],
    });
  });

  it('selects one month, a trailing month window, or an inclusive custom range', () => {
    expect(selectInboundSnapshotsByWindow(snapshots, { kind: 'month', month: '2026-08' }).map(row => row.id)).toEqual(['a-aug', 'a-aug-2']);
    expect(selectInboundSnapshotsByWindow(snapshots, { kind: 'last_months', endMonth: '2026-09', count: 2 }).map(row => row.id)).toEqual(['a-aug', 'a-aug-2', 'b-sep']);
    expect(selectInboundSnapshotsByWindow(snapshots, { kind: 'range', startMonth: '2026-09', endMonth: '2026-09' }).map(row => row.id)).toEqual(['b-sep']);
  });

  it('aggregates known supplier values without treating missing amounts as zero observations', () => {
    expect(aggregateInboundBySupplier(snapshots.filter(row => row.period === '2026-08'), suppliers)).toEqual([
      { supplierId: 'a', supplierName: '供应商甲', receivedQuantity: 15, knownSettlementAmount: 100, recordCount: 2, quantityMissingCount: 0, settlementMissingCount: 1 },
    ]);
  });

  it('removes only the reviewed inbound batch and preserves supplier masters and mappings', () => {
    const data = normalizeWorkbenchData({ ...{ suppliers }, monthlyInboundSnapshots: snapshots, supplierInboundProductMappings: [{ id: 'mapping-a', supplierId: 'a', supplierProductName: '厂家货', supplierSpec: '规格一', mappingLevel: 'sku', skuMasterId: 'sku-a', createdAt: '', updatedAt: '' }] });
    const batch = groupInboundImportBatches(snapshots).find(item => item.id === 'batch-aug')!;
    const cleaned = removeInboundImportBatch(data, batch);
    expect(cleaned.monthlyInboundSnapshots?.map(item => item.id)).toEqual(['b-sep']);
    expect(cleaned.suppliers.map(item => item.id)).toEqual(['a', 'b']);
    expect(cleaned.supplierInboundProductMappings?.map(item => item.id)).toEqual(['mapping-a']);
  });
});
