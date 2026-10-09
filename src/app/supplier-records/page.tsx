import React from 'react';
import { SupplierBusinessLedger } from '@/components/workbench/supplier-business-ledger';

export default async function SupplierRecordsPage({ searchParams }: { searchParams: Promise<{ supplierId?: string; kind?: string; snapshotId?: string; snapshotIds?: string }> }) {
  const query = await searchParams;
  const validKinds = ['sample', 'inspection', 'agreement', 'purchase', 'dropship_period'] as const;
  const initialKind = validKinds.find(kind => kind === query.kind);
  const sourceSnapshotIds = [...new Set([query.snapshotId, ...(query.snapshotIds || '').split(',')].filter((id): id is string => !!id))];
  return <SupplierBusinessLedger supplierId={query.supplierId} initialKind={initialKind} sourceSnapshotIds={sourceSnapshotIds} />;
}
