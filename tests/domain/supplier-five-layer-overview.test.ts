import { describe, expect, it } from 'vitest';
import { normalizeWorkbenchData } from '@/features/workbench/local-store';
import { buildSupplierFiveLayerOverview } from '@/features/workbench/supplier-five-layer-overview';
import type { ProcurementRecord } from '@/features/workbench/procurement';

const fulfillmentRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'po-1', section: 'fulfillment' as const, title: '采购入仓单', productName: '毛毡板', priority: '中' as const,
  status: 'pending' as const, createdAt: '2026-09-01', lineItems: [{ id: 'line-1', productName: '毛毡板', sku: 'SKU-1', specification: '60×90', unit: '张', quantity: '10' }],
  fulfillment: {
    mode: 'warehouse' as const, orderNo: 'PO-001', orderDate: '2026-09-01', owner: '采购甲', settlement: '月结' as const,
    settlementTerms: '', sourcePlatform: '', originalOrderNo: '', importBatch: '', destination: '',
    lines: [{ lineId: 'line-1', supplierId: 'supplier-a', supplierName: '甲厂', quantity: 10 }],
    events: [
      { id: 'ship-1', kind: 'shipment' as const, date: '2026-09-03', operator: '供方', lineId: 'line-1', quantity: 8, note: '', recordedAt: '' },
      { id: 'receipt-1', kind: 'receipt' as const, date: '2026-09-11', operator: '仓库', lineId: 'line-1', quantity: 6, rejectedQuantity: 1, note: '部分拒收', recordedAt: '' },
      { id: 'issue-1', kind: 'issue' as const, date: '2026-09-11', operator: '仓库', lineId: 'line-1', issueType: '质量异常', responsibility: '供应商', note: '边角破损', evidence: 'QC-001', recordedAt: '' },
    ],
  },
  ...overrides,
}) as unknown as ProcurementRecord;

