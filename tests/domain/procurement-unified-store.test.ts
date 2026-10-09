import { beforeEach, expect, it, vi } from 'vitest';
import { loadProcurementRecords, newProcurementRecord, saveProcurementRecords } from '@/features/workbench/procurement';
import { loadLocalWorkbenchData, loadWorkbenchData, mergeDemandRecords } from '@/features/workbench/local-store';

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  };
  vi.stubGlobal('window', { localStorage });
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

it('reads historical browser procurement records and migrates them without removing the original backup', () => {
  const record = { ...newProcurementRecord('fulfillment'), id: 'old-order' };
  storage.set('procurement-workbench-v1', JSON.stringify([record]));
  expect(loadProcurementRecords()).toEqual([record]);
  saveProcurementRecords(loadProcurementRecords());
  expect(loadLocalWorkbenchData().procurementRecords?.map(item => item.id)).toEqual(['old-order']);
  expect(storage.get('procurement-workbench-v1')).toBeTruthy();
});

it('does not revive a deleted procurement record from an older cloud snapshot', () => {
  const old = { ...newProcurementRecord('fulfillment'), id: 'removed' };
  const merged = mergeDemandRecords(
    { procurementRecords: [], procurementRecordsUpdatedAt: '2026-09-29T12:00:00.000Z' },
    { procurementRecords: [old], procurementRecordsUpdatedAt: '2026-09-29T11:00:00.000Z' },
  );
  expect(merged.procurementRecords).toEqual([]);
});

it('automatically stages legacy procurement orders on first workbench load while offline', async () => {
  const record = { ...newProcurementRecord('fulfillment'), id: 'first-open' };
  storage.set('procurement-workbench-v1', JSON.stringify([record]));
  const loaded = await loadWorkbenchData();
  expect(loaded.procurementRecords?.map(item => item.id)).toEqual(['first-open']);
  expect(loadLocalWorkbenchData().procurementRecordsUpdatedAt).toBeTruthy();
  expect(storage.get('personal-commercial-workbench:pending-sync')).toBeTruthy();
  expect(storage.get('procurement-workbench-v1')).toBeTruthy();
});
