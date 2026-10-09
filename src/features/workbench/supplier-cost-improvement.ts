import type { LocalMonthlyInboundSnapshot } from './local-store';

export type SupplierCostImprovementProject = {
  id: string;
  title: string;
  supplierId: string;
  skuMasterId: string;
  baselineUnitPrice: number;
  targetUnitPrice?: number;
  effectiveFrom: string;
  effectiveTo: string;
  owner: string;
  comparabilityConfirmed: boolean;
  comparabilityNote: string;
  evidence: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
};

export type VerifiedExtraCost = {
  supplierId: string;
  skuMasterId: string;
  period: string;
  amount: number;
  verified: boolean;
  includedInSettlement?: boolean;
  projectId?: string;
};

export function createSupplierCostImprovementProject(input: Omit<SupplierCostImprovementProject, 'id' | 'createdAt' | 'updatedAt' | 'status'>, id = crypto.randomUUID(), now = new Date().toISOString(), existing: SupplierCostImprovementProject[] = []): SupplierCostImprovementProject {
  if (!input.title.trim() || !input.supplierId || !input.skuMasterId || !input.owner.trim()) throw new Error('请填写项目名称、供应商、SKU 和负责人');
  if (!Number.isFinite(input.baselineUnitPrice) || input.baselineUnitPrice <= 0) throw new Error('基准单价必须大于零');
  if (input.targetUnitPrice !== undefined && (!Number.isFinite(input.targetUnitPrice) || input.targetUnitPrice <= 0)) throw new Error('目标单价必须大于零');
  if (!/^\d{4}-\d{2}$/.test(input.effectiveFrom) || !/^\d{4}-\d{2}$/.test(input.effectiveTo) || input.effectiveFrom > input.effectiveTo) throw new Error('请填写有效的起止月份');
  if (!input.comparabilityConfirmed || !input.comparabilityNote.trim() || !input.evidence.trim()) throw new Error('确认可比口径，并填写口径说明与基准凭证后才能保存');
  if (existing.some(project => project.status !== 'cancelled' && project.supplierId === input.supplierId && project.skuMasterId === input.skuMasterId && project.effectiveFrom <= input.effectiveTo && input.effectiveFrom <= project.effectiveTo)) throw new Error('该供应商与 SKU 在项目周期内已有改善项目，避免重复计算；请调整周期或维护现有项目');
  return { ...input, title: input.title.trim(), owner: input.owner.trim(), comparabilityNote: input.comparabilityNote.trim(), evidence: input.evidence.trim(), id, status: 'active', createdAt: now, updatedAt: now };
}

export function calculateSupplierCostImprovement(project: SupplierCostImprovementProject, snapshots: LocalMonthlyInboundSnapshot[], costs: VerifiedExtraCost[] = []) {
  if (!project.comparabilityConfirmed) return { status: '口径未确认', quantity: 0, actualUnitPrice: undefined, grossSavings: undefined, verifiedExtraCost: undefined, netSavings: undefined, snapshotIds: [] as string[] };
  const rows = snapshots.filter(row => row.supplierId === project.supplierId && row.skuMasterId === project.skuMasterId && row.period >= project.effectiveFrom && row.period <= project.effectiveTo);
  if (new Set(rows.map(row => row.period)).size !== rows.length) return { status: '同月存在多条入仓记录，需先核对重复/拆分口径', quantity: 0, actualUnitPrice: undefined, grossSavings: undefined, verifiedExtraCost: undefined, netSavings: undefined, snapshotIds: rows.map(row => row.id) };
  const priced = rows.filter(row => row.receivedQuantity != null && row.receivedQuantity > 0 && ((row.settlementAmount != null && row.settlementAmount >= 0) || (row.settlementUnitPrice != null && row.settlementUnitPrice >= 0)));
  if (!rows.length || priced.length !== rows.length) return { status: '实际价格/数量未采集完整', quantity: priced.reduce((n, row) => n + (row.receivedQuantity || 0), 0), actualUnitPrice: undefined, grossSavings: undefined, verifiedExtraCost: undefined, netSavings: undefined, snapshotIds: rows.map(row => row.id) };
  const quantity = priced.reduce((n, row) => n + row.receivedQuantity!, 0);
  const amount = priced.reduce((n, row) => n + (row.settlementAmount ?? row.settlementUnitPrice! * row.receivedQuantity!), 0);
  const actualUnitPrice = quantity > 0 ? amount / quantity : undefined;
  const grossSavings = actualUnitPrice == null ? undefined : (project.baselineUnitPrice - actualUnitPrice) * quantity;
  const applicableCosts = costs.filter(cost => cost.verified && cost.projectId === project.id && cost.supplierId === project.supplierId && cost.skuMasterId === project.skuMasterId && cost.period >= project.effectiveFrom && cost.period <= project.effectiveTo && cost.includedInSettlement === false);
  const verifiedExtraCost = applicableCosts.reduce((n, cost) => n + cost.amount, 0);
  return { status: '已按可比口径计算', quantity, actualUnitPrice, grossSavings, verifiedExtraCost, netSavings: grossSavings == null ? undefined : grossSavings - verifiedExtraCost, snapshotIds: rows.map(row => row.id) };
}
