import { describe, expect, it } from 'vitest';
import { buildSupplierBusinessEvidence } from '@/features/workbench/supplier-business-evidence';
import { validateBusinessRecord } from '@/features/workbench/supplier-business';

describe('supplier business evidence', () => {
  const suppliers = [
    { id: 'both', name: '双业务公司', categories: [], riskTags: [], createdAt: '', businessModel: 'hybrid' as const },
    { id: 'label-only', name: '仅标记代发', categories: [], riskTags: [], createdAt: '', businessModel: 'dropship' as const },
    { id: 'inbound', name: '入仓公司', categories: [], riskTags: [], createdAt: '', businessModel: 'dropship' as const },
  ];

  it('classifies suppliers by source records rather than profile labels', () => {
    const result = buildSupplierBusinessEvidence({
      suppliers,
      monthlyInboundSnapshots: [{ id: 'a', skuMasterId: 'sku', period: '2026-09', supplierId: 'both', sourceFileName: '', sourceSheetName: '', importedAt: '' }],
      supplierBusinessRecords: [
        { id: 'period', kind: 'dropship_period', supplierIds: ['both'], offerIds: [], productScope: '', status: 'completed', title: '', owner: '', fields: {}, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
        { id: 'purchase', kind: 'purchase', supplierIds: ['inbound'], offerIds: [], productScope: '', status: 'completed', title: '', owner: '', fields: { fulfillmentMode: 'warehouse' }, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
      ],
    });
    expect([...result.inboundSupplierIds].sort()).toEqual(['both', 'inbound']);
    expect([...result.dropshipSupplierIds]).toEqual(['both']);
    expect(result.inboundSupplierIds.has('label-only')).toBe(false);
  });

  it('keeps records with unclear business or ambiguous names pending classification', () => {
    const result = buildSupplierBusinessEvidence({
      suppliers: [...suppliers, { ...suppliers[0], id: 'duplicate' }],
      monthlyInboundSnapshots: [{ id: 'a', skuMasterId: 'sku', period: '2026-09', supplierName: '双业务公司', sourceFileName: '', sourceSheetName: '', importedAt: '' }],
      supplierBusinessRecords: [{ id: 'old', kind: 'purchase', supplierIds: ['both'], offerIds: [], productScope: '', status: 'completed', title: '', owner: '', fields: {}, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' }],
    });
    expect(result.unclassifiedCount).toBe(2);
    expect(result.inboundSupplierIds.size).toBe(0);
  });

  it('requires a business route on new manually entered purchase records', () => {
    const record = { id: '', kind: 'purchase' as const, supplierIds: ['both'], offerIds: [], productScope: '样品', status: 'draft' as const, title: '', owner: '', fields: {}, attachmentIds: [], revision: 0, createdAt: '', updatedAt: '' };
    expect(() => validateBusinessRecord(record, [])).toThrow('履约方式');
    expect(() => validateBusinessRecord({ ...record, fields: { fulfillmentMode: 'warehouse' } }, [])).not.toThrow();
  });
});
