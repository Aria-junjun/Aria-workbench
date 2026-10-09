import { newProcurementRecord, normalizeLineItems, type ProcurementRecord } from './procurement';

export type FulfillmentMode = 'sample' | 'warehouse' | 'dropship';
export const fulfillmentModes: Record<FulfillmentMode, string> = { sample: '采购样品', warehouse: '入仓采购', dropship: '一件代发' };
export type FulfillmentOrderLine = { lineId: string; supplierId: string; supplierName: string; quantity: number; promisedArrivalDate?: string };
export type FulfillmentEvent = {
  id: string; kind: 'shipment' | 'receipt' | 'inspection' | 'issue' | 'resolution' | 'cost_impact'; date: string; operator: string;
  lineId: string; quantity?: number; rejectedQuantity?: number; carrier?: string; trackingNo?: string;
  relatedEventId?: string; verdict?: '通过' | '复样' | '不通过'; note: string; evidence?: string;
  issueType?: string; responsibility?: string; recordedAt: string;
  impactType?: string; extraCostAmount?: number; costVerificationStatus?: 'estimated' | 'verified'; includedInSettlement?: boolean; costProjectId?: string;
};
export type FulfillmentData = {
  mode: FulfillmentMode; orderNo: string; orderDate: string; owner: string; settlement: '现结' | '月结'; settlementTerms: string;
  sourcePlatform: string; originalOrderNo: string; importBatch: string; destination: string;
  lines: FulfillmentOrderLine[]; events: FulfillmentEvent[];
};

export function fulfillmentTotals(data: FulfillmentData, lineId: string) {
  const events = data.events.filter(event => event.lineId === lineId);
  const sum = (kind: FulfillmentEvent['kind'], field: 'quantity' | 'rejectedQuantity' = 'quantity') => events.filter(event => event.kind === kind).reduce((total, event) => total + (event[field] || 0), 0);
  return { ordered: data.lines.find(line => line.lineId === lineId)?.quantity || 0, shipped: sum('shipment'), received: sum('receipt'), rejected: sum('receipt', 'rejectedQuantity') };
}

export function openFulfillmentIssues(data: FulfillmentData) {
  return data.events.filter(event => (event.kind === 'issue' || (event.kind === 'receipt' && (event.rejectedQuantity || 0) > 0) || (event.kind === 'inspection' && event.verdict !== '通过')) && !data.events.some(resolution => resolution.kind === 'resolution' && resolution.relatedEventId === event.id));
}

export function fulfillmentProgress(record: ProcurementRecord) {
  const data = record.fulfillment;
  if (!data) return { stage: '待完善', next: '确认业务路径与采购单', ready: false };
  if (openFulfillmentIssues(data).length) return { stage: '异常待处理', next: '记录处理结果并关闭异常', ready: false };
  const allReceived = data.lines.every(line => fulfillmentTotals(data, line.lineId).received >= line.quantity);
  if (allReceived && data.mode === 'sample') {
    const passed = data.lines.every(line => [...data.events].reverse().find(event => event.kind === 'inspection' && event.lineId === line.lineId)?.verdict === '通过');
    return { stage: passed ? '核样通过' : '待核样', next: passed ? '确认合作方式，建立正式履约单' : '登记样品测试与核验结果', ready: passed };
  }
  if (allReceived) return { stage: '待对账', next: data.settlement === '月结' ? '纳入月结对账，核对退款与扣款' : '核对现结付款及售后差额', ready: true };
  if (data.events.some(event => event.kind === 'receipt')) return { stage: data.mode === 'dropship' ? '部分签收' : '部分收货', next: data.mode === 'dropship' ? '继续跟进签收及售后' : '继续登记收货与验收', ready: false };
  if (data.lines.every(line => fulfillmentTotals(data, line.lineId).shipped >= line.quantity)) return { stage: '已发货', next: data.mode === 'dropship' ? '登记消费者签收' : '登记收货与验收', ready: false };
  if (data.events.some(event => event.kind === 'shipment')) return { stage: '部分发货', next: '登记剩余发货或已发批次收货', ready: false };
  return { stage: '待发货', next: '登记供应商发货', ready: false };
}

function requireText(value: string | undefined, label: string) { if (!value?.trim()) throw new Error(`请填写${label}`); }
function requireDate(value: string) { const parsed = new Date(`${value}T00:00:00Z`); if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('请填写有效日期'); }

