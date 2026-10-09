export type ProcurementSection = 'request' | 'pool' | 'task' | 'quote' | 'fulfillment';
export type ProcurementStatus = 'draft' | 'pending' | 'accepted' | 'paused' | 'sourcing' | 'completed' | 'cancelled';
export type FulfillmentStage = '待下单' | '已下单' | '已发货' | '已到货' | '对账中' | '已完成' | '异常';

export type ProcurementLineItem = { id: string; sku?: string; productName: string; category?: string; specification?: string; unit?: string; quantity?: string; expectedDate?: string; productType?: string; referenceUrl?: string; requirements?: string; receivingLocation?: string };
export type SupplierCandidate = { id: string; supplierId?: string; name: string; contact?: string; phone?: string; platform?: string; candidateReason?: string; source: 'master' | 'new'; status: 'candidate' | 'qualified' | 'rejected' };
export type QuoteOffer = { id: string; supplierCandidateId: string; lineItemId: string; unitPrice?: string; productUnitPrice?: string; sourceOfferId?: string; sourceOfferSkuId?: string; taxRate?: string; freight?: string; comprehensiveCost?: string; afterSalesCost?: string; moq?: string; leadTime?: string; sampleStatus?: string; note?: string; productUrl?: string; selected?: boolean; selectionReason?: string };
export function adoptCatalogOfferSku(quoteOffer: QuoteOffer, catalog: import('./local-store').LocalOffer, sku: import('./local-store').OfferSku, purchaseUnit?: string): QuoteOffer {
  if (!catalog.skus?.some(item => item.id === sku.id) || sku.unitPrice === undefined) throw new Error('报价单 SKU 不存在或单价未确认');
  if (purchaseUnit?.trim() && sku.pricingUnit?.trim() && purchaseUnit.trim() !== sku.pricingUnit.trim()) throw new Error('报价计价单位与采购单位不同，请先人工核价');
  const price = String(sku.unitPrice);
  return { ...quoteOffer, sourceOfferId: catalog.id, sourceOfferSkuId: sku.id, productUnitPrice: price, unitPrice: price, moq: sku.moq ?? quoteOffer.moq, productUrl: catalog.productUrl ?? quoteOffer.productUrl };
}
export type ProcurementTaskExecution = { channels?: string; targetQuoteCount?: string; plannedQuoteDate?: string; strategy?: string };
export type QuoteReview = { status: 'pending' | 'approved' | 'changes_requested'; reviewer?: string; submittedAt?: string; reviewedAt?: string; comment?: string };

export type ProcurementRecord = {
  management?: import('./procurement-management').ProjectManagement;
  taskExecution?: ProcurementTaskExecution;
  fulfillment?: import('./procurement-fulfillment').FulfillmentData;
  plannedFulfillmentMode?: import('./procurement-fulfillment').FulfillmentMode;
  legacyFulfillmentStage?: FulfillmentStage;
  id: string;
  section: 'request' | 'pool' | 'task' | 'quote' | 'fulfillment';
  sourceKind?: string;
  sourceNote?: string;
  title: string;
  productName: string;
  sku?: string;
  category?: string;
  specification?: string;
  unit?: string;
  quantity?: string;
  expectedDate?: string;
  requester?: string;
  owner?: string;
  priority: '高' | '中' | '低';
  status: ProcurementStatus;
  reason?: string;
  nextAction?: string;
  sourceId?: string;
  lineItems?: ProcurementLineItem[];
  supplierCandidates?: SupplierCandidate[];
  quoteOffers?: QuoteOffer[];
  fulfillmentStage?: FulfillmentStage;
  orderNo?: string;
  selectedSupplierIds?: string[];
  quoteReview?: QuoteReview;
  createdAt: string;
};

