import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/supabase-proxy/route';

vi.mock('@/features/auth/guard', () => ({ requireWorkbenchSession: async () => null }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const revision = '2026-10-09T01:00:00Z';
function setup() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only');
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 'db', updated_at: revision, data: { suppliers: [] } }])));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
function request(expectedUpdatedAt?: string, action = 'upsert') {
  return new NextRequest('http://localhost/api/supabase-proxy', {
    method: 'POST', body: JSON.stringify({ action, expectedUpdatedAt, data: { suppliers: [] } })
  });
}

it('latest exposes cloud row identity and revision', async () => {
  const fetchMock = setup();
  const response = await GET(new NextRequest('http://localhost/api/supabase-proxy?action=latest'));
  const payload = await response.json();
  expect(payload.data[0]).toMatchObject({ id: 'db', updated_at: revision });
  expect(fetchMock.mock.calls[0][0]).toContain('select=id%2Cupdated_at%2Cdata');
});

it('rejects versionless and stale whole-snapshot writes without patching', async () => {
  const fetchMock = setup();
  expect((await POST(request())).status).toBe(409);
  expect((await POST(request('old'))).status).toBe(409);
  expect(fetchMock.mock.calls.every(([, init]) => init.method !== 'PATCH')).toBe(true);
});

it('rejects legacy insert and update paths', async () => {
  const fetchMock = setup();
  expect((await POST(request(undefined, 'insert'))).status).toBe(409);
  expect((await POST(request(undefined, 'update'))).status).toBe(409);
  expect(fetchMock).not.toHaveBeenCalled();
});
