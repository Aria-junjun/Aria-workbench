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

  // Current mapping schema has no batch ownership/provenance. Retain all mappings conservatively.
  const supplierAliasMappings = data.supplierAliasMappings ?? [];
  const dropshipProductRoutings = data.dropshipProductRoutings ?? [];

  return {
    next: { ...data, supplierBusinessRecords, pendingDropshipSuppliers, dropshipProductPeriods, supplierAliasMappings, dropshipProductRoutings },
    counts: {
      supplierBusinessRecords: removedRecords.length,
      pendingDropshipSuppliers: removedPending.length,
      dropshipProductPeriods: removedProducts.length,
      supplierAliasMappings: 0,
      dropshipProductRoutings: 0,
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
