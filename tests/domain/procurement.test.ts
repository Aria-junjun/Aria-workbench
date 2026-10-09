import { describe, expect, it } from 'vitest';
import { adoptCatalogOfferSku } from '@/features/workbench/procurement';

it('adopts one SKU price from a catalog quote as an immutable procurement snapshot', () => {
  const catalog = { id: 'offer-a', supplierId: 'supplier-a', name: '双规格报价', createdAt: '', skus: [{ id: 'small', specName: '小号', unitPrice: 3 }, { id: 'large', specName: '大号', unitPrice: 5 }] };
  const saved = adoptCatalogOfferSku({ id: 'quote-line', supplierCandidateId: 'candidate-a', lineItemId: 'line-a' }, catalog, catalog.skus[1]);
  catalog.skus[1].unitPrice = 9;
  expect(saved.productUnitPrice).toBe('5');
  expect(saved.sourceOfferId).toBe('offer-a');
  expect(saved.sourceOfferSkuId).toBe('large');
});
it('refuses to adopt a catalog unit price when pricing and purchasing units disagree', () => {
  const catalog = { id:'offer-a', name:'卷材报价', createdAt:'', skus:[{id:'roll',specName:'整卷',unitPrice:50,pricingUnit:'卷'}] };
  expect(() => adoptCatalogOfferSku({id:'q',supplierCandidateId:'s',lineItemId:'l'}, catalog, catalog.skus[0], '米')).toThrow('计价单位');
});
import { acceptProcurementRequest, addQuoteCandidate, advanceFulfillment, createFulfillmentFromQuote, createProcurementChild, createQuoteProject, finalizeQuote, newProcurementRecord, procurementSourceChain, repairProcurementLinks, reviewQuote, saveQuoteOffer, type ProcurementLineItem } from '@/features/workbench/procurement';

