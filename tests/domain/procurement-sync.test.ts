import { expect, it } from 'vitest';
import { newProcurementRecord } from '../../src/features/workbench/procurement';
import { hasSharedProcurementChanges, repairProcurementSourceSnapshots, syncProcurementSourceUpdate } from '../../src/features/workbench/procurement-sync';

it('需求更新同步到任务和询价，同时保留任务执行与报价事实', () => {
  const root = { ...newProcurementRecord('request'), id: 'r', title: '旧需求', lineItems: [{ id: 'l', productName: '旧产品' }] };
  const task = { ...newProcurementRecord('task'), id: 't', sourceId: 'r', title: '旧需求', owner: '采购甲', taskExecution: { channels: '1688', targetQuoteCount: '3', plannedQuoteDate: '2026-10-01', strategy: '工厂优先' }, lineItems: root.lineItems };
  const quote = { ...newProcurementRecord('quote'), id: 'q', sourceId: 't', title: '旧需求 · 询价项目', status: 'completed' as const, quoteOffers: [{ id: 'o', supplierCandidateId: 's', lineItemId: 'l', productUnitPrice: '10' }], lineItems: root.lineItems };
  const updated = { ...root, title: '新需求', lineItems: [{ id: 'l', productName: '新产品', quantity: '20', unit: '件', expectedDate: '2026-10-10', requirements: '耐磨' }] };
  const result = syncProcurementSourceUpdate([root, task, quote], updated);
  expect(result.find(item => item.id === 't')).toMatchObject({ title: '新需求', owner: '采购甲', taskExecution: task.taskExecution, productName: '新产品' });
  expect(result.find(item => item.id === 'q')).toMatchObject({ title: '新需求 · 询价项目', status: 'draft', nextAction: '上游需求已变更，请复核报价', quoteOffers: quote.quoteOffers, productName: '新产品' });
});

it('旧数据加载时把需求要求修复到未锁定任务，不覆盖履约事实', () => {
  const root = { ...newProcurementRecord('request'), id: 'r', title: '新标题', lineItems: [{ id: 'l', productName: '新品', requirements: '新要求' }] };
  const task = { ...newProcurementRecord('task'), id: 't', sourceId: 'r', title: '旧标题', lineItems: [{ id: 'l', productName: '旧品' }] };
  const repaired = repairProcurementSourceSnapshots([root, task]);
  expect(repaired.find(item => item.id === 't')).toMatchObject({ title: '新标题', productName: '新品', lineItems: root.lineItems });
  expect(repairProcurementSourceSnapshots(repaired)).toEqual(repaired);
});

it('只修改任务执行计划不触发下游需求重置', () => {
  const before = { ...newProcurementRecord('task'), title: '任务', productName: '产品' };
  expect(hasSharedProcurementChanges(before, { ...before, taskExecution: { channels: '1688' } })).toBe(false);
  expect(hasSharedProcurementChanges(before, { ...before, productName: '新产品' })).toBe(true);
});

it('已产生履约事实的单据不被上游修改覆盖', () => {
  const root = { ...newProcurementRecord('request'), id: 'r', title: '旧需求' };
  const fulfillment = { ...newProcurementRecord('fulfillment'), id: 'f', sourceId: 'r', productName: '已下单产品', fulfillment: { mode: 'warehouse' as const, orderNo: 'PO1', orderDate: '2026-09-01', owner: '甲', settlement: '现结' as const, settlementTerms: '', sourcePlatform: '手工登记', originalOrderNo: '', importBatch: '', destination: '仓库', lines: [], events: [] } };
  const result = syncProcurementSourceUpdate([root, fulfillment], { ...root, productName: '新产品' });
  expect(result.find(item => item.id === 'f')?.productName).toBe('已下单产品');
});

it('已有履约子单的询价结果不会被上游同步退回草稿', () => {
  const root = { ...newProcurementRecord('request'), id: 'r-lock', title: '旧需求' };
  const quote = { ...newProcurementRecord('quote'), id: 'q-lock', sourceId: root.id, title: '已确认询价', status: 'completed' as const, quoteReview: { status: 'approved' as const, reviewer: '运营甲' } };
  const fulfillment = { ...newProcurementRecord('fulfillment'), id: 'f-lock', sourceId: quote.id };
  const result = syncProcurementSourceUpdate([root, quote, fulfillment], { ...root, title: '新需求' });
  expect(result.find(item => item.id === quote.id)).toMatchObject({ title: '已确认询价', status: 'completed', quoteReview: { status: 'approved' } });
});