describe('supplier five-layer management overview projection', () => {
  it('distinguishes registered backups from evidence-verified alternatives', () => {
    const data = normalizeWorkbenchData({
      suppliers: [
        { id: 'supplier-a', name: '甲厂', categories: [], riskTags: [], createdAt: '' },
        { id: 'supplier-b', name: '乙厂', categories: [], riskTags: [], createdAt: '' },
      ],
      monthlyInboundSnapshots: [
        { id: 'in-1', skuMasterId: 'sku-1', productFamilyKey: 'felt', period: '2026-09', supplierId: 'supplier-a', receivedQuantity: 90, settlementAmount: 900, sourceFileName: 'in.xlsx', sourceSheetName: 'Sep', importedAt: '' },
      ],
      productSupplierAssignments: [{ id: 'backup-1', productFamilyKey: 'felt', supplierId: 'supplier-b', role: 'backup', effectiveFrom: '2026-01', status: 'active', source: 'manual' }],
    });
    const result = buildSupplierFiveLayerOverview(data, [], '2026-09');
    expect(result.supply[0]).toMatchObject({ productKey: 'felt', actualSupplierCount: 1, registeredBackupCount: 1, verifiedBackupCount: 0, singleSource: true });
  });

  it('does not call a product single-source or calculate share when supplier linkage is missing', () => {
    const data = normalizeWorkbenchData({ monthlyInboundSnapshots: [
      { id: 'known', skuMasterId: 'sku-1', productFamilyKey: 'felt', period: '2026-09', supplierId: 'supplier-a', receivedQuantity: 90, settlementAmount: 900, sourceFileName: 'in.xlsx', sourceSheetName: 'Sep', importedAt: '' },
      { id: 'unknown', skuMasterId: 'sku-1', productFamilyKey: 'felt', period: '2026-09', receivedQuantity: 10, settlementAmount: 100, sourceFileName: 'in.xlsx', sourceSheetName: 'Sep', importedAt: '' },
    ] });
    const result = buildSupplierFiveLayerOverview(data, [], '2026-09');
    expect(result.supply[0]).toMatchObject({ actualSupplierCount: 1, singleSource: false, maxSupplierShare: undefined });
  });

  it('shows observed fulfillment duration and remaining quantity but does not invent on-time delivery', () => {
    const result = buildSupplierFiveLayerOverview(normalizeWorkbenchData({}), [fulfillmentRecord()], '2026-09');
    expect(result.delivery[0]).toMatchObject({ orderNo: 'PO-001', orderedQuantity: 10, shippedQuantity: 8, receivedQuantity: 6, remainingQuantity: 4, observedLeadDays: 10, promisedArrivalDate: undefined, onTimeArrival: undefined });
    expect(result.quality).toHaveLength(2);
    expect(result.quality.some(issue => issue.evidence === 'QC-001')).toBe(true);
  });

  it('computes on-time arrival only against a supplier-confirmed promise and actual receipt date', () => {
    const record = fulfillmentRecord();
    record.fulfillment!.lines[0].promisedArrivalDate = '2026-09-12';
    const result = buildSupplierFiveLayerOverview(normalizeWorkbenchData({}), [record], '2026-09');
    expect(result.delivery[0]).toMatchObject({ promisedArrivalDate: '2026-09-12', actualArrivalDate: '2026-09-11', onTimeArrival: true });
    record.fulfillment!.lines[0].promisedArrivalDate = '2026-09-10';
    const late = buildSupplierFiveLayerOverview(normalizeWorkbenchData({}), [record], '2026-09');
    expect(late.delivery[0].onTimeArrival).toBe(false);
    delete record.fulfillment!.lines[0].promisedArrivalDate;
    const missingPromise = buildSupplierFiveLayerOverview(normalizeWorkbenchData({}), [record], '2026-09');
    expect(missingPromise.delivery[0].onTimeArrival).toBeUndefined();
  });

  it('builds a deep link to the exact procurement record and exception event', () => {
    const result = buildSupplierFiveLayerOverview(normalizeWorkbenchData({}), [fulfillmentRecord()], '2026-09');
    expect(result.quality.find(issue => issue.id.endsWith(':issue-1'))?.sourceHref).toBe('/procurement/fulfillment?recordId=po-1&eventId=issue-1');
  });

  it('aggregates only verified extra costs outside settlement and keeps the exception open', () => {
    const record = fulfillmentRecord();
    record.fulfillment!.events.push(
      { id: 'cost-included', kind: 'cost_impact', date: '2026-09-12', operator: '采购甲', lineId: 'line-1', relatedEventId: 'issue-1', impactType: '补发', extraCostAmount: 80, costVerificationStatus: 'verified', includedInSettlement: true, note: '结算中冲抵', evidence: '账单', recordedAt: '' },
      { id: 'cost-external', kind: 'cost_impact', date: '2026-09-12', operator: '采购甲', lineId: 'line-1', relatedEventId: 'issue-1', impactType: '加急物流', extraCostAmount: 25, costVerificationStatus: 'verified', includedInSettlement: false, note: '额外快递费', evidence: '快递账单', recordedAt: '' },
      { id: 'cost-estimated', kind: 'cost_impact', date: '2026-09-12', operator: '采购甲', lineId: 'line-1', relatedEventId: 'issue-1', impactType: '返工', extraCostAmount: 100, costVerificationStatus: 'estimated', includedInSettlement: false, note: '预计返工', recordedAt: '' },
    );
    const result = buildSupplierFiveLayerOverview(normalizeWorkbenchData({}), [record], '2026-09');
    expect(result.quality.find(row => row.evidence === 'QC-001')).toMatchObject({ verifiedExtraCost: 25, costInclusionStatus: '部分待核实', resolved: false });
  });

  it('reports same-supplier same-SKU monthly reference-price movement separately from realized savings', () => {
    const data = normalizeWorkbenchData({ monthlyInboundSnapshots: [
      { id: 'old', skuMasterId: 'sku-1', period: '2026-08', supplierId: 'supplier-a', settlementUnitPrice: 5, receivedQuantity: 10, sourceFileName: 'aug.xlsx', sourceSheetName: 'Aug', importedAt: '' },
      { id: 'new', skuMasterId: 'sku-1', period: '2026-09', supplierId: 'supplier-a', settlementUnitPrice: 4, receivedQuantity: 12, sourceFileName: 'sep.xlsx', sourceSheetName: 'Sep', importedAt: '' },
    ] });
    const result = buildSupplierFiveLayerOverview(data, [], '2026-09');
    expect(result.costChanges[0]).toMatchObject({ priorUnitPrice: 5, currentUnitPrice: 4, unitPriceChange: -1, realizedSavings: undefined, baselineStatus: '未采集' });
  });

  it('does not calculate a weighted reference price when quantity evidence is incomplete', () => {
    const data = normalizeWorkbenchData({ monthlyInboundSnapshots: [
      { id: 'old', skuMasterId: 'sku-1', period: '2026-08', supplierId: 'supplier-a', settlementUnitPrice: 5, receivedQuantity: 10, sourceFileName: 'aug.xlsx', sourceSheetName: 'Aug', importedAt: '' },
      { id: 'new-known', skuMasterId: 'sku-1', period: '2026-09', supplierId: 'supplier-a', settlementUnitPrice: 4, receivedQuantity: 12, sourceFileName: 'sep.xlsx', sourceSheetName: 'Sep', importedAt: '' },
      { id: 'new-missing', skuMasterId: 'sku-1', period: '2026-09', supplierId: 'supplier-a', settlementUnitPrice: 3, sourceFileName: 'sep.xlsx', sourceSheetName: 'Sep', importedAt: '' },
    ] });
    const result = buildSupplierFiveLayerOverview(data, [], '2026-09');
    expect(result.costChanges[0]).toMatchObject({ priorUnitPrice: 5, currentUnitPrice: undefined, unitPriceChange: undefined, realizedSavings: undefined });
  });
});
