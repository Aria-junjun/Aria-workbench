import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/supabase-proxy/route';
import { commitLifecycleRecord, emptyLifecycleRecord } from '@/features/workbench/supplier-lifecycle';
vi.mock('@/features/auth/guard', () => ({ requireWorkbenchSession: async () => null }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function setup(patchResult: unknown = [{}]) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only');
  const original = commitLifecycleRecord([], { ...emptyLifecycleRecord('sourcing'), title: '事项', productScope: '白板' });
  const remote = commitLifecycleRecord([original], { ...original, result: '远端决定' });
  const local = commitLifecycleRecord([original], { ...original, result: '本地决定' });
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'db', updated_at: '2026-09-20T00:00:00Z', data: { supplierLifecycleRecords: [remote] } }]))).mockResolvedValueOnce(new Response(JSON.stringify(patchResult)));
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, local };
}
it('preserves remote lifecycle history before updating an existing cloud snapshot', async () => {
  const { fetchMock, local } = setup();
  const response = await POST(new NextRequest('http://localhost/api/supabase-proxy', { method: 'POST', body: JSON.stringify({ action: 'upsert', expectedUpdatedAt: '2026-09-20T00:00:00Z', data: { supplierLifecycleRecords: [local] } }) }));
  expect(response.status).toBe(200);
  const sent = JSON.parse(fetchMock.mock.calls[1][1].body).data.supplierLifecycleRecords[0];
  expect(sent.hasConflict).toBe(true);
  expect([sent.result, ...sent.history.map((h: { result: string }) => h.result)]).toContain('远端决定');
  expect(fetchMock.mock.calls[1][0]).toContain('updated_at=eq.');
});
it('does not report cloud success if another writer changed the row concurrently', async () => {
  const { local } = setup([]);
  const response = await POST(new NextRequest('http://localhost/api/supabase-proxy', { method: 'POST', body: JSON.stringify({ action: 'upsert', expectedUpdatedAt: '2026-09-20T00:00:00Z', data: { supplierLifecycleRecords: [local] } }) }));
  expect(response.status).toBe(409);
});