const KEY = 'procurement-workbench-v1';
export function loadProcurementRecords(): ProcurementRecord[] {
  if (typeof window === 'undefined') return [];
  const data = loadLocalWorkbenchData();
  if (data.procurementRecordsUpdatedAt) return data.procurementRecords ?? [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as ProcurementRecord[]; } catch { return []; }
}
export function saveProcurementRecords(records: ProcurementRecord[]) {
  if (typeof window === 'undefined') return;
  const current = loadLocalWorkbenchData();
  saveLocalWorkbenchData({ ...current, procurementRecords: records, procurementRecordsUpdatedAt: new Date().toISOString() });
}
export function newProcurementRecord(section: ProcurementRecord['section']): ProcurementRecord { return { id: crypto.randomUUID(), section, title: '', productName: '', priority: '中', status: section === 'request' ? 'draft' : 'pending', createdAt: new Date().toISOString() }; }

const inheritedFields: Array<keyof ProcurementRecord> = ['title', 'productName', 'sku', 'category', 'specification', 'unit', 'quantity', 'expectedDate', 'requester', 'owner', 'priority', 'reason', 'lineItems', 'sourceKind', 'sourceNote'];

export function normalizeLineItems(record: ProcurementRecord): ProcurementLineItem[] {
  if (record.lineItems?.length) return record.lineItems;
  return [{ id: `${record.id}-line-1`, sku: record.sku, productName: record.productName, category: record.category, specification: record.specification, unit: record.unit, quantity: record.quantity, expectedDate: record.expectedDate }];
}

/** Returns the direct downstream records. A request can be accepted only once. */
export function childProcurementRecords(records: ProcurementRecord[], sourceId: string) {
  return records.filter(record => record.sourceId === sourceId);
}

/** Finds current quote children and legacy fulfillment records created beside the quote under one task. */
export function fulfillmentForQuote(records: ProcurementRecord[], quote: ProcurementRecord) {
  return records.find(record => record.section === 'fulfillment' && (record.sourceId === quote.id || (!!quote.sourceId && record.sourceId === quote.sourceId)));
}

/**
 * Moves a request into the task stage without asking the user to retype it.
 * The source request remains as the audit anchor and the generated task points back to it.
 */
export function acceptProcurementRequest(records: ProcurementRecord[], requestId: string): ProcurementRecord[] {
  const request = records.find(record => record.id === requestId && (record.section === 'request' || record.section === 'pool'));
  if (!request) return records;
  const existingTask = records.find(record => record.section === 'task' && record.sourceId === request.id);
  const updatedRequest: ProcurementRecord = { ...request, status: 'accepted', nextAction: existingTask ? '已承接，进入采购任务' : '已承接，进入采购任务' };
  if (existingTask) return records.map(record => record.id === request.id ? updatedRequest : record);
  const task = inheritedFields.reduce<ProcurementRecord>((draft, key) => {
    const value = request[key];
    if (value !== undefined) (draft as Record<string, unknown>)[key] = value;
    return draft;
  }, { ...newProcurementRecord('task'), title: request.title, productName: request.productName, lineItems: normalizeLineItems(request), sourceId: request.id, status: 'accepted', nextAction: '发起询价', createdAt: new Date().toISOString() });
  return [task, ...records.map(record => record.id === request.id ? updatedRequest : record)];
}

