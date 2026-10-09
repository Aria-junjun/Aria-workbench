import { afterEach, expect, it, vi } from 'vitest';
import { bootstrapCloudWhenEmpty, commitCloudBackup, prepareCloudBackup } from '@/features/workbench/manual-cloud-sync';

const storage = new Map<string, string>();
const key = 'personal-commercial-workbench';
const local = { suppliers: [{ id: 's1', name: '本地' }], products: [] };
const remote = { suppliers: [{ id: 's1', name: '云端' }], products: [] };

afterEach(() => { vi.unstubAllGlobals(); storage.clear(); });
function setup(cloud = remote) {
  storage.set(key, JSON.stringify(local));
  storage.set(`${key}:local-revision`, 'rev-1');
  storage.set(`${key}:pending-sync`, 'yes');
  vi.stubGlobal('window', { localStorage: {
    getItem: (name: string) => storage.get(name) ?? null,
    setItem: (name: string, value: string) => storage.set(name, value),
    removeItem: (name: string) => storage.delete(name),
  } });
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: [{ id: 'db', updated_at: 'cloud-rev-1', data: cloud }] })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

it('loads cloud data read-only into a genuinely empty browser', async () => {
  const fetchMock = setup();
  storage.delete(key);
  storage.delete(`${key}:pending-sync`);
  const result = await bootstrapCloudWhenEmpty();
  expect(result?.data).toEqual(remote);
  expect(JSON.parse(storage.get(key)!)).toEqual(remote);
  expect(storage.get(`${key}:verified-cloud-revision`)).toBe('cloud-rev-1');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
});

it('never replaces a local snapshot or pending edit during bootstrap', async () => {
  const fetchMock = setup();
  expect(await bootstrapCloudWhenEmpty()).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  storage.delete(key);
  expect(await bootstrapCloudWhenEmpty()).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('previews changed records without writing', async () => {
  const fetchMock = setup();
  const preview = await prepareCloudBackup();
  expect(preview.status).toBe('ready');
  expect(preview.changed).toBeGreaterThan(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
});

it('blocks a cloud-only record that a full snapshot would erase', async () => {
  setup({ ...remote, suppliers: [...remote.suppliers, { id: 's2', name: '仅云端' }] });
  expect((await prepareCloudBackup()).status).toBe('conflict');
});

it('rejects a stale local preview and keeps pending state', async () => {
  const fetchMock = setup();
  const preview = await prepareCloudBackup();
  storage.set(`${key}:local-revision`, 'rev-2');
  expect((await commitCloudBackup(preview)).status).toBe('conflict');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(storage.get(`${key}:pending-sync`)).toBe('yes');
});

it('rejects a cloud revision change before upload', async () => {
  const fetchMock = setup();
  const preview = await prepareCloudBackup();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: [{ id: 'db', updated_at: 'cloud-rev-2', data: remote }] })));
  expect((await commitCloudBackup(preview)).status).toBe('conflict');
  expect(fetchMock.mock.calls.every(([, init]) => !init || init.method !== 'POST')).toBe(true);
});

it('clears pending only after a guarded write and matching cloud readback', async () => {
  const fetchMock = setup();
  const preview = await prepareCloudBackup();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: [{ id: 'db', updated_at: 'cloud-rev-1', data: remote }] })));
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: [{ id: 'db', updated_at: 'cloud-rev-2', data: local }] })));
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: [{ id: 'db', updated_at: 'cloud-rev-2', data: local }] })));
  const result = await commitCloudBackup(preview);
  expect(result.status).toBe('verified');
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ action: 'upsert', expectedUpdatedAt: 'cloud-rev-1' });
  expect(storage.has(`${key}:pending-sync`)).toBe(false);
  expect(storage.get(`${key}:verified-cloud-revision`)).toBe('cloud-rev-2');
});

it('keeps pending when post-write readback does not match', async () => {
  const fetchMock = setup();
  const preview = await prepareCloudBackup();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: [{ id: 'db', updated_at: 'cloud-rev-1', data: remote }] })));
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: [{ id: 'db', updated_at: 'cloud-rev-2', data: local }] })));
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: [{ id: 'db', updated_at: 'cloud-rev-2', data: remote }] })));
  expect((await commitCloudBackup(preview)).status).toBe('error');
  expect(storage.has(`${key}:pending-sync`)).toBe(true);
});
