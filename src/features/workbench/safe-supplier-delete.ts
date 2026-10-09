import type { LocalWorkbenchData } from "./local-store";

export type SupplierReferenceCounts = Record<string, number>;

export type SafeSupplierDeletePreview = {
  supplierId: string;
  supplierName: string;
  references: SupplierReferenceCounts;
  totalReferences: number;
  canDelete: boolean;
  revision: string;
  backupJson: string;
};

export type SafeSupplierDeleteConfirmation = {
  supplierId: string;
  expectedRevision: string;
  typedName: string;
  secondConfirmed: boolean;
  backupDownloaded: boolean;
};

const isSupplierReferenceKey = (key: string) => {
  const normalized = key.toLowerCase();
  return normalized.includes("supplier") && normalized.includes("id");
};

function countSupplierIdReferences(value: unknown, supplierId: string, parentKey = ""): number {
  if (Array.isArray(value)) {
    if (isSupplierReferenceKey(parentKey)) {
      return value.reduce((count, item) => count + (item === supplierId ? 1 : countSupplierIdReferences(item, supplierId)), 0);
    }
    return value.reduce((count, item) => count + countSupplierIdReferences(item, supplierId), 0);
  }
  if (!value || typeof value !== "object") return 0;
  return Object.entries(value as Record<string, unknown>).reduce((count, [key, child]) => {
    if (isSupplierReferenceKey(key) && child === supplierId) return count + 1;
    return count + countSupplierIdReferences(child, supplierId, key);
  }, 0);
}

export function createWorkbenchSnapshotRevision(data: LocalWorkbenchData): string {
  const serialized = JSON.stringify(data);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${serialized.length}-${(hash >>> 0).toString(16)}`;
}

export function collectSupplierReferences(data: LocalWorkbenchData, supplierId: string): SupplierReferenceCounts {
  const references: SupplierReferenceCounts = {};
  for (const [collection, value] of Object.entries(data)) {
    if (collection === "suppliers" || !Array.isArray(value)) continue;
    const count = countSupplierIdReferences(value, supplierId);
    if (count > 0) references[collection] = count;
  }
  return references;
}

export function buildSafeSupplierDeletePreview(data: LocalWorkbenchData, supplierId: string): SafeSupplierDeletePreview {
  const supplier = data.suppliers.find((item) => item.id === supplierId);
  if (!supplier) throw new Error("供应商不存在或已被删除");
  const references = collectSupplierReferences(data, supplierId);
  const totalReferences = Object.values(references).reduce((sum, count) => sum + count, 0);
  return {
    supplierId,
    supplierName: supplier.name,
    references,
    totalReferences,
    canDelete: totalReferences === 0,
    revision: createWorkbenchSnapshotRevision(data),
    backupJson: JSON.stringify(data, null, 2),
  };
}

export function applySafeSupplierDelete(data: LocalWorkbenchData, confirmation: SafeSupplierDeleteConfirmation): LocalWorkbenchData {
  if (createWorkbenchSnapshotRevision(data) !== confirmation.expectedRevision) {
    throw new Error("数据已发生变化，请重新预览后再操作");
  }
  const preview = buildSafeSupplierDeletePreview(data, confirmation.supplierId);
  if (preview.totalReferences > 0) {
    throw new Error(`供应商仍被 ${preview.totalReferences} 条数据引用，请先合并或停用，不能直接删除`);
  }
  if (confirmation.typedName !== preview.supplierName) throw new Error("输入的供应商名称不一致");
  if (!confirmation.secondConfirmed) throw new Error("请完成二次确认");
  if (!confirmation.backupDownloaded) throw new Error("请先下载完整数据备份");
  return { ...data, suppliers: data.suppliers.filter((supplier) => supplier.id !== confirmation.supplierId) };
}
