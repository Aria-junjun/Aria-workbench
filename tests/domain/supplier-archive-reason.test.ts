import { beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveSupplier, restoreSupplier, saveLocalWorkbenchData, loadLocalWorkbenchData, type LocalWorkbenchData } from '@/features/workbench/local-store';

const storage = new Map<string, string>();
const data: LocalWorkbenchData = {
  suppliers: [{ id: 's1', name: '供应商甲', categories: [], riskTags: [], createdAt: '2026-01-01' }],
  communications: [], offers: [], products: [], tasks: [], knowledgeCards: [], knowledgeBooks: [], decisionTools: [], knowledgeApplications: [], decisionCases: [], researchReports: [],
};

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });
  saveLocalWorkbenchData(data);
});

describe('supplier archive reason', () => {
  it('requires and retains a reason when archiving, then restores without deleting that history', () => {
    expect(() => archiveSupplier('s1', '  ')).toThrow('请填写停用理由');
    archiveSupplier('s1', '合作暂停，连续两个月无采购');
    expect(loadLocalWorkbenchData().suppliers[0]).toEqual(expect.objectContaining({ archiveReason: '合作暂停，连续两个月无采购', archivedAt: expect.any(String) }));
    restoreSupplier('s1');
    expect(loadLocalWorkbenchData().suppliers[0]).toEqual(expect.objectContaining({ archiveReason: '合作暂停，连续两个月无采购' }));
    expect(loadLocalWorkbenchData().suppliers[0].archivedAt).toBeUndefined();
  });
});
