import type { LocalWorkbenchData } from './local-store';

export const lifecycleSections = {
  sourcing: { title: '寻源与比价', purpose: '比较同一采购需求下的候选方案，留下选择依据。', done: '已确认入围', next: 'admission', fields: [
    ['requirement', '采购要求', '规格、预估数量、最晚交期；只写本次必要条件'],
    ['comparison', '关键条件差异', '同规格下的到手价、税运口径、起订量、补货时间及风险'],
  ] },
  admission: { title: '供应商准入', purpose: '针对本次产品范围验证；不等于该供应商所有产品均合格。', done: '已记录准入决定', next: 'agreements', fields: [
    ['standard', '验证标准', '关键质量要求，以及适用的资质或检测要求'],
    ['verification', '实际验证结果', '样品版本、测试日期、样本数量、测量结果；未验证请写明'],
    ['issues', '未解决问题与限制', '不适用可不填；有条件准入须写清条件'],
  ] },
  agreements: { title: '合作与约定', purpose: '沉淀双方确认的合作条件，交给执行人时不依靠口头记忆。', done: '已记录双方确认', next: 'performance', fields: [
    ['terms', '关键合作条件', '规格版本、价格及税运口径、交期与急单、账期、质量赔付'],
    ['version', '约定版本与生效时间', '版本号、生效日期；适用SKU在产品范围中列明'],
    ['receipt', '供应商确认回执', '确认人、日期、邮件或聊天记录编号；未回复不能算双方确认'],
    ['handoff', '执行交接', '下单、收货验收、付款及异常对接人；无需重复填写详细组织信息'],
  ] },
  performance: { title: '绩效与改善', purpose: '比较约定与实际履约，记录问题是否真正得到解决。', done: '已复核', next: '', fields: [
    ['period', '考核期间', '明确起止日期'],
    ['actual', '实际履约事实', '交付、质量、售后等本次相关指标，写清分子、分母及数据来源'],
    ['improvement', '改善承诺', '谁在何时解决什么问题；无异常可不填'],
    ['review', '复核结果', '复核日期、实际变化与未解决问题；不能只写配合积极'],
  ] },
  exits: { title: '暂停与退出', purpose: '先确认业务影响和未结事项，再记录暂停或退出决定。', done: '已完成处置', next: '', fields: [
    ['reason', '调整原因与处置方式', '暂停、缩减份额或退出；原因及适用产品范围'],
    ['replacement', '替代与过渡安排', '替代供应商、库存衔接、切换日期；没有替代须说明风险'],
    ['closure', '未结事项处理结果', '在途订单、库存、售后、应付和模具等；不涉及请明确写明'],
  ] },
} as const;
export type LifecycleSection = keyof typeof lifecycleSections;
export type LifecycleStatus = 'draft' | 'active' | 'decision' | 'completed' | 'cancelled';
export const statusNames = { draft: '草稿', active: '进行中', decision: '待决定', completed: '已完成', cancelled: '已终止' };
export type LifecycleVersion = Omit<LifecycleRecord, 'history'>;
export type LifecycleRecord = {
  id: string; section: LifecycleSection; title: string; productScope: string;
  businessMode?: 'inbound' | 'dropship';
  /** 形成建议所依据的业务记录；不得仅保存无法核查的文字结论。 */
  sourceRecordIds?: string[];
  /** 当前只读预留；未来启用审批时另行定义操作权限和状态迁移。 */
  directorReview?: { status: 'not_requested' | 'pending' | 'approved' | 'rejected'; reviewer?: string; reviewedAt?: string; opinion?: string };
  supplierIds: string[]; selectedSupplierIds?: string[]; offerIds: string[]; sourceId?: string;
  status: LifecycleStatus; priority: 'high' | 'normal'; owner: string; dueDate: string;
  nextAction: string; result: string; evidence: string; fields: Record<string, string>;
  revision: number; createdAt: string; updatedAt: string; history: LifecycleVersion[];
  hasConflict?: boolean;
};
export function isLifecycleSection(value: string): value is LifecycleSection {
  return Object.hasOwn(lifecycleSections, value);
}
export function emptyLifecycleRecord(section: LifecycleSection): LifecycleRecord {
  return { id: '', section, title: '', productScope: '', supplierIds: [], offerIds: [], status: 'draft', priority: 'normal', owner: '', dueDate: '', nextAction: '', result: '', evidence: '', fields: {}, revision: 0, createdAt: '', updatedAt: '', history: [] };
}
export function commitLifecycleRecord(records: LifecycleRecord[], input: LifecycleRecord): LifecycleRecord {
  if (!isLifecycleSection(input.section)) throw new Error('未知业务模块');
  if (!input.title.trim() || !input.productScope.trim()) throw new Error('请填写事项名称和产品范围');
  if (!(input.status in statusNames)) throw new Error('未知状态');
  const existing = records.find(r => r.id === input.id);
  if ((existing?.revision ?? 0) !== input.revision) throw new Error('记录已被其他操作更新，请返回详情后重新编辑');
  if (existing && existing.section !== input.section) throw new Error('不能改变记录所属模块');
  if (input.hasConflict) throw new Error('请先核对冲突版本并确认合并内容');
  if (input.selectedSupplierIds?.some(id => !input.supplierIds.includes(id))) throw new Error('入围供应商必须属于候选范围');
  if (input.status === 'completed') {
    if (['agreements', 'performance'].includes(input.section) && !input.businessMode) throw new Error('完成前请明确入仓或代发业务');
    if (!input.supplierIds.length) throw new Error('完成前请选择供应商');
    if (!input.result.trim() || !input.evidence.trim()) throw new Error('完成前请填写结论和依据');
    const required: Record<LifecycleSection, string[]> = { sourcing: ['comparison'], admission: ['standard', 'verification'], agreements: ['terms', 'version', 'receipt'], performance: ['period', 'actual', 'review'], exits: ['reason', 'replacement', 'closure'] };
    const missing = lifecycleSections[input.section].fields.filter(([key]) => required[input.section].includes(key) && !input.fields[key]?.trim());
    if (missing.length) throw new Error(`完成前请填写：${missing.map(([, label]) => label).join('、')}`);
    if (input.section === 'sourcing' && !input.selectedSupplierIds?.length) throw new Error('完成寻源前请明确入围供应商');
  }
  if (input.status === 'cancelled' && !input.result.trim()) throw new Error('终止前请填写原因');
  const now = new Date().toISOString();
  const { history: ignored, ...previous } = existing ?? input;
  return { ...input, title: input.title.trim(), productScope: input.productScope.trim(), id: input.id || crypto.randomUUID(), revision: input.revision + 1, createdAt: existing?.createdAt || now, updatedAt: now, history: existing ? [previous, ...existing.history] : [] };
}

