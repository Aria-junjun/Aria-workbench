import { describe, expect, it } from 'vitest';
import { newProcurementRecord, type ProcurementRecord } from '@/features/workbench/procurement';
import { appendFulfillmentEvent, configureFulfillment, createFormalFulfillment, fulfillmentProgress, fulfillmentTotals, openFulfillmentIssues, type FulfillmentData, type FulfillmentEvent, type FulfillmentMode } from '@/features/workbench/procurement-fulfillment';

function record(): ProcurementRecord { return { ...newProcurementRecord('fulfillment'), id: 'f', productName: '刷子', title: '采购刷子', fulfillmentStage: '已下单', lineItems: [{ id: 'l', productName: '刷子', quantity: '10' }] }; }
function config(mode: FulfillmentMode = 'warehouse'): Omit<FulfillmentData, 'events'> { return { mode, orderNo: 'PO-01', orderDate: '2026-09-01', owner: '采购员', settlement: '现结', settlementTerms: '', sourcePlatform: '聚水潭', originalOrderNo: 'source-01', importBatch: '', destination: '杭州仓', lines: [{ lineId: 'l', supplierId: 'supplier-1', supplierName: '供应商一', quantity: 10 }] }; }
function event(kind: FulfillmentEvent['kind'], fields: Partial<FulfillmentEvent> = {}): FulfillmentEvent { return { id: crypto.randomUUID(), lineId: 'l', kind, date: '2026-09-02', operator: '采购员', note: '实测反馈', evidence: '凭证-01', recordedAt: '2026-09-02T10:00:00Z', ...fields }; }
function configured(mode: FulfillmentMode = 'warehouse') { return configureFulfillment([record()], 'f', config(mode)); }
function delivered(mode: FulfillmentMode = 'warehouse') { const sent = appendFulfillmentEvent(configured(mode), 'f', event('shipment', { id: 'send', quantity: 10, carrier: '顺丰', trackingNo: 'SF01' })); return appendFulfillmentEvent(sent, 'f', event('receipt', { quantity: 10, rejectedQuantity: 0, relatedEventId: 'send' })); }

