// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ProcurementWorkspace } from '@/components/workbench/procurement-workspace';
import { newProcurementRecord, saveProcurementRecords, loadProcurementRecords } from '@/features/workbench/procurement';
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <a {...props}>{children}</a> }));
afterEach(() => { vi.restoreAllMocks(); cleanup(); localStorage.clear(); window.history.pushState({}, '', '/'); });

it('expands a procurement summary into per-SKU quantities and exception facts', () => {
  saveProcurementRecords([{ ...newProcurementRecord('fulfillment'), id: 'expand-1', title: '批次A采购', productName: '毛毡板', lineItems: [{ id: 'line-a', productName: '毛毡板', quantity: '10' }], fulfillment: { mode: 'warehouse', orderNo: 'PO-EXPAND', orderDate: '2026-09-01', owner: '采购甲', settlement: '月结', settlementTerms: '', sourcePlatform: '工作台', originalOrderNo: '', importBatch: '', destination: '杭州仓', lines: [{ lineId: 'line-a', supplierId: 'supplier-a', supplierName: '甲厂', quantity: 10, promisedArrivalDate: '2026-09-10' }], events: [{ id: 'ship-a', kind: 'shipment', date: '2026-09-08', operator: '采购甲', lineId: 'line-a', quantity: 6, carrier: '承运商', trackingNo: 'T-01', note: '', recordedAt: '' }, { id: 'issue-a', kind: 'issue', date: '2026-09-09', operator: '采购甲', lineId: 'line-a', issueType: '质量', responsibility: '待核实', note: '边角破损', recordedAt: '' }] } }]);
  render(<ProcurementWorkspace section="fulfillment" />);
  fireEvent.click(screen.getByRole('button', { name: '展开明细：批次A采购' }));
  expect(screen.getByRole('table', { name: '采购单 SKU 明细：批次A采购' })).toBeTruthy();
  expect(screen.getByText('未交 10')).toBeTruthy();
  expect(screen.getByText('2026-09-10')).toBeTruthy();
  expect(screen.getByText('1 项未关闭异常')).toBeTruthy();
});

it('opens and focuses the requested fulfillment exception from a deep link', async () => {
  saveProcurementRecords([{ ...newProcurementRecord('fulfillment'), id: 'deep-1', title: '深链采购单', productName: '毛毡板', lineItems: [{ id: 'line-deep', productName: '毛毡板', quantity: '2' }], fulfillment: { mode: 'warehouse', orderNo: 'PO-DEEP', orderDate: '2026-09-01', owner: '采购甲', settlement: '现结', settlementTerms: '', sourcePlatform: '工作台', originalOrderNo: '', importBatch: '', destination: '杭州仓', lines: [{ lineId: 'line-deep', supplierId: 'supplier-a', supplierName: '甲厂', quantity: 2 }], events: [{ id: 'issue-deep', kind: 'issue', date: '2026-09-02', operator: '采购甲', lineId: 'line-deep', issueType: '质量', responsibility: '供应商', note: '指定异常内容', recordedAt: '' }] } }]);
  window.history.pushState({}, '', '/procurement/fulfillment?recordId=deep-1&eventId=issue-deep');
  render(<ProcurementWorkspace section="fulfillment" />);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading', { name: '深链采购单' })).toBeTruthy();
  const event = document.getElementById('fulfillment-event-issue-deep');
  expect(event?.textContent).toContain('指定异常内容');
  expect(event?.className).toContain('ring-action');
});