/** Repairs records created before stage linking existed; it is intentionally limited to accepted requests. */
export function repairProcurementLinks(records: ProcurementRecord[]) {
  const linked = records.reduce((current, record) => record.section === 'request' && record.status === 'accepted' && !current.some(child => child.section === 'task' && child.sourceId === record.id) ? acceptProcurementRequest(current, record.id) : current, records);
  return linked.map(record => {
    const historicalFulfillment = record.section === 'quote' ? fulfillmentForQuote(linked, record) : undefined;
    if (record.section === 'quote' && historicalFulfillment) {
      const root = procurementSourceChain(linked, record)[0];
      const currentLines = normalizeLineItems(record);
      const historicalLines = normalizeLineItems(historicalFulfillment);
      const sourceOffers = record.quoteOffers?.length ? record.quoteOffers : historicalFulfillment.quoteOffers;
      const restoredOffers = sourceOffers?.map(offer => {
        if (currentLines.some(line => line.id === offer.lineItemId)) return offer;
        const oldLine = historicalLines.find(line => line.id === offer.lineItemId);
        const currentLine = currentLines.find(line => (oldLine?.sku && line.sku === oldLine.sku) || (oldLine?.productName && line.productName === oldLine.productName)) || (currentLines.length === 1 ? currentLines[0] : undefined);
        return currentLine ? { ...offer, lineItemId: currentLine.id } : offer;
      });
      const restoredSupplierIds = record.selectedSupplierIds?.length ? record.selectedSupplierIds : historicalFulfillment.selectedSupplierIds?.length ? historicalFulfillment.selectedSupplierIds : restoredOffers?.filter(offer => offer.selected).map(offer => offer.supplierCandidateId);
      return { ...record, supplierCandidates: record.supplierCandidates?.length ? record.supplierCandidates : historicalFulfillment.supplierCandidates, quoteOffers: restoredOffers, selectedSupplierIds: restoredSupplierIds, status: 'completed' as const, quoteReview: record.quoteReview || { status: 'approved' as const, reviewer: root.management?.reviewer || '历史流程确认', reviewedAt: record.createdAt, comment: '根据已生成的履约记录补齐验收状态' }, nextAction: '已进入采购履约' };
    }
    return record.section === 'fulfillment' && !record.fulfillmentStage ? { ...record, fulfillmentStage: '待下单' as const, nextAction: '创建采购订单' } : record;
  });
}

export function setProcurementStatus(records: ProcurementRecord[], id: string, status: ProcurementStatus, nextAction?: string) {
  return records.map(record => record.id === id ? { ...record, status, nextAction } : record);
}

export function createQuoteProject(records: ProcurementRecord[], taskId: string) {
  const task = records.find(record => record.id === taskId && record.section === 'task');
  if (!task || records.some(record => record.section === 'quote' && record.sourceId === taskId)) return records;
  const quote: ProcurementRecord = { ...newProcurementRecord('quote'), title: `${task.title || '采购任务'} · 询价项目`, productName: task.productName, lineItems: normalizeLineItems(task), sourceId: task.id, status: 'draft', nextAction: '选择本次候选供应商', createdAt: new Date().toISOString() };
  return [quote, ...records.map(record => record.id === task.id ? { ...record, status: 'sourcing' as const, nextAction: '维护本次询价项目' } : record)];
}

export function addQuoteCandidate(records: ProcurementRecord[], quoteId: string, candidate: SupplierCandidate) {
  return records.map(record => record.id === quoteId && record.section === 'quote' ? { ...record, supplierCandidates: [...(record.supplierCandidates || []).filter(item => item.id !== candidate.id && (candidate.supplierId ? item.supplierId !== candidate.supplierId : item.name !== candidate.name)), candidate], nextAction: '录入供应商报价' } : record);
}

export function saveQuoteOffer(records: ProcurementRecord[], quoteId: string, offer: QuoteOffer) {
  return records.map(record => record.id === quoteId && record.section === 'quote' ? { ...record, status: 'draft' as const, selectedSupplierIds: undefined, quoteReview: undefined, quoteOffers: [...(record.quoteOffers || []).filter(item => item.id !== offer.id && !(item.supplierCandidateId === offer.supplierCandidateId && item.lineItemId === offer.lineItemId)).map(item => offer.selected && item.lineItemId === offer.lineItemId ? { ...item, selected: false } : item), offer], nextAction: '完成比价核价' } : record);
}

export function finalizeQuote(records: ProcurementRecord[], quoteId: string, selectedSupplierIds: string[]) {
  return records.map(record => {
    if (record.id !== quoteId || record.section !== 'quote') return record;
    const reviewer = procurementSourceChain(records, record)[0]?.management?.reviewer;
    return { ...record, status: 'completed' as const, selectedSupplierIds, quoteReview: { status: 'pending' as const, reviewer, submittedAt: new Date().toISOString() }, nextAction: `等待${reviewer || '运营验收人'}验收询价结果` };
  });
}