function versionKey(r: LifecycleVersion | LifecycleRecord) {
  return JSON.stringify([r.revision, r.updatedAt, r.section, r.businessMode, r.sourceRecordIds ?? [], r.directorReview ?? null, r.title, r.productScope, r.supplierIds, r.selectedSupplierIds ?? [], r.offerIds, r.sourceId, r.status, r.priority, r.owner, r.dueDate, r.nextAction, r.result, r.evidence, Object.entries(r.fields).sort(([a], [b]) => a.localeCompare(b))]);
}
/** Keep concurrent versions rather than losing one complete record in last-write-wins. */
export function mergeLifecycleRecords(remote: LifecycleRecord[] = [], local: LifecycleRecord[] = []) {
  const result = new Map(remote.map(r => [r.id, r]));
  for (const incoming of local) {
    const old = result.get(incoming.id);
    if (!old) { result.set(incoming.id, incoming); continue; }
    const incomingKey = versionKey(incoming), oldKey = versionKey(old);
    const incomingDescends = incoming.history.some(h => versionKey(h) === oldKey);
    const oldDescends = old.history.some(h => versionKey(h) === incomingKey);
    const winner = incomingDescends ? incoming : oldDescends ? old : incoming.revision > old.revision || (incoming.revision === old.revision && incoming.updatedAt >= old.updatedAt) ? incoming : old;
    const loser = winner === incoming ? old : incoming;
    const { history: ignored, ...loserVersion } = loser;
    const versions = [...winner.history, ...loser.history, ...(incomingKey !== oldKey ? [loserVersion] : [])];
    const history = [...new Map(versions.filter(v => versionKey(v) !== versionKey(winner)).map(v => [versionKey(v), v])).values()].sort((a, b) => b.revision - a.revision || b.updatedAt.localeCompare(a.updatedAt));
    const concurrent = incomingKey !== oldKey && !incomingDescends && !oldDescends;
    const hasConflict = concurrent || winner.hasConflict || (incomingKey === oldKey && (incoming.hasConflict || old.hasConflict));
    result.set(incoming.id, { ...winner, history, ...(hasConflict ? { hasConflict: true } : {}) });
  }
  return [...result.values()];
}

export type StructureRow = { id: string; name: string; amount: number; share?: number };
/** 入仓结算金额并非付款额。缺失金额单列，禁止以报价或未知值补零。 */
export function buildProcurementStructure(data: LocalWorkbenchData, period: string) {
  const rows = (data.monthlyInboundSnapshots ?? []).filter(r => r.period === period);
  const suppliers = new Map<string, StructureRow>();
  const products = new Map<string, StructureRow>();
  const pairs = new Map<string, { supplierId: string; supplierName: string; product: string; amount: number }>();
  let knownAmount: number | undefined;
  let missingAmountCount = 0;
  let unmappedSupplierAmount = 0;
  for (const row of rows) {
    if (typeof row.settlementAmount !== 'number' || !Number.isFinite(row.settlementAmount)) { missingAmountCount++; continue; }
    const amount = row.settlementAmount;
    knownAmount = (knownAmount ?? 0) + amount;
    const matches = data.suppliers.filter(s => s.name.trim() === row.supplierName?.trim());
    const supplier = row.supplierId ? data.suppliers.find(s => s.id === row.supplierId) : matches.length === 1 ? matches[0] : undefined;
    const supplierId = supplier?.id ?? '__unmapped';
    const supplierName = supplier?.name ?? '未关联供应商';
    if (!supplier) unmappedSupplierAmount += amount;
    const sku = data.skuMasters?.find(s => s.id === row.skuMasterId);
    const product = row.productFamilyKey || sku?.productFamilyKey || sku?.productName || '未关联产品';
    suppliers.set(supplierId, { id: supplierId, name: supplierName, amount: (suppliers.get(supplierId)?.amount ?? 0) + amount });
    products.set(product, { id: product, name: product, amount: (products.get(product)?.amount ?? 0) + amount });
    const key = JSON.stringify([product, supplierId]);
    pairs.set(key, { supplierId, supplierName, product, amount: (pairs.get(key)?.amount ?? 0) + amount });
  }
  const sorted = (map: Map<string, StructureRow>) => [...map.values()].map(r => ({ ...r, share: knownAmount !== undefined && knownAmount > 0 ? r.amount / knownAmount : undefined })).sort((a, b) => b.amount - a.amount);
  return { knownAmount, missingAmountCount, unmappedSupplierAmount, rowCount: rows.length, supplierRows: sorted(suppliers), productRows: sorted(products), pairs: [...pairs.values()].sort((a, b) => b.amount - a.amount) };
}
