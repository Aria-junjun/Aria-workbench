import type { LocalWorkbenchData } from './local-store';

/** Business presence follows recorded transactions, never the supplier's profile label. */
export function buildSupplierBusinessEvidence(data: Pick<LocalWorkbenchData, 'suppliers' | 'monthlyInboundSnapshots' | 'supplierBusinessRecords'>) {
  const inboundSupplierIds = new Set<string>();
  const dropshipSupplierIds = new Set<string>();
  const supplierIds = new Set(data.suppliers.map(supplier => supplier.id));
  const uniqueNames = new Map<string, string>();
  const ambiguousNames = new Set<string>();
  for (const supplier of data.suppliers) {
    const name = supplier.name.trim().toLowerCase();
    if (!name) continue;
    if (uniqueNames.has(name)) ambiguousNames.add(name);
    else uniqueNames.set(name, supplier.id);
  }

  let unclassifiedCount = 0;
  for (const snapshot of data.monthlyInboundSnapshots ?? []) {
    const name = snapshot.supplierName?.trim().toLowerCase() || '';
    const supplierId = snapshot.supplierId || (!ambiguousNames.has(name) ? uniqueNames.get(name) : undefined);
    if (supplierId && supplierIds.has(supplierId)) inboundSupplierIds.add(supplierId);
    else unclassifiedCount++;
  }
  for (const record of data.supplierBusinessRecords ?? []) {
    if (record.kind !== 'purchase' && record.kind !== 'dropship_period') continue;
    const target = record.kind === 'dropship_period' || record.fields.fulfillmentMode === 'dropship'
      ? dropshipSupplierIds
      : record.fields.fulfillmentMode === 'warehouse' ? inboundSupplierIds : undefined;
    if (!target || !record.supplierIds.length) {
      unclassifiedCount++;
      continue;
    }
    for (const supplierId of record.supplierIds) {
      if (supplierIds.has(supplierId)) target.add(supplierId);
      else unclassifiedCount++;
    }
  }
  return { inboundSupplierIds, dropshipSupplierIds, unclassifiedCount };
}
