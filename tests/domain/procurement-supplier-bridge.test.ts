import { describe, expect, it } from 'vitest';
import { linkProcurementSupplier, projectProcurementSupplierRecords } from '@/features/workbench/procurement-supplier-bridge';
import { newProcurementRecord } from '@/features/workbench/procurement';
import type { LocalSupplier } from '@/features/workbench/local-store';

const supplier: LocalSupplier = { id: 'master-1', name: '正式供应商', categories: [], riskTags: [], createdAt: '' };

describe('procurement supplier bridge', () => {
  it('projects configured sample and inspection facts to the matched supplier', () => {
    const record = { ...newProcurementRecord('fulfillment'), id: 'f1', title: '白板贴样品', productName: '白板贴', lineItems: [{ id: 'l1', productName: '白板贴V1' }], supplierCandidates: [{ id: 'c1', supplierId: supplier.id, name: supplier.name, source: 'master' as const, status: 'candidate' as const }], fulfillment: { mode: 'sample' as const, orderNo: 'S1', orderDate: '2026-09-01', owner: '采购甲', settlement: '现结' as const, settlementTerms: '', sourcePlatform: '1688', originalOrderNo: '', importBatch: '', destination: '办公室', lines: [{ lineId: 'l1', supplierId: 'c1', supplierName: supplier.name, quantity: 1 }], events: [{ id: 'ship', kind: 'shipment' as const, date: '2026-09-02', operator: '采购甲', lineId: 'l1', quantity: 1, carrier: '顺丰', trackingNo: 'SF1', note: '', recordedAt: '' }, { id: 'receipt', kind: 'receipt' as const, date: '2026-09-03', operator: '运营甲', lineId: 'l1', quantity: 1, rejectedQuantity: 0, relatedEventId: 'ship', note: '已收样', recordedAt: '' }, { id: 'check', kind: 'inspection' as const, date: '2026-09-04', operator: '运营甲', lineId: 'l1', verdict: '通过' as const, note: '擦写合格', evidence: '照片', recordedAt: '' }] } };
    const projected = projectProcurementSupplierRecords([record], [supplier]);
    expect(projected.map(item => item.kind)).toEqual(['sample', 'inspection']);
    expect(projected.every(item => item.supplierIds[0] === supplier.id && item.sourceType === 'procurement')).toBe(true);
    expect(projected.find(item => item.kind === 'inspection')?.fields.verdict).toBe('通过');
  });

  it('keeps fulfilled temporary suppliers in a pending archive queue', () => {
    const record = { ...newProcurementRecord('fulfillment'), id: 'f2', title: '临时代发', productName: '清洁刷', lineItems: [{ id: 'l2', productName: '清洁刷' }], fulfillment: { mode: 'dropship' as const, orderNo: 'D1', orderDate: '2026-09-01', owner: '采购乙', settlement: '现结' as const, settlementTerms: '', sourcePlatform: '聚水潭', originalOrderNo: '', importBatch: '', destination: '消费者', lines: [{ lineId: 'l2', supplierId: 'temp-1', supplierName: '临时供应商', quantity: 10 }], events: [] } };
    const projected = projectProcurementSupplierRecords([record], [supplier]);
    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({ kind: 'purchase', supplierIds: [], pendingSupplierName: '临时供应商', pendingArchive: true });
  });

  it('ignores unconfigured fulfillment drafts and produces stable ids', () => {
    const draft = { ...newProcurementRecord('fulfillment'), id: 'draft' };
    expect(projectProcurementSupplierRecords([draft], [supplier])).toEqual([]);
  });

  it('links a fulfilled temporary supplier to an existing master without changing events', () => {
    const record = { ...newProcurementRecord('fulfillment'), id: 'f3', fulfillment: { mode: 'warehouse' as const, orderNo: 'P1', orderDate: '2026-09-01', owner: '甲', settlement: '现结' as const, settlementTerms: '', sourcePlatform: '线下', originalOrderNo: '', importBatch: '', destination: '仓库', lines: [{ lineId: 'l3', supplierId: 'temp', supplierName: '临时供应商', quantity: 2 }], events: [] } };
    const linked = linkProcurementSupplier([record], record.id, '临时供应商', supplier.id);
    expect(linked[0].fulfillment?.lines[0].supplierId).toBe(supplier.id);
    expect(linked[0].fulfillment?.events).toEqual([]);
  });
});