export function configureFulfillment(records: ProcurementRecord[], id: string, input: Omit<FulfillmentData, 'events'>): ProcurementRecord[] {
  const record = records.find(item => item.id === id && item.section === 'fulfillment');
  if (!record) throw new Error('履约记录不存在');
  if (record.fulfillment?.events.length) throw new Error('已登记业务事实，不能改写原采购单');
  if (!fulfillmentModes[input.mode]) throw new Error('请选择业务路径');
  requireText(input.orderNo, '采购单号 / 代发关联单号'); requireDate(input.orderDate); requireText(input.owner, '负责人');
  requireText(input.sourcePlatform, '数据来源'); requireText(input.destination, input.mode === 'dropship' ? '收货对象或关联销售订单' : '收货地点');
  if (!['现结', '月结'].includes(input.settlement)) throw new Error('请选择结算方式');
  if (input.settlement === '月结') requireText(input.settlementTerms, '月结账期约定');
  const ids = normalizeLineItems(record).map(line => line.id);
  if (input.lines.length !== ids.length || new Set(input.lines.map(line => line.lineId)).size !== ids.length || input.lines.some(line => !ids.includes(line.lineId))) throw new Error('采购明细不完整');
  for (const line of input.lines) {
    requireText(line.supplierId, '每个产品的供应商'); requireText(line.supplierName, '供应商名称');
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error('每个产品的采购数量必须大于零');
    if (line.promisedArrivalDate) requireDate(line.promisedArrivalDate);
    if (line.promisedArrivalDate && line.promisedArrivalDate < input.orderDate) throw new Error('承诺到货日期不能早于下单日期');
  }
  const sourceSample = records.find(item => item.id === record.sourceId && item.fulfillment?.mode === 'sample');
  if (sourceSample) {
    if (!fulfillmentProgress(sourceSample).ready) throw new Error('来源样品尚有未通过核验或未关闭异常');
    if (input.lines.some(line => sourceSample.fulfillment?.lines.find(item => item.lineId === line.lineId)?.supplierId !== line.supplierId)) throw new Error('正式履约的供应商须与核样通过的供应商一致');
  }
  if (records.some(item => item.id !== id && item.fulfillment?.orderNo === input.orderNo.trim())) throw new Error('此采购单号已存在，请核对是否重复录入');
  if (input.originalOrderNo.trim() && records.some(item => item.id !== id && item.fulfillment?.sourcePlatform === input.sourcePlatform && item.fulfillment?.originalOrderNo === input.originalOrderNo.trim())) throw new Error('相同来源的原始单号已存在，请核对重复订单');
  return records.map(item => item.id === id ? { ...item, orderNo: input.orderNo.trim(), owner: input.owner, legacyFulfillmentStage: item.legacyFulfillmentStage || item.fulfillmentStage, fulfillment: { ...input, orderNo: input.orderNo.trim(), originalOrderNo: input.originalOrderNo.trim(), events: [] }, fulfillmentStage: '已下单', status: 'pending', nextAction: '登记供应商发货' } : item);
}

