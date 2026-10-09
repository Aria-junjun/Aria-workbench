import type { LocalMonthlyInboundSnapshot, LocalSupplier, LocalWorkbenchData } from './local-store';

export type InboundWindow =
  | { kind: 'month'; month: string }
  | { kind: 'last_months'; endMonth: string; count: number }
  | { kind: 'range'; startMonth: string; endMonth: string };

export type InboundImportBatch = {
  id: string;
  period: string;
  sourceFileName: string;
  sourceSheetName: string;
  importedAt: string;
  snapshotIds: string[];
};

export type InboundSupplierSummary = {
  supplierId?: string;
  supplierName: string;
  receivedQuantity: number;
  knownSettlementAmount: number;
  recordCount: number;
  quantityMissingCount: number;
  settlementMissingCount: number;
};

function batchIdentity(snapshot: LocalMonthlyInboundSnapshot) {
  return snapshot.importBatchId || `legacy:${JSON.stringify([snapshot.sourceFileName, snapshot.sourceSheetName, snapshot.period, snapshot.importedAt])}`;
}

export function groupInboundImportBatches(snapshots: LocalMonthlyInboundSnapshot[]): InboundImportBatch[] {
  const batches = new Map<string, InboundImportBatch>();
  for (const snapshot of snapshots) {
    const id = batchIdentity(snapshot);
    const batch = batches.get(id) ?? {
      id,
      period: snapshot.period,
      sourceFileName: snapshot.sourceFileName,
      sourceSheetName: snapshot.sourceSheetName,
      importedAt: snapshot.importedAt,
      snapshotIds: [],
    };
    batch.snapshotIds.push(snapshot.id);
    batches.set(id, batch);
  }
  return [...batches.values()].sort((a, b) => b.period.localeCompare(a.period) || b.importedAt.localeCompare(a.importedAt));
}

export function selectInboundSnapshotsByWindow(snapshots: LocalMonthlyInboundSnapshot[], window: InboundWindow) {
  let startMonth: string;
  let endMonth: string;
  if (window.kind === 'month') {
    startMonth = window.month;
    endMonth = window.month;
  } else if (window.kind === 'last_months') {
    const [year, month] = window.endMonth.split('-').map(Number);
    const endIndex = year * 12 + month - 1;
    const startDate = new Date(Math.floor((endIndex - Math.max(1, window.count) + 1) / 12), (endIndex - Math.max(1, window.count) + 1) % 12, 1);
    startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    endMonth = window.endMonth;
  } else {
    startMonth = window.startMonth;
    endMonth = window.endMonth;
  }
  return snapshots.filter(snapshot => snapshot.period >= startMonth && snapshot.period <= endMonth);
}

export function aggregateInboundBySupplier(snapshots: LocalMonthlyInboundSnapshot[], suppliers: LocalSupplier[]): InboundSupplierSummary[] {
  const summaries = new Map<string, InboundSupplierSummary>();
  for (const snapshot of snapshots) {
    const supplier = suppliers.find(item => item.id === snapshot.supplierId);
    const supplierName = supplier?.shortName || supplier?.name || snapshot.supplierName || '待归属';
    const key = snapshot.supplierId || `unlinked:${snapshot.supplierName || 'unknown'}`;
    const summary = summaries.get(key) ?? {
      supplierId: snapshot.supplierId,
      supplierName,
      receivedQuantity: 0,
      knownSettlementAmount: 0,
      recordCount: 0,
      quantityMissingCount: 0,
      settlementMissingCount: 0,
    };
    summary.recordCount += 1;
    if (typeof snapshot.receivedQuantity === 'number' && Number.isFinite(snapshot.receivedQuantity)) summary.receivedQuantity += snapshot.receivedQuantity;
    else summary.quantityMissingCount += 1;
    if (typeof snapshot.settlementAmount === 'number' && Number.isFinite(snapshot.settlementAmount)) summary.knownSettlementAmount += snapshot.settlementAmount;
    else summary.settlementMissingCount += 1;
    summaries.set(key, summary);
  }
  return [...summaries.values()].sort((a, b) => b.knownSettlementAmount - a.knownSettlementAmount || b.receivedQuantity - a.receivedQuantity || a.supplierName.localeCompare(b.supplierName, 'zh-CN'));
}

export function removeInboundImportBatch(data: LocalWorkbenchData, batch: InboundImportBatch): LocalWorkbenchData {
  const targetIds = new Set(batch.snapshotIds);
  return { ...data, monthlyInboundSnapshots: (data.monthlyInboundSnapshots ?? []).filter(snapshot => !targetIds.has(snapshot.id)) };
}
