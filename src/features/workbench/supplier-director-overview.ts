import type { LocalWorkbenchData } from "./local-store";
import { lifecycleSections, type LifecycleRecord } from "./supplier-lifecycle";
import type { NativeSupplierPerformanceSnapshot } from "./supplier-native-performance";

export type SupplierDirectorAction = {
  id: string;
  sourceRecordId: string;
  title: string;
  businessMode: "inbound" | "dropship" | "unknown";
  supplierName: string;
  productScope: string;
  evidence: string;
  owner: string;
  dueDate: string;
  nextAction: string;
  sourceHref: string;
  actionHref: string;
  urgency: number;
};

export type SupplierDirectorOverview = {
  period: string;
  nativePerformance: Array<NativeSupplierPerformanceSnapshot & { supplierName: string }>;
  decisionActions: SupplierDirectorAction[];
};

function isOpen(record: LifecycleRecord) {
  return record.status !== "completed" && record.status !== "cancelled";
}

function lifecycleAction(record: LifecycleRecord, data: LocalWorkbenchData, today: string): SupplierDirectorAction {
  const supplierName = record.supplierIds
    .map((id) => {
      const supplier = data.suppliers.find((item) => item.id === id);
      return supplier?.shortName || supplier?.name || "档案已缺失";
    })
    .join("、") || "供应商待关联";
  const overdue = isOpen(record) && !!record.dueDate && record.dueDate < today;
  const sourceHref = `/supplier-lifecycle/${record.section}/${record.id}`;
  const sourceIds = record.sourceRecordIds ?? [];
  return {
    id: `lifecycle:${record.id}`,
    sourceRecordId: record.id,
    title: record.title,
    businessMode: record.businessMode ?? "unknown",
    supplierName,
    productScope: record.productScope || "产品范围待明确",
    evidence: sourceIds.length ? `${sourceIds.length} 条来源记录` : record.evidence || "依据待补充",
    owner: record.owner || "待指定",
    dueDate: record.dueDate || "未设期限",
    nextAction: record.nextAction || "待明确下一步",
    sourceHref,
    actionHref: sourceHref,
    urgency: (overdue ? 100 : 0) + (record.status === "decision" ? 30 : 0) + (record.priority === "high" ? 20 : 0),
  };
}

function matchesMonth(snapshot: NativeSupplierPerformanceSnapshot, period: string) {
  return snapshot.periodStart.slice(0, 7) <= period && snapshot.periodEnd.slice(0, 7) >= period;
}

export function buildSupplierDirectorOverview(
  data: LocalWorkbenchData,
  period: string,
  today = new Date().toLocaleDateString("sv-SE"),
): SupplierDirectorOverview {
  const nativePerformance = (data.supplierNativePerformanceSnapshots ?? [])
    .filter((snapshot) => matchesMonth(snapshot, period))
    .map((snapshot) => ({
      ...snapshot,
      supplierName: data.suppliers.find((supplier) => supplier.id === snapshot.supplierId)?.shortName
        || data.suppliers.find((supplier) => supplier.id === snapshot.supplierId)?.name
        || "档案已缺失",
    }))
    .sort((left, right) => left.businessMode.localeCompare(right.businessMode)
      || left.schemeName.localeCompare(right.schemeName, "zh-CN")
      || left.supplierName.localeCompare(right.supplierName, "zh-CN"));

  const lifecycle = (data.supplierLifecycleRecords ?? [])
    .filter((record) => isOpen(record) && (record.priority === "high" || record.status === "decision" || (!!record.dueDate && record.dueDate < today)))
    .map((record) => lifecycleAction(record, data, today));
  return {
    period,
    nativePerformance,
    decisionActions: lifecycle.sort((left, right) => right.urgency - left.urgency || left.title.localeCompare(right.title, "zh-CN")),
  };
}

export function lifecycleActionLabel(action: SupplierDirectorAction) {
  return action.businessMode === "unknown" ? "待明确业务" : action.businessMode === "inbound" ? "入仓" : "代发";
}

export function lifecycleSectionLabel(section: LifecycleRecord["section"]) {
  return lifecycleSections[section].title;
}