export function appendFulfillmentEvent(records: ProcurementRecord[], id: string, event: FulfillmentEvent): ProcurementRecord[] {
  const record = records.find(item => item.id === id && item.section === 'fulfillment');
  if (!record?.fulfillment) throw new Error('请先完善采购单信息');
  const data = record.fulfillment;
  if (data.events.some(item => item.id === event.id)) return records;
  if (!['shipment', 'receipt', 'inspection', 'issue', 'resolution', 'cost_impact'].includes(event.kind)) throw new Error('未知记录类型');
  if (!data.lines.some(line => line.lineId === event.lineId)) throw new Error('请选择采购明细');
  requireDate(event.date); requireText(event.operator, '登记人');
  if (event.date < data.orderDate) throw new Error('业务日期不能早于下单日期');
  const totals = fulfillmentTotals(data, event.lineId);
  const related = data.events.find(item => item.id === event.relatedEventId && item.lineId === event.lineId);
  if (event.kind === 'shipment' || event.kind === 'receipt') {
    if (!Number.isFinite(event.quantity) || event.quantity! <= 0) throw new Error('数量必须大于零');
  }
  if (event.kind === 'shipment') {
    requireText(event.carrier, '物流公司 / 运输方式'); requireText(event.trackingNo, '物流单号 / 发货凭证号');
    if (event.quantity! > totals.ordered - totals.shipped) throw new Error('发货数量超过未发数量');
  }
  if (event.kind === 'receipt') {
    if (related?.kind !== 'shipment') throw new Error('请选择对应的发货批次');
    const received = data.events.filter(item => item.kind === 'receipt' && item.relatedEventId === related.id).reduce((sum, item) => sum + (item.quantity || 0), 0);
    if (event.quantity! > (related.quantity || 0) - received) throw new Error('收货数量超过该批次未收数量');
    if (event.date < related.date) throw new Error('收货日期不能早于发货日期');
    if (!Number.isFinite(event.rejectedQuantity) || event.rejectedQuantity! < 0 || event.rejectedQuantity! > event.quantity!) throw new Error('不合格数量须在零与本次实收数量之间');
    requireText(event.note, data.mode === 'dropship' ? '签收反馈' : '验收结果');
  }
  if (event.kind === 'inspection') {
    if (data.mode !== 'sample' || totals.received < totals.ordered) throw new Error('样品收齐后才能登记核样');
    if (!['通过', '复样', '不通过'].includes(event.verdict || '')) throw new Error('请选择核样结论');
    const lastReceipt = data.events.filter(item => item.kind === 'receipt' && item.lineId === event.lineId).map(item => item.date).sort().at(-1)!;
    if (event.date < lastReceipt) throw new Error('核样日期不能早于收样日期');
    requireText(event.note, '测试项目、实测结果及准入产品范围');
    requireText(event.evidence, '样品版本与检验依据');
    if (records.some(item => item.sourceId === record.id && item.section === 'fulfillment')) throw new Error('已建立正式履约单，核样结果已锁定；新增问题请登记异常');
  }
  if (event.kind === 'issue') { requireText(event.issueType, '异常类型'); requireText(event.responsibility, '责任归属（可填待核实）'); requireText(event.note, '异常事实'); }
  if (event.kind === 'resolution') {
    if (!related || !openFulfillmentIssues(data).some(item => item.id === related.id)) throw new Error('请选择未关闭的异常');
    if (event.date < related.date) throw new Error('处理日期不能早于异常日期');
    requireText(event.note, '处理结果'); requireText(event.evidence, '处理依据 / 凭证');
  }
  if (event.kind === 'cost_impact') {
    if (!related || !openFulfillmentIssues(data).some(item => item.id === related.id)) throw new Error('请关联一条未关闭的异常');
    requireText(event.impactType, '增量费用类型');
    requireText(event.note, '费用说明');
    if (!Number.isFinite(event.extraCostAmount) || event.extraCostAmount! <= 0) throw new Error('增量费用必须大于零');
    if (!['estimated', 'verified'].includes(event.costVerificationStatus || '')) throw new Error('请选择预计或已核实');
    if (typeof event.includedInSettlement !== 'boolean') throw new Error('请选择是否已计入采购结算');
    if (event.costVerificationStatus === 'verified') requireText(event.evidence, '费用凭证');
  }
  const updated: ProcurementRecord = { ...record, fulfillment: { ...data, events: [...data.events, event] } };
  const progress = fulfillmentProgress(updated);
  updated.status = progress.stage === '异常待处理' ? 'paused' : 'pending';
  updated.nextAction = progress.next;
  updated.fulfillmentStage = progress.stage === '异常待处理' ? '异常' : progress.ready ? '已到货' : totals.shipped || event.kind === 'shipment' ? '已发货' : '已下单';
  return records.map(item => item.id === id ? updated : item);
}

export function createFormalFulfillment(records: ProcurementRecord[], id: string, mode: 'warehouse' | 'dropship') {
  const sample = records.find(item => item.id === id);
  if (!sample?.fulfillment || sample.fulfillment.mode !== 'sample' || !fulfillmentProgress(sample).ready) throw new Error('所有样品核验通过且异常关闭后，才能建立正式履约单');
  const existing = records.find(item => item.section === 'fulfillment' && item.sourceId === id);
  if (existing) return { records, id: existing.id };
  const child: ProcurementRecord = { ...newProcurementRecord('fulfillment'), sourceId: id, plannedFulfillmentMode: mode, title: `${sample.productName} · ${fulfillmentModes[mode]}`, productName: sample.productName, owner: sample.owner, lineItems: normalizeLineItems(sample).map(line => ({ ...line, quantity: '' })), supplierCandidates: sample.supplierCandidates, quoteOffers: sample.quoteOffers, selectedSupplierIds: sample.selectedSupplierIds, nextAction: `确认${fulfillmentModes[mode]}采购数量与订单`, reason: `核样通过，拟采用${fulfillmentModes[mode]}；正式数量需重新确认。` };
  return { records: [child, ...records], id: child.id };
}