it('replaces state jumping with a persistent order and shipment workflow', () => {
  saveProcurementRecords([{ ...newProcurementRecord('fulfillment'), id: 'f', title: '清洁刷履约', productName: '清洁刷', fulfillmentStage: '已下单', lineItems: [{ id: 'l', productName: '清洁刷', quantity: '10' }], supplierCandidates: [{ id: 's', name: '供应商甲', source: 'new', status: 'candidate' }] }]);
  const view = render(<ProcurementWorkspace section="fulfillment" />);
  expect(screen.queryByRole('button', { name: '进入已发货' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '办理履约' }));
  fireEvent.change(screen.getByLabelText('业务路径 *'), { target: { value: 'warehouse' } });
  fireEvent.change(screen.getByLabelText('采购单号 / 代发关联单号 *'), { target: { value: 'PO-100' } });
  fireEvent.change(screen.getByLabelText('下单日期 *'), { target: { value: '2026-09-01' } });
  fireEvent.change(screen.getByLabelText('负责人 *'), { target: { value: '采购员' } });
  fireEvent.change(screen.getByLabelText('收货地点 / 仓库 *'), { target: { value: '杭州仓' } });
  fireEvent.change(screen.getByLabelText('数据来源 *'), { target: { value: '手工登记' } });
  fireEvent.change(screen.getByLabelText('第1行供应商'), { target: { value: 's' } });
  fireEvent.change(screen.getByLabelText('第1行供应商承诺到货日期'), { target: { value: '2026-09-10' } });
  fireEvent.click(screen.getByRole('button', { name: '确认采购单与业务路径' }));
  expect(loadProcurementRecords()[0].fulfillment?.lines[0].promisedArrivalDate).toBe('2026-09-10');
  fireEvent.click(screen.getByRole('button', { name: '登记发货' }));
  fireEvent.click(screen.getByRole('button', { name: '保存业务记录' }));
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('业务日期 *'), { target: { value: '2026-09-02' } });
  fireEvent.change(screen.getByLabelText('本次发货数量 *'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('物流公司 / 运输方式 *'), { target: { value: '顺丰' } });
  fireEvent.change(screen.getByLabelText('物流单号 / 发货凭证号 *'), { target: { value: 'SF123' } });
  const storageFailure = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('本机存储空间不足'); });
  fireEvent.click(screen.getByRole('button', { name: '保存业务记录' }));
  expect(screen.getByRole('alert').textContent).toContain('未保存');
  expect(screen.queryByRole('status')).toBeNull();
  expect((screen.getByLabelText('物流单号 / 发货凭证号 *') as HTMLInputElement).value).toBe('SF123');
  expect(loadProcurementRecords()[0].fulfillment?.events).toHaveLength(0);
  storageFailure.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: '保存业务记录' }));
  expect(loadProcurementRecords()[0].fulfillment?.events).toHaveLength(1);
  expect(screen.getByRole('status').textContent).toContain('登记发货本地已保存');
  expect(screen.getByRole('status').textContent).toContain('本地已保存');
  expect(screen.getByRole('button', { name: '登记收货与验收' })).toBeTruthy();
  view.unmount();
  render(<ProcurementWorkspace section="fulfillment" />);
  expect(screen.getByRole('cell', { name: '部分发货' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '办理履约' }));
  expect(within(screen.getByRole('dialog')).getByText(/SF123/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '登记收货与验收' }));
  expect(screen.getByLabelText('对应发货批次 *')).toBeTruthy();
});

it('shows operators the required source facts and result formulas on the execution page', () => {
  saveProcurementRecords([{ ...newProcurementRecord('fulfillment'), id: 'guide', title: '入仓履约', productName: '毛毡板' }]);
  render(<ProcurementWorkspace section="fulfillment" />);
  expect(screen.getByText('执行数据要求')).toBeTruthy();
  expect(screen.getByText(/未交数量 = 订购数量 − 累计实收数量/)).toBeTruthy();
  expect(screen.getByText(/没有实际异常时不必补造异常记录/)).toBeTruthy();
});

it('registers a verified extra cost against an open procurement exception with a settlement-inclusion decision', () => {
  saveProcurementRecords([{ ...newProcurementRecord('fulfillment'), id: 'f-cost', title: '补发异常履约', productName: '清洁刷', fulfillmentStage: '异常', lineItems: [{ id: 'l', productName: '清洁刷', quantity: '10' }], fulfillment: { mode: 'warehouse', orderNo: 'PO-COST', orderDate: '2026-09-01', owner: '采购员', settlement: '现结', settlementTerms: '', sourcePlatform: 'ERP', originalOrderNo: '', importBatch: '', destination: '杭州仓', lines: [{ lineId: 'l', supplierId: 'supplier-1', supplierName: '供应商甲', quantity: 10 }], events: [{ id: 'issue-1', kind: 'issue', lineId: 'l', date: '2026-09-02', operator: '采购员', issueType: '质量', responsibility: '供应商', note: '外观破损需补发', evidence: 'QC-01', recordedAt: '' }] } }]);
  render(<ProcurementWorkspace section="fulfillment" />);
  fireEvent.click(screen.getByRole('button', { name: '办理履约' }));
  fireEvent.click(screen.getByRole('button', { name: '登记异常增量费用' }));
  fireEvent.change(screen.getByLabelText('业务日期 *'), { target: { value: '2026-09-03' } });
  fireEvent.change(screen.getByLabelText('关联未关闭异常 *'), { target: { value: 'issue-1' } });
  fireEvent.change(screen.getByLabelText('费用类型 *'), { target: { value: '加急物流' } });
  fireEvent.change(screen.getByLabelText('增量费用（元）*'), { target: { value: '45' } });
  fireEvent.change(screen.getByLabelText('核实状态 *'), { target: { value: 'verified' } });
  fireEvent.change(screen.getByLabelText('是否已计入采购结算 *'), { target: { value: 'false' } });
  fireEvent.change(screen.getByLabelText('费用说明 *'), { target: { value: '异常补发加急运费' } });
  fireEvent.change(screen.getByLabelText('费用凭证 *'), { target: { value: 'SF-45账单' } });
  fireEvent.click(screen.getByRole('button', { name: '保存业务记录' }));
  expect(loadProcurementRecords().find(record => record.id === 'f-cost')?.fulfillment?.events.at(-1)).toMatchObject({ kind: 'cost_impact', relatedEventId: 'issue-1', extraCostAmount: 45, includedInSettlement: false, costVerificationStatus: 'verified' });
  expect(screen.getByRole('status').textContent).toContain('登记异常增量费用本地已保存');
});