describe('procurement workflow links', () => {
  const lines: ProcurementLineItem[] = [
    { id: 'line-a', sku: 'A', productName: '清洁刷', unit: '套', quantity: '100', productType: '新产品', referenceUrl: 'https://example.com/brush', requirements: '独立包装', receivingLocation: '杭州仓' },
    { id: 'line-b', sku: 'B', productName: '替换刷头', unit: '个', quantity: '200' },
  ];

  it('accepts a request into one task and copies the request facts', () => {
    const request = { ...newProcurementRecord('request'), title: '抖音家清产品', productName: '家居伸缩清洁刷', sku: 'SKU-01', quantity: '100', unit: '套', requester: '商品部', priority: '高' as const, status: 'pending' as const };
    const records = acceptProcurementRequest([request], request.id);
    const task = records.find(record => record.section === 'task');
    expect(task).toMatchObject({ sourceId: request.id, title: request.title, productName: request.productName, sku: request.sku, quantity: request.quantity, unit: request.unit, priority: '高', status: 'accepted' });
    expect(records.find(record => record.id === request.id)?.status).toBe('accepted');
    expect(acceptProcurementRequest(records, request.id).filter(record => record.section === 'task')).toHaveLength(1);
  });

  it('keeps one selected supplier per SKU while preserving other SKU decisions', () => {
    const quote = { ...newProcurementRecord('quote'), status: 'completed' as const, selectedSupplierIds: ['s1'], quoteOffers: [
      { id: 'a1', supplierCandidateId: 's1', lineItemId: 'line-a', selected: true, selectionReason: '原选择' },
      { id: 'b1', supplierCandidateId: 's1', lineItemId: 'line-b', selected: true, selectionReason: '交期合适' },
    ] };
    const updated = saveQuoteOffer([quote], quote.id, { id: 'a2', supplierCandidateId: 's2', lineItemId: 'line-a', selected: true, selectionReason: '成本更优', productUrl: 'https://example.com/a2' })[0];
    expect(updated.quoteOffers?.filter(item => item.selected).map(item => item.id)).toEqual(['b1', 'a2']);
    expect(updated.status).toBe('draft');
    expect(updated.selectedSupplierIds).toBeUndefined();
  });

  it('creates a fulfillment child from a task and preserves the chain', () => {
    const request = { ...newProcurementRecord('request'), title: '补货需求', productName: '包装袋', status: 'pending' as const };
    const withTask = acceptProcurementRequest([request], request.id);
    const task = withTask.find(record => record.section === 'task')!;
    const withFulfillment = createProcurementChild(withTask, task.id, 'fulfillment');
    const fulfillment = withFulfillment.find(record => record.section === 'fulfillment')!;
    expect(fulfillment).toMatchObject({ sourceId: task.id, productName: request.productName, status: 'pending' });
    expect(procurementSourceChain(withFulfillment, fulfillment).map(record => record.section)).toEqual(['request', 'task', 'fulfillment']);
  });

  it('repairs an already accepted request from the earlier unlinked version', () => {
    const request = { ...newProcurementRecord('request'), title: '历史已承接需求', productName: '历史产品', status: 'accepted' as const };
    const repaired = repairProcurementLinks([request]);
    expect(repaired.some(record => record.section === 'task' && record.sourceId === request.id)).toBe(true);
  });

  it('migrates old fulfillment records to an actionable first stage', () => {
    const oldFulfillment = { ...newProcurementRecord('fulfillment'), title: '旧履约单', productName: '产品', nextAction: '等待履约登记' };
    expect(repairProcurementLinks([oldFulfillment])[0]).toMatchObject({ fulfillmentStage: '待下单', nextAction: '创建采购订单' });
  });

  it('carries every SKU line from a request into the task and quote project', () => {
    const request = { ...newProcurementRecord('request'), title: '多 SKU 采购', productName: '清洁组合', lineItems: lines, status: 'pending' as const };
    const withTask = acceptProcurementRequest([request], request.id);
    const task = withTask.find(record => record.section === 'task')!;
    expect(task.lineItems).toEqual(lines);
    const withQuote = createQuoteProject(withTask, task.id);
    const quote = withQuote.find(record => record.section === 'quote')!;
    expect(quote.sourceId).toBe(task.id);
    expect(quote.lineItems).toEqual(lines);
  });

  it('stores a new candidate supplier and quote per SKU without changing the supplier master', () => {
    const task = { ...newProcurementRecord('task'), title: '询价任务', productName: '组合产品', lineItems: lines, status: 'accepted' as const };
    const quote = createQuoteProject([task], task.id).find(record => record.section === 'quote')!;
    const withCandidate = addQuoteCandidate([task, quote], quote.id, { id: 'candidate-1', name: '新供应商候选', platform: '1688', source: 'new', status: 'candidate' });
    const withOffer = saveQuoteOffer(withCandidate, quote.id, { id: 'offer-1', supplierCandidateId: 'candidate-1', lineItemId: 'line-a', productUnitPrice: '12.50', freight: '5.00', comprehensiveCost: '17.50', afterSalesCost: '2.00', taxRate: '13%', leadTime: '7天' });
    const updated = withOffer.find(record => record.id === quote.id)!;
    expect(updated.supplierCandidates?.[0].name).toBe('新供应商候选');
    expect(updated.supplierCandidates?.[0].platform).toBe('1688');
    expect(updated.quoteOffers).toEqual(expect.arrayContaining([expect.objectContaining({ lineItemId: 'line-a', supplierCandidateId: 'candidate-1' })]));
    expect(updated.quoteOffers?.[0]).toEqual(expect.objectContaining({ productUnitPrice: '12.50', freight: '5.00', comprehensiveCost: '17.50', afterSalesCost: '2.00' }));
    expect(updated.quoteOffers?.some(offer => offer.lineItemId === 'line-b')).toBe(false);
  });

  it('only creates fulfillment after a quote is finalized and advances operational stages', () => {
    const task = { ...newProcurementRecord('task'), title: '履约任务', productName: '产品', lineItems: lines, status: 'sourcing' as const };
    const quote = { ...createQuoteProject([task], task.id).find(record => record.section === 'quote')!, status: 'completed' as const, quoteReview: { status: 'approved' as const, reviewer: '运营甲' }, nextAction: '生成履约单' };
    const records = createFulfillmentFromQuote([task, quote], quote.id);
    const fulfillment = records.find(record => record.section === 'fulfillment')!;
    expect(fulfillment).toMatchObject({ sourceId: quote.id, fulfillmentStage: '待下单', status: 'pending' });
    expect(advanceFulfillment(records, fulfillment.id, '已下单').find(record => record.id === fulfillment.id)?.fulfillmentStage).toBe('已下单');
  });

  it('requires operational review before creating fulfillment', () => {
    const task = { ...newProcurementRecord('task'), id: 't-review', title: '验收任务', productName: '产品', management: { reviewer: '运营甲' } };
    const quote = { ...newProcurementRecord('quote'), id: 'q-review', sourceId: task.id, title: '验收询价', productName: '产品' };
    const submitted = finalizeQuote([task, quote], quote.id, ['s1']);
    expect(submitted.find(item => item.id === quote.id)?.quoteReview).toMatchObject({ status: 'pending', reviewer: '运营甲' });
    expect(createFulfillmentFromQuote(submitted, quote.id)).toEqual(submitted);
    const approved = reviewQuote(submitted, quote.id, 'approved', '运营甲', '满足需求');
    expect(approved.find(item => item.id === quote.id)).toMatchObject({ status: 'completed', quoteReview: { status: 'approved' }, nextAction: '生成采购履约单' });
    expect(createFulfillmentFromQuote(approved, quote.id).some(item => item.section === 'fulfillment')).toBe(true);
  });

  it('restores an approved quote when a historical fulfillment already exists', () => {
    const quote = { ...newProcurementRecord('quote'), id: 'q-old', productName: '当前产品', lineItems: [{ id: 'new-line', productName: '当前产品' }], status: 'draft' as const };
    const fulfillment = { ...newProcurementRecord('fulfillment'), id: 'f-old', sourceId: quote.id, productName: '当前产品', lineItems: [{ id: 'old-line', productName: '当前产品' }], supplierCandidates: [{ id: 's1', name: '历史供应商', source: 'new' as const, status: 'candidate' as const }], quoteOffers: [{ id: 'o1', supplierCandidateId: 's1', lineItemId: 'old-line', productUnitPrice: '12', selected: true, selectionReason: '样品通过' }], selectedSupplierIds: ['s1'] };
    expect(repairProcurementLinks([quote, fulfillment]).find(item => item.id === quote.id)).toMatchObject({ status: 'completed', quoteReview: { status: 'approved' }, nextAction: '已进入采购履约', selectedSupplierIds: ['s1'], quoteOffers: [expect.objectContaining({ lineItemId: 'new-line', productUnitPrice: '12', selected: true, selectionReason: '样品通过' })] });
  });
});
