import type { LocalWorkbenchData } from './local-store';
import { deriveSupplierBusinessModes } from './dropship-decision-loop';

export type SupplierActivity =
  | { band: 'active'; paidOrders: number }
  | { band: 'low'; paidOrders: number }
  | { band: 'unknown' }
  | { band: 'not-applicable' };

/**
 * Classifies directory activity from supplier-level dropship period records.
 * Since source data is periodic rather than order-level, records are assigned to
 * the 30-day window by periodEnd; their paid-order totals are not prorated.
 */
export function classifySupplierActivity(data: LocalWorkbenchData, now = new Date()): Record<string, SupplierActivity> {
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  startDate.setDate(startDate.getDate() - 29);
  const start = [startDate.getFullYear(), String(startDate.getMonth() + 1).padStart(2, '0'), String(startDate.getDate()).padStart(2, '0')].join('-');
  const recent = new Map<string, { orders: number; hasOrders: boolean }>();
  for (const record of data.supplierBusinessRecords ?? []) {
    if (record.kind !== 'dropship_period') continue;
    const periodEnd = record.fields.periodEnd ?? '';
    if (periodEnd < start || periodEnd > today) continue;
    const value = record.fields.paidOrders?.trim();
    const orders = value ? Number(value) : undefined;
    for (const supplierId of record.supplierIds) {
      const entry = recent.get(supplierId) ?? { orders: 0, hasOrders: false };
      if (orders != null && Number.isFinite(orders) && orders >= 0) {
        entry.orders += orders;
        entry.hasOrders = true;
      }
      recent.set(supplierId, entry);
    }
  }

  return Object.fromEntries(data.suppliers.map(supplier => {
    const modes = deriveSupplierBusinessModes(data, supplier.id);
    if (!modes.includes('dropship')) return [supplier.id, modes.includes('inbound') ? { band: 'not-applicable' as const } : { band: 'unknown' as const }];
    const orders = recent.get(supplier.id);
    if (!orders?.hasOrders) return [supplier.id, { band: 'unknown' as const }];
    return [supplier.id, orders.orders < 30 ? { band: 'low' as const, paidOrders: orders.orders } : { band: 'active' as const, paidOrders: orders.orders }];
  }));
}
