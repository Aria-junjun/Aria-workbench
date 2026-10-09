import type { LocalWorkbenchData } from './local-store';

const KEY = 'personal-commercial-workbench';
const PROXY = '/api/supabase-proxy';
const BASE_REVISION = `${KEY}:verified-cloud-revision`;
const VERIFIED_AT = `${KEY}:verified-at`;

type CloudRow = { id: string; updated_at: string; data: LocalWorkbenchData };
export type BackupPreview = {
  status: 'ready' | 'conflict';
  reason?: string;
  cloudRevision: string;
  localRevision: string | null;
  localData: LocalWorkbenchData;
  added: number;
  changed: number;
  cloudOnly: number;
};
export type BackupResult = { status: 'verified' | 'conflict' | 'error'; reason?: string; verifiedAt?: string };

export function getSyncMode(): 'manual' | 'auto' {
  // Automatic mode is intentionally dormant until the same guarded flow is reviewed for unattended use.
  return 'manual';
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function currentLocal() {
  const stored = window.localStorage.getItem(KEY);
  if (!stored) throw new Error('当前浏览器没有可备份的业务数据');
  return JSON.parse(stored) as LocalWorkbenchData;
}

async function latestCloud(): Promise<CloudRow> {
  const response = await fetch(`${PROXY}?action=latest`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`云端读取失败（HTTP ${response.status}）`);
  const payload = await response.json() as { ok: boolean; data: CloudRow[] };
  if (!payload.ok || !Array.isArray(payload.data) || !payload.data[0]?.updated_at) {
    throw new Error('云端尚无可核对的业务快照');
  }
  return payload.data[0];
}

/** First visit only: display the existing cloud snapshot without uploading or merging anything. */
export async function bootstrapCloudWhenEmpty(): Promise<{ revision: string; data: LocalWorkbenchData } | null> {
  if (window.localStorage.getItem(KEY) || window.localStorage.getItem(`${KEY}:pending-sync`)) return null;
  const cloud = await latestCloud();
  // A local edit may have happened while the request was in flight.
  if (window.localStorage.getItem(KEY) || window.localStorage.getItem(`${KEY}:pending-sync`)) return null;
  window.localStorage.setItem(KEY, JSON.stringify(cloud.data));
  window.localStorage.setItem(BASE_REVISION, cloud.updated_at);
  window.localStorage.setItem(VERIFIED_AT, new Date().toISOString());
  return { revision: cloud.updated_at, data: cloud.data };
}

function collectionDiff(local: LocalWorkbenchData, cloud: LocalWorkbenchData) {
  let added = 0;
  let changed = 0;
  let cloudOnly = 0;
  const names = new Set([...Object.keys(local), ...Object.keys(cloud)]);
  for (const name of names) {
    const left = (local as unknown as Record<string, unknown>)[name];
    const right = (cloud as unknown as Record<string, unknown>)[name];
    if (Array.isArray(left) || Array.isArray(right)) {
      const leftItems = Array.isArray(left) ? left : [];
      const rightItems = Array.isArray(right) ? right : [];
      if (leftItems.some((item) => !item?.id) || rightItems.some((item) => !item?.id)) {
        if (canonical(left) !== canonical(right)) changed++;
        continue;
      }
      const localById = new Map(leftItems.map((item) => [item.id as string, item]));
      const cloudById = new Map(rightItems.map((item) => [item.id as string, item]));
      for (const [id, item] of localById) {
        if (!cloudById.has(id)) added++;
        else if (canonical(item) !== canonical(cloudById.get(id))) changed++;
      }
      for (const id of cloudById.keys()) if (!localById.has(id)) cloudOnly++;
    } else if (canonical(left) !== canonical(right)) {
      changed++;
    }
  }
  return { added, changed, cloudOnly };
}

export async function prepareCloudBackup(): Promise<BackupPreview> {
  const localData = currentLocal();
  const cloud = await latestCloud();
  const diff = collectionDiff(localData, cloud.data);
  const verifiedBase = window.localStorage.getItem(BASE_REVISION);
  const conflict = diff.cloudOnly > 0 || (!!verifiedBase && verifiedBase !== cloud.updated_at);
  return {
    status: conflict ? 'conflict' : 'ready',
    reason: diff.cloudOnly > 0 ? '云端存在本地没有的记录，禁止整份覆盖' : conflict ? '云端在上次核验后已变化' : undefined,
    cloudRevision: cloud.updated_at,
    localRevision: window.localStorage.getItem(`${KEY}:local-revision`),
    localData,
    ...diff,
  };
}

export async function commitCloudBackup(preview: BackupPreview): Promise<BackupResult> {
  if (preview.status !== 'ready') return { status: 'conflict', reason: preview.reason };
  if (window.localStorage.getItem(`${KEY}:local-revision`) !== preview.localRevision || canonical(currentLocal()) !== canonical(preview.localData)) {
    return { status: 'conflict', reason: '预览后本地数据已变化，请重新核对' };
  }
  try {
    const cloud = await latestCloud();
    if (cloud.updated_at !== preview.cloudRevision) return { status: 'conflict', reason: '预览后云端数据已变化，请重新核对' };
    const response = await fetch(PROXY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert', expectedUpdatedAt: preview.cloudRevision, data: preview.localData }),
    });
    if (response.status === 409) return { status: 'conflict', reason: '云端同时被其他操作修改，请重新核对' };
    if (!response.ok) return { status: 'error', reason: `云端写入失败（HTTP ${response.status}）` };
    const readback = await latestCloud();
    if (canonical(readback.data) !== canonical(preview.localData)) {
      return { status: 'error', reason: '写入后回读内容不同；保留本地待备份状态' };
    }
    if (window.localStorage.getItem(`${KEY}:local-revision`) !== preview.localRevision || canonical(currentLocal()) !== canonical(preview.localData)) {
      return { status: 'conflict', reason: '备份期间本地出现新编辑，请再次备份' };
    }
    const verifiedAt = new Date().toISOString();
    window.localStorage.setItem(BASE_REVISION, readback.updated_at);
    window.localStorage.setItem(VERIFIED_AT, verifiedAt);
    window.localStorage.removeItem(`${KEY}:pending-sync`);
    return { status: 'verified', verifiedAt };
  } catch (error) {
    return { status: 'error', reason: error instanceof Error ? error.message : '网络异常' };
  }
}

export function lastVerifiedAt() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(VERIFIED_AT);
}

export async function readCloudSnapshotForRestore(): Promise<{ revision: string; data: LocalWorkbenchData }> {
  const cloud = await latestCloud();
  return { revision: cloud.updated_at, data: cloud.data };
}

export function recordCloudRestoreBase(revision: string) {
  window.localStorage.setItem(BASE_REVISION, revision);
  window.localStorage.removeItem(VERIFIED_AT);
}
