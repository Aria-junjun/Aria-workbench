import { describe, expect, it } from 'vitest';
import { calculateSupplierCostImprovement, createSupplierCostImprovementProject } from '@/features/workbench/supplier-cost-improvement';

const project = createSupplierCostImprovementProject({
  title: '年度议价·SKU甲', supplierId: 'supplier-a', skuMasterId: 'sku-a', baselineUnitPrice: 10,
  targetUnitPrice: 9, effectiveFrom: '2026-01', effectiveTo: '2026-12', owner: '采购负责人',
  comparabilityConfirmed: true, comparabilityNote: '同规格、含税、运费口径一致', evidence: '基准报价.pdf',
}, 'project-a', '2026-09-29T00:00:00.000Z');

describe('supplier cost improvement calculation', () => {
  it('calculates realized savings from actual received quantity and same-supplier SKU snapshots only', () => {
    const result = calculateSupplierCostImprovement(project, [
      { id: 'one', supplierId: 'supplier-a', skuMasterId: 'sku-a', period: '2026-09', receivedQuantity: 100, settlementUnitPrice: 8, settlementAmount: 800, sourceFileName: 'in.xlsx', sourceSheetName: 'sheet', importedAt: '' },
      { id: 'other', supplierId: 'supplier-b', skuMasterId: 'sku-a', period: '2026-09', receivedQuantity: 1000, settlementUnitPrice: 1, settlementAmount: 1000, sourceFileName: 'in.xlsx', sourceSheetName: 'sheet', importedAt: '' },
    ]);
    expect(result.grossSavings).toBe(200);
    expect(result.netSavings).toBe(200);
    expect(result.snapshotIds).toEqual(['one']);
  });

  it('does not double count verified extra costs already included in settlement', () => {
    const rows = [{ id: 'one', supplierId: 'supplier-a', skuMasterId: 'sku-a', period: '2026-09', receivedQuantity: 100, settlementUnitPrice: 8, settlementAmount: 800, sourceFileName: 'in.xlsx', sourceSheetName: 'sheet', importedAt: '' }];
    const costs = [
      { supplierId: 'supplier-a', skuMasterId: 'sku-a', period: '2026-09', amount: 30, verified: true, includedInSettlement: true, projectId: 'project-a' },
      { supplierId: 'supplier-a', skuMasterId: 'sku-a', period: '2026-09', amount: 20, verified: true, includedInSettlement: false, projectId: 'project-a' },
    ];
    expect(calculateSupplierCostImprovement(project, rows, costs).netSavings).toBe(180);
  });

  it('refuses realized savings if any matching inbound fact lacks quantity or unit price', () => {
    const result = calculateSupplierCostImprovement(project, [
      { id: 'one', supplierId: 'supplier-a', skuMasterId: 'sku-a', period: '2026-09', receivedQuantity: 100, settlementUnitPrice: 8, sourceFileName: 'in.xlsx', sourceSheetName: 'sheet', importedAt: '' },
      { id: 'two', supplierId: 'supplier-a', skuMasterId: 'sku-a', period: '2026-10', receivedQuantity: 50, sourceFileName: 'in.xlsx', sourceSheetName: 'sheet', importedAt: '' },
    ]);
    expect(result.status).toContain('未采集完整');
    expect(result.netSavings).toBeUndefined();
  });

  it('does not double count multiple inbound rows for the same SKU and month', () => {
    const one = { id: 'one', supplierId: 'supplier-a', skuMasterId: 'sku-a', period: '2026-09', receivedQuantity: 100, settlementUnitPrice: 8, sourceFileName: 'a.xlsx', sourceSheetName: 'sheet', importedAt: '' };
    const two = { ...one, id: 'two', receivedQuantity: 20 };
    const result = calculateSupplierCostImprovement(project, [one, two]);
    expect(result.status).toContain('同月存在多条');
    expect(result.netSavings).toBeUndefined();
  });

  it('requires comparable baseline evidence before creating a project', () => {
    expect(() => createSupplierCostImprovementProject({ ...project, comparabilityConfirmed: false })).toThrow('确认可比口径');
    expect(() => createSupplierCostImprovementProject({ ...project }, 'next', undefined, [project])).toThrow('已有改善项目');
  });
});