describe('fact-based fulfillment', () => {
  it('keeps legacy records unclassified until a route and order are confirmed', () => {
    expect(fulfillmentProgress(record()).stage).toBe('待完善');
    const updated = configured()[0];
    expect(updated.legacyFulfillmentStage).toBe('已下单');
    expect(updated.fulfillment?.events).toEqual([]);
    expect(fulfillmentProgress(updated).stage).toBe('待发货');
  });
  it('requires a route, positive quantities, supplier and monthly terms', () => {
    expect(() => configureFulfillment([record()], 'f', { ...config(), mode: '' as FulfillmentMode })).toThrow('业务路径');
    expect(() => configureFulfillment([record()], 'f', { ...config(), settlement: '月结' })).toThrow('月结账期');
    expect(() => configureFulfillment([record()], 'f', { ...config(), lines: [{ ...config().lines[0], quantity: 0 }] })).toThrow('大于零');
    expect(() => configureFulfillment([record()], 'f', { ...config(), lines: [{ ...config().lines[0], supplierId: '' }] })).toThrow('供应商');
  });
  it('stores an optional supplier-confirmed promised arrival date without substituting demand dates', () => {
    const withPromise = configureFulfillment([record()], 'f', { ...config(), lines: [{ ...config().lines[0], promisedArrivalDate: '2026-09-10' }] });
    expect(withPromise[0].fulfillment?.lines[0].promisedArrivalDate).toBe('2026-09-10');
    expect(() => configureFulfillment([record()], 'f', { ...config(), lines: [{ ...config().lines[0], promisedArrivalDate: '2026-02-30' }] })).toThrow('有效日期');
    expect(configured()[0].fulfillment?.lines[0].promisedArrivalDate).toBeUndefined();
  });
  it('allows correcting an order before facts exist, then preserves its baseline', () => {
    const edited = configureFulfillment(configured(), 'f', { ...config(), destination: '上海仓' });
    expect(edited[0].fulfillment?.destination).toBe('上海仓');
    expect(() => configureFulfillment(delivered(), 'f', config())).toThrow('不能改写');
  });
  it('rejects duplicate original source orders and preserves source metadata', () => {
    const records = [...configured(), { ...record(), id: 'other' }];
    expect(() => configureFulfillment(records, 'other', { ...config(), orderNo: 'PO-02' })).toThrow('原始单号');
    expect(records[0].fulfillment?.originalOrderNo).toBe('source-01');
  });
  it('supports partial shipments and receipts tied to actual batches', () => {
    let records = appendFulfillmentEvent(configured(), 'f', event('shipment', { id: 'send', quantity: 4, carrier: '顺丰', trackingNo: 'SF01' }));
    expect(fulfillmentProgress(records[0]).stage).toBe('部分发货');
    expect(() => appendFulfillmentEvent(records, 'f', event('shipment', { quantity: 7, carrier: '顺丰', trackingNo: 'SF02' }))).toThrow('超过未发');
    expect(() => appendFulfillmentEvent(records, 'f', event('receipt', { quantity: 5, rejectedQuantity: 0, relatedEventId: 'send' }))).toThrow('超过该批次');
    records = appendFulfillmentEvent(records, 'f', event('receipt', { quantity: 2, rejectedQuantity: 0, relatedEventId: 'send' }));
    expect(fulfillmentProgress(records[0]).stage).toBe('部分收货');
    expect(fulfillmentTotals(records[0].fulfillment!, 'l')).toEqual({ ordered: 10, shipped: 4, received: 2, rejected: 0 });
  });
  it('does not accept receipts without logistics or quantities outside their batch', () => {
    expect(() => appendFulfillmentEvent(configured(), 'f', event('receipt', { quantity: 1, rejectedQuantity: 0 }))).toThrow('发货批次');
    expect(() => appendFulfillmentEvent(configured(), 'f', event('shipment', { quantity: 1 }))).toThrow('物流公司');
  });
  it.each(['warehouse', 'dropship'] as const)('%s reaches reconciliation without pretending payment is complete', mode => {
    const records = delivered(mode);
    expect(fulfillmentProgress(records[0]).stage).toBe('待对账');
    expect(records[0].status).not.toBe('completed');
    const raised = appendFulfillmentEvent(records, 'f', event('issue', { id: 'issue', issueType: '退货退款', responsibility: '待核实', note: '签收后发现质量问题' }));
    expect(fulfillmentProgress(raised[0]).stage).toBe('异常待处理');
    const resolved = appendFulfillmentEvent(raised, 'f', event('resolution', { relatedEventId: 'issue', note: '供应商退款，待对账核实', evidence: '退款凭证' }));
    expect(openFulfillmentIssues(resolved[0].fulfillment!)).toHaveLength(0);
    expect(fulfillmentProgress(resolved[0]).stage).toBe('待对账');
  });
  it('blocks quality discrepancies until resolution evidence exists', () => {
    const sent = appendFulfillmentEvent(configured(), 'f', event('shipment', { id: 'send', quantity: 10, carrier: '顺丰', trackingNo: 'SF01' }));
    const received = appendFulfillmentEvent(sent, 'f', event('receipt', { id: 'bad', quantity: 10, rejectedQuantity: 2, relatedEventId: 'send' }));
    expect(fulfillmentProgress(received[0]).stage).toBe('异常待处理');
    expect(() => appendFulfillmentEvent(received, 'f', event('resolution', { relatedEventId: 'bad', evidence: '' }))).toThrow('依据');
  });
  it('records verified extra costs against an open source exception without changing its open/closed state', () => {
    const exception = appendFulfillmentEvent(configured(), 'f', event('issue', { id: 'issue-cost', issueType: '补发运费', responsibility: '供应商', note: '质量问题补发' }));
    const cost = appendFulfillmentEvent(exception, 'f', event('cost_impact', { id: 'cost-1', relatedEventId: 'issue-cost', impactType: '补发物流', extraCostAmount: 45, costVerificationStatus: 'verified', includedInSettlement: false, evidence: '补发物流账单.pdf', note: '补发物流费' }));
    expect(openFulfillmentIssues(cost[0].fulfillment!)).toHaveLength(1);
    expect(cost[0].fulfillment?.events.at(-1)).toMatchObject({ extraCostAmount: 45, relatedEventId: 'issue-cost', includedInSettlement: false });
    expect(() => appendFulfillmentEvent(exception, 'f', event('cost_impact', { relatedEventId: 'issue-cost', impactType: '补发物流', extraCostAmount: 45, costVerificationStatus: 'verified', includedInSettlement: false, evidence: '' }))).toThrow('凭证');
    expect(() => appendFulfillmentEvent(exception, 'f', event('cost_impact', { relatedEventId: 'missing', impactType: '补发物流', extraCostAmount: 45, costVerificationStatus: 'verified', includedInSettlement: false, evidence: '账单' }))).toThrow('关联');
  });
  it('requires sample evidence and a pass before creating a separate formal order', () => {
    const received = delivered('sample');
    expect(fulfillmentProgress(received[0]).stage).toBe('待核样');
    expect(() => createFormalFulfillment(received, 'f', 'warehouse')).toThrow('核验通过');
    expect(() => appendFulfillmentEvent(received, 'f', event('inspection', { verdict: '通过', evidence: '' }))).toThrow('样品版本');
    const passed = appendFulfillmentEvent(received, 'f', event('inspection', { verdict: '通过', note: '115cm 刷子，承重测试通过，准入此规格', evidence: 'V1样品 / 检验单001' }));
    const formal = createFormalFulfillment(passed, 'f', 'dropship');
    expect(formal.records[0]).toMatchObject({ sourceId: 'f', plannedFulfillmentMode: 'dropship' });
    expect(formal.records[0].lineItems?.[0].quantity).toBe('');
    expect(formal.records[0].fulfillment).toBeUndefined();
    expect(formal.records.find(item => item.id === 'f')?.fulfillment?.mode).toBe('sample');
    expect(createFormalFulfillment(formal.records, 'f', 'dropship').id).toBe(formal.id);
    expect(() => configureFulfillment(formal.records, formal.id, { ...config('dropship'), orderNo: 'PO-02', originalOrderNo: 'source-02', lines: [{ ...config().lines[0], supplierId: 'different' }] })).toThrow('供应商一致');
  });
  it('requires failed sampling issues to be closed even after a later pass', () => {
    let records = appendFulfillmentEvent(delivered('sample'), 'f', event('inspection', { id: 'failed', verdict: '复样' }));
    records = appendFulfillmentEvent(records, 'f', event('inspection', { verdict: '通过' }));
    expect(fulfillmentProgress(records[0]).ready).toBe(false);
    records = appendFulfillmentEvent(records, 'f', event('resolution', { relatedEventId: 'failed' }));
    expect(fulfillmentProgress(records[0]).stage).toBe('核样通过');
  });
  it('prevents duplicate submissions and backwards dates', () => {
    const shipment = event('shipment', { id: 'same', quantity: 5, carrier: '顺丰', trackingNo: 'SF01' });
    const records = appendFulfillmentEvent(configured(), 'f', shipment);
    expect(appendFulfillmentEvent(records, 'f', shipment)).toBe(records);
    expect(() => appendFulfillmentEvent(records, 'f', event('receipt', { quantity: 1, rejectedQuantity: 0, relatedEventId: 'same', date: '2026-09-01' }))).toThrow('不能早于发货');
  });
});