export function reviewQuote(records: ProcurementRecord[], quoteId: string, decision: 'approved' | 'changes_requested', reviewer: string, comment?: string) {
  if (!reviewer.trim() || (decision === 'changes_requested' && !comment?.trim())) return records;
  return records.map(record => record.id === quoteId && record.section === 'quote' && record.quoteReview?.status === 'pending' ? { ...record, status: decision === 'approved' ? 'completed' as const : 'draft' as const, quoteReview: { ...record.quoteReview, status: decision, reviewer: reviewer.trim(), reviewedAt: new Date().toISOString(), comment: comment?.trim() }, nextAction: decision === 'approved' ? '生成采购履约单' : '根据验收意见补充询价' } : record);
}

export function createFulfillmentFromQuote(records: ProcurementRecord[], quoteId: string) {
  const quote = records.find(record => record.id === quoteId && record.section === 'quote' && record.status === 'completed' && record.quoteReview?.status === 'approved');
  if (!quote || fulfillmentForQuote(records, quote)) return records;
  const fulfillment: ProcurementRecord = { ...newProcurementRecord('fulfillment'), title: `${quote.title} · 履约`, productName: quote.productName, lineItems: normalizeLineItems(quote), sourceId: quote.id, supplierCandidates: quote.supplierCandidates, quoteOffers: quote.quoteOffers, selectedSupplierIds: quote.selectedSupplierIds, fulfillmentStage: '待下单', nextAction: '创建采购订单', status: 'pending', createdAt: new Date().toISOString() };
  return [fulfillment, ...records];
}

export function advanceFulfillment(records: ProcurementRecord[], fulfillmentId: string, stage: FulfillmentStage) {
  const nextAction: Record<FulfillmentStage, string> = { 待下单: '创建采购订单', 已下单: '登记供应商发货', 已发货: '登记到货 / 入仓', 已到货: '发起对账', 对账中: '完成对账付款', 已完成: '履约已完成', 异常: '处理异常并复核' };
  return records.map(record => record.id === fulfillmentId && record.section === 'fulfillment' ? { ...record, fulfillmentStage: stage, status: stage === '已完成' ? 'completed' as const : stage === '异常' ? 'paused' as const : record.status, nextAction: nextAction[stage] } : record);
}

/** Creates the next operational record (currently task -> fulfillment) and keeps the source link. */
export function createProcurementChild(records: ProcurementRecord[], sourceId: string, section: 'task' | 'fulfillment') {
  const source = records.find(record => record.id === sourceId);
  if (!source) return records;
  if (section === 'task' && source.section !== 'request') return records;
  if (section === 'fulfillment' && source.section !== 'task') return records;
  if (records.some(record => record.section === section && record.sourceId === sourceId)) return records;
  const child = inheritedFields.reduce<ProcurementRecord>((draft, key) => {
    const value = source[key];
    if (value !== undefined) (draft as Record<string, unknown>)[key] = value;
    return draft;
  }, { ...newProcurementRecord(section), title: source.title, productName: source.productName, lineItems: normalizeLineItems(source), sourceId, status: section === 'fulfillment' ? 'pending' : 'accepted', fulfillmentStage: section === 'fulfillment' ? '待下单' : undefined, nextAction: section === 'fulfillment' ? '创建采购订单' : '发起询价', createdAt: new Date().toISOString() });
  return [child, ...records];
}

export function procurementSourceChain(records: ProcurementRecord[], record: ProcurementRecord) {
  const chain: ProcurementRecord[] = [];
  let current: ProcurementRecord | undefined = record;
  while (current && !chain.some(item => item.id === current?.id)) {
    chain.unshift(current);
    current = current.sourceId ? records.find(item => item.id === current?.sourceId) : undefined;
  }
  return chain;
}
import { loadLocalWorkbenchData, saveLocalWorkbenchData } from './local-store';
