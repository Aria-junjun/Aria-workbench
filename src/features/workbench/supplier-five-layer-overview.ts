import type { LocalMonthlyInboundSnapshot, LocalWorkbenchData } from './local-store';
import type { ProcurementRecord } from './procurement';
import { normalizeLineItems } from './procurement';
import { fulfillmentTotals, openFulfillmentIssues } from './procurement-fulfillment';

export type SupplyAssuranceRow = {
  productKey: string;
  productName: string;
  actualSupplierCount: number;
  maxSupplierShare?: number;
  singleSource: boolean;
  actualSupplierNames: string[];
  registeredBackupCount: number;
  verifiedBackupCount: number;
  sourceSnapshotIds: string[];
};

export type DeliveryFulfillmentRow = {
  procurementId: string;
  lineId: string;
  orderNo: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  owner: string;
  orderDate: string;
  promisedArrivalDate?: string;
  actualShipmentDate?: string;
  actualArrivalDate?: string;
  orderedQuantity: number;
  shippedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  observedLeadDays?: number;
  onTimeArrival?: boolean;
  sourceHref: string;
};

export type SupplierQualityIssueRow = {
  id: string;
  procurementId: string;
  orderNo: string;
  productName: string;
  supplierName: string;
  date: string;
  issueType: string;
  quantity?: number;
  responsibility: string;
  evidence: string;
  resolved: boolean;
  verifiedExtraCost?: number;
  costInclusionStatus: string;
  sourceHref: string;
};

export type SupplierCostChangeRow = {
  key: string;
  supplierName: string;
  skuMasterId: string;
  productName: string;
  priorUnitPrice?: number;
  currentUnitPrice?: number;
  unitPriceChange?: number;
  comparableQuantity?: number;
  realizedSavings?: number;
  baselineStatus: '未采集';
  sourceSnapshotIds: string[];
};

export type SupplierFiveLayerOverview = {
  supply: SupplyAssuranceRow[];
  delivery: DeliveryFulfillmentRow[];
  quality: SupplierQualityIssueRow[];
  costChanges: SupplierCostChangeRow[];
};

const monthIndex = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  return year * 12 + month - 1;
};

function previousMonth(period: string) {
  const index = monthIndex(period) - 1;
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
}

function supplierLabel(data: LocalWorkbenchData, supplierId?: string, suppliedName?: string) {
  return data.suppliers.find(supplier => supplier.id === supplierId)?.shortName
    || data.suppliers.find(supplier => supplier.id === supplierId)?.name
    || suppliedName
    || '供应商待关联';
}

function productKey(snapshot: LocalMonthlyInboundSnapshot) {
  return snapshot.productFamilyKey || snapshot.operatingProductCode || snapshot.skuMasterId;
}

function productLabel(data: LocalWorkbenchData, key: string, snapshot?: LocalMonthlyInboundSnapshot) {
  const sku = data.skuMasters?.find(item => item.id === (snapshot?.skuMasterId || key));
  return sku?.shortName || sku?.productName || key;
}

function activeAt(effectiveFrom: string, effectiveTo: string | undefined, period: string) {
  return effectiveFrom.slice(0, 7) <= period && (!effectiveTo || effectiveTo.slice(0, 7) >= period);
}

