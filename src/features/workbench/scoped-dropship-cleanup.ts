import type { LocalWorkbenchData } from './local-store';

export type DropshipCleanupScope = { platform: string; periodStart: string; periodEnd: string };
export type DropshipCleanupCounts = {
  supplierBusinessRecords: number;
  pendingDropshipSuppliers: number;
  dropshipProductPeriods: number;
  supplierAliasMappings: number;
  dropshipProductRoutings: number;
};
export type DropshipCleanupPreview = { scope: DropshipCleanupScope; counts: DropshipCleanupCounts; total: number };

const matches = (item: { platform?: string; periodStart?: string; periodEnd?: string }, scope: DropshipCleanupScope) =>
  item.platform === scope.platform && item.periodStart === scope.periodStart && item.periodEnd === scope.periodEnd;
const normalized = (value: string) => value.toLowerCase().replace(/[\s（）()]/g, '').replace(/(旗舰店|有限公司|有限责任公司|个体工商户)$/g, '');

export function listDropshipImportBatches(data: LocalWorkbenchData): DropshipCleanupScope[] {
  const candidates: DropshipCleanupScope[] = [
    ...(data.supplierBusinessRecords ?? []).filter(record => record.kind === 'dropship_period').map(record => ({ platform:record.fields.platform, periodStart:record.fields.periodStart, periodEnd:record.fields.periodEnd })),
    ...(data.pendingDropshipSuppliers ?? []).map(item => ({ platform:item.platform, periodStart:item.periodStart, periodEnd:item.periodEnd })),
    ...(data.dropshipProductPeriods ?? []).map(item => ({ platform:item.platform, periodStart:item.periodStart, periodEnd:item.periodEnd })),
  ].filter((item): item is DropshipCleanupScope => Boolean(item.platform && item.periodStart && item.periodEnd));
  const unique = new Map(candidates.map(item => [`${item.platform}|${item.periodStart}|${item.periodEnd}`,item]));
  return [...unique.values()].sort((a,b) => `${b.periodEnd}|${b.periodStart}|${b.platform}`.localeCompare(`${a.periodEnd}|${a.periodStart}|${a.platform}`));
}

function cleanupResult(data: LocalWorkbenchData, scope: DropshipCleanupScope) {
  const removedRecords = (data.supplierBusinessRecords ?? []).filter(record => record.kind === 'dropship_period' && matches(record.fields, scope));
  const supplierBusinessRecords = (data.supplierBusinessRecords ?? []).filter(record => !removedRecords.includes(record));
  const removedPending = (data.pendingDropshipSuppliers ?? []).filter(item => matches(item, scope));
  const pendingDropshipSuppliers = (data.pendingDropshipSuppliers ?? []).filter(item => !removedPending.includes(item));
  const removedProducts = (data.dropshipProductPeriods ?? []).filter(item => matches(item, scope));
  const dropshipProductPeriods = (data.dropshipProductPeriods ?? []).filter(item => !removedProducts.includes(item));

  const removedSupplierIds = new Set(removedRecords.flatMap(record => record.supplierIds));
  const supplierStillReferenced = (supplierId: string, platform: string) =>
    supplierBusinessRecords.some(record => record.kind === 'dropship_period' && record.fields.platform === platform && record.supplierIds.includes(supplierId))
    || dropshipProductPeriods.some(period => period.platform === platform && period.supplierId === supplierId);
  const removedAliases = (data.supplierAliasMappings ?? []).filter(mapping =>
    mapping.platform === scope.platform && removedSupplierIds.has(mapping.supplierId) && !supplierStillReferenced(mapping.supplierId, mapping.platform));
  const supplierAliasMappings = (data.supplierAliasMappings ?? []).filter(mapping => !removedAliases.includes(mapping));

  const routingStillReferenced = (routing: NonNullable<LocalWorkbenchData['dropshipProductRoutings']>[number]) =>
    dropshipProductPeriods.some(period => period.platform === routing.platform
      && normalized(period.productName) === routing.normalizedProductName
      && period.supplierId === routing.supplierId
      && period.businessMode === routing.businessMode);
  const removedRoutings = (data.dropshipProductRoutings ?? []).filter(routing =>
    routing.platform === scope.platform
    && removedProducts.some(period => normalized(period.productName) === routing.normalizedProductName && period.supplierId === routing.supplierId && period.businessMode === routing.businessMode)
    && !routingStillReferenced(routing));
  const dropshipProductRoutings = (data.dropshipProductRoutings ?? []).filter(routing => !removedRoutings.includes(routing));

  return {
    next: { ...data, supplierBusinessRecords, pendingDropshipSuppliers, dropshipProductPeriods, supplierAliasMappings, dropshipProductRoutings },
    counts: {
      supplierBusinessRecords: removedRecords.length,
      pendingDropshipSuppliers: removedPending.length,
      dropshipProductPeriods: removedProducts.length,
      supplierAliasMappings: removedAliases.length,
      dropshipProductRoutings: removedRoutings.length,
    },
  };
}

export function previewScopedDropshipCleanup(data: LocalWorkbenchData, scope: DropshipCleanupScope): DropshipCleanupPreview {
  const { counts } = cleanupResult(data, scope);
  return { scope, counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
}

export function applyScopedDropshipCleanup(data: LocalWorkbenchData, scope: DropshipCleanupScope): LocalWorkbenchData {
  return cleanupResult(data, scope).next;
}