function observedDays(start: string, end: string) {
  if (!start || !end || end < start) return undefined;
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function knownUnitPrice(snapshot: LocalMonthlyInboundSnapshot) {
  if (snapshot.settlementUnitPrice != null && Number.isFinite(snapshot.settlementUnitPrice)) return snapshot.settlementUnitPrice;
  if (snapshot.settlementAmount != null && snapshot.receivedQuantity && snapshot.receivedQuantity > 0) return snapshot.settlementAmount / snapshot.receivedQuantity;
  return undefined;
}

function weightedUnitPrice(snapshots: LocalMonthlyInboundSnapshot[]) {
  const priced = snapshots.filter(snapshot => knownUnitPrice(snapshot) != null && snapshot.receivedQuantity != null && snapshot.receivedQuantity > 0);
  if (priced.length !== snapshots.length) return undefined;
  const quantity = priced.reduce((sum, snapshot) => sum + (snapshot.receivedQuantity ?? 0), 0);
  if (!quantity) return undefined;
  const amount = priced.reduce((sum, snapshot) => sum + (snapshot.settlementAmount ?? (knownUnitPrice(snapshot)! * (snapshot.receivedQuantity ?? 0))), 0);
  return amount / quantity;
}

export function buildSupplierFiveLayerOverview(
  data: LocalWorkbenchData,
  procurementRecords: ProcurementRecord[],
  period: string,
): SupplierFiveLayerOverview {
  const snapshots = (data.monthlyInboundSnapshots ?? []).filter(snapshot => snapshot.period === period);
  const products = new Map<string, LocalMonthlyInboundSnapshot[]>();
  for (const snapshot of snapshots) {
    const key = productKey(snapshot);
    products.set(key, [...(products.get(key) ?? []), snapshot]);
  }

  const supply = [...products.entries()].map(([key, rows]): SupplyAssuranceRow => {
    const actualAmounts = new Map<string, { name: string; amount: number }>();
    const hasUnlinkedSupplier = rows.some(row => !row.supplierId && !row.supplierName?.trim());
    const hasUnknownAmount = rows.some(row => row.settlementAmount == null || !Number.isFinite(row.settlementAmount));
    for (const row of rows) {
      if (!row.supplierId && !row.supplierName?.trim()) continue;
      const id = row.supplierId || `name:${row.supplierName!.trim()}`;
      const existing = actualAmounts.get(id) ?? { name: supplierLabel(data, row.supplierId, row.supplierName), amount: 0 };
      existing.amount += row.settlementAmount ?? 0;
      actualAmounts.set(id, existing);
    }
    const actual = [...actualAmounts.values()];
    const knownAmount = actual.reduce((sum, item) => sum + item.amount, 0);
    const assignments = (data.productSupplierAssignments ?? []).filter(item => item.productFamilyKey === key && item.status === 'active' && activeAt(item.effectiveFrom, item.effectiveTo, period));
    const backups = assignments.filter(item => item.role === 'backup');
    const verified = new Set((data.supplierCapabilities ?? [])
      .filter(capability => capability.status === 'verified' && capability.productFamilyKey === key && capability.sourceRecordIds.length > 0 && activeAt(capability.effectiveFrom || period, capability.effectiveTo, period))
      .map(capability => capability.supplierId));
    return {
      productKey: key,
      productName: productLabel(data, key, rows[0]),
      actualSupplierCount: actual.length,
      maxSupplierShare: !hasUnlinkedSupplier && !hasUnknownAmount && knownAmount > 0 ? Math.max(...actual.map(item => item.amount / knownAmount)) : undefined,
      singleSource: !hasUnlinkedSupplier && actual.length === 1,
      actualSupplierNames: actual.map(item => item.name),
      registeredBackupCount: backups.length,
      verifiedBackupCount: backups.filter(item => !!item.supplierId && verified.has(item.supplierId)).length,
      sourceSnapshotIds: rows.map(item => item.id),
    };
  }).sort((left, right) => Number(right.singleSource) - Number(left.singleSource) || (right.maxSupplierShare ?? -1) - (left.maxSupplierShare ?? -1));

  const warehouseOrders = procurementRecords.filter(record => record.section === 'fulfillment' && record.fulfillment?.mode === 'warehouse');
  const delivery: DeliveryFulfillmentRow[] = warehouseOrders.flatMap(record => {
    const fulfillment = record.fulfillment!;
    const lines = normalizeLineItems(record);
    return fulfillment.lines.map(line => {
      const totals = fulfillmentTotals(fulfillment, line.lineId);
      const events = fulfillment.events.filter(event => event.lineId === line.lineId);
      const shipments = events.filter(event => event.kind === 'shipment').map(event => event.date).sort();
      const receipts = events.filter(event => event.kind === 'receipt').map(event => event.date).sort();
      const actualArrivalDate = receipts.at(-1);
      const actualShipmentDate = shipments.at(-1);
      const lineItem = lines.find(item => item.id === line.lineId);
      const supplierCandidate = record.supplierCandidates?.find(candidate => candidate.id === line.supplierId || candidate.supplierId === line.supplierId);
      return {
        procurementId: record.id,
        lineId: line.lineId,
        orderNo: fulfillment.orderNo || record.orderNo || '订单号未采集',
        productName: lineItem?.productName || record.productName || '产品未采集',
        supplierId: supplierCandidate?.supplierId || line.supplierId,
        supplierName: supplierLabel(data, supplierCandidate?.supplierId || line.supplierId, line.supplierName),
        owner: fulfillment.owner || record.owner || '未指定',
        orderDate: fulfillment.orderDate,
        promisedArrivalDate: line.promisedArrivalDate,
        actualShipmentDate,
        actualArrivalDate,
        orderedQuantity: totals.ordered,
        shippedQuantity: totals.shipped,
        receivedQuantity: totals.received,
        remainingQuantity: Math.max(0, totals.ordered - totals.received),
        observedLeadDays: actualArrivalDate ? observedDays(fulfillment.orderDate, actualArrivalDate) : undefined,
        onTimeArrival: line.promisedArrivalDate && actualArrivalDate
          ? actualArrivalDate <= line.promisedArrivalDate
          : undefined,
        sourceHref: `/procurement/fulfillment?recordId=${encodeURIComponent(record.id)}&lineId=${encodeURIComponent(line.lineId)}`,
      };
    });
  }).sort((left, right) => (right.remainingQuantity - left.remainingQuantity) || right.orderDate.localeCompare(left.orderDate));

  const quality = warehouseOrders.flatMap(record => {
    const fulfillment = record.fulfillment!;
    const lines = normalizeLineItems(record);
    return fulfillment.events.filter(event => event.kind === 'issue' || (event.kind === 'receipt' && (event.rejectedQuantity || 0) > 0) || (event.kind === 'inspection' && event.verdict !== '通过')).map(event => {
      const line = fulfillment.lines.find(item => item.lineId === event.lineId);
      const lineItem = lines.find(item => item.id === event.lineId);
      const isResolved = fulfillment.events.some(item => item.kind === 'resolution' && item.relatedEventId === event.id);
      const costEntries = fulfillment.events.filter(item => item.kind === 'cost_impact' && item.relatedEventId === event.id);
      const verifiedCosts = costEntries.filter(item => item.costVerificationStatus === 'verified');
      const outsideSettlement = verifiedCosts.filter(item => item.includedInSettlement === false).reduce((sum, item) => sum + (item.extraCostAmount || 0), 0);
      const included = verifiedCosts.some(item => item.includedInSettlement === true);
      return {
        id: `${record.id}:${event.id}`,
        procurementId: record.id,
        orderNo: fulfillment.orderNo || record.orderNo || '订单号未采集',
        productName: lineItem?.productName || record.productName || '产品未采集',
        supplierName: supplierLabel(data, line?.supplierId, line?.supplierName),
        date: event.date,
        issueType: event.issueType || (event.rejectedQuantity ? '收货拒收' : event.kind === 'inspection' ? '核样异常' : '履约异常'),
        quantity: event.rejectedQuantity || event.quantity,
        responsibility: event.responsibility || '责任待核实',
        evidence: event.evidence || event.note || '依据未记录',
        resolved: isResolved,
        verifiedExtraCost: verifiedCosts.length ? outsideSettlement : undefined,
        costInclusionStatus: !costEntries.length ? '未登记' : verifiedCosts.length !== costEntries.length ? '部分待核实' : included && outsideSettlement ? '部分已计入 / 部分未计入' : included ? '已计入结算' : '未计入结算',
        sourceHref: `/procurement/fulfillment?recordId=${encodeURIComponent(record.id)}&eventId=${encodeURIComponent(event.id)}`,
      };
    });
  }).sort((left, right) => right.date.localeCompare(left.date));

  const priorPeriod = previousMonth(period);
  const priorSnapshots = (data.monthlyInboundSnapshots ?? []).filter(snapshot => snapshot.period === priorPeriod);
  const priorGroups = new Map<string, LocalMonthlyInboundSnapshot[]>();
  for (const snapshot of priorSnapshots) {
    const key = `${snapshot.supplierId || snapshot.supplierName || 'unlinked'}\u0000${snapshot.skuMasterId}`;
    priorGroups.set(key, [...(priorGroups.get(key) ?? []), snapshot]);
  }
  const costChanges: SupplierCostChangeRow[] = [...new Set(snapshots.map(snapshot => `${snapshot.supplierId || snapshot.supplierName || 'unlinked'}\u0000${snapshot.skuMasterId}`))].map(key => {
    const current = snapshots.filter(snapshot => `${snapshot.supplierId || snapshot.supplierName || 'unlinked'}\u0000${snapshot.skuMasterId}` === key);
    const prior = priorGroups.get(key) ?? [];
    const priorUnitPrice = weightedUnitPrice(prior);
    const currentUnitPrice = weightedUnitPrice(current);
    return {
      key,
      supplierName: supplierLabel(data, current[0]?.supplierId, current[0]?.supplierName),
      skuMasterId: current[0]?.skuMasterId || '',
      productName: productLabel(data, current[0]?.productFamilyKey || current[0]?.skuMasterId || '', current[0]),
      priorUnitPrice,
      currentUnitPrice,
      unitPriceChange: priorUnitPrice != null && currentUnitPrice != null ? currentUnitPrice - priorUnitPrice : undefined,
      comparableQuantity: current.every(snapshot => snapshot.receivedQuantity != null) ? current.reduce((sum, snapshot) => sum + (snapshot.receivedQuantity ?? 0), 0) : undefined,
      realizedSavings: undefined,
      baselineStatus: '未采集' as const,
      sourceSnapshotIds: [...prior, ...current].map(snapshot => snapshot.id),
    };
  }).sort((left, right) => Math.abs(right.unitPriceChange ?? 0) - Math.abs(left.unitPriceChange ?? 0));

  return { supply, delivery, quality, costChanges };
}
