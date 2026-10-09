// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ProcurementWorkspace } from '@/components/workbench/procurement-workspace';
import { loadProcurementRecords, newProcurementRecord, saveProcurementRecords } from '@/features/workbench/procurement';
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <a {...props}>{children}</a> }));
afterEach(() => { cleanup(); localStorage.clear(); });
it('persists candidate reasons, procurement requirements and SKU-specific links after reopening', () => {
  const quote = { ...newProcurementRecord('quote'), id: 'quote-details', title: '多产品询价', productName: '清洁刷', lineItems: [{ id: 'brush', productName: '清洁刷' }, { id: 'head', productName: '替换刷头' }], supplierCandidates: [{ id: 'supplier-a', name: '供应商甲', source: 'new' as const, status: 'candidate' as const }], quoteOffers: [{ id: 'offer-a', supplierCandidateId: 'supplier-a', lineItemId: 'brush', productUnitPrice: '3.2' }] };
  saveProcurementRecords([quote]);
  const view = render(<ProcurementWorkspace section="quote" />);
  fireEvent.click(screen.getByRole('button', { name: '打开项目' }));
  fireEvent.click(screen.getByRole('button', { name: /^编辑$/ }));
  fireEvent.change(screen.getByLabelText('候选原因 *'), { target: { value: '可提供加长规格，样品已沟通' } });
  fireEvent.click(screen.getByRole('button', { name: '保存供应商' }));
  expect(loadProcurementRecords()[0].quoteOffers?.[0].id).toBe('offer-a');
  fireEvent.click(screen.getAllByRole('button', { name: '编辑要求' })[0]);
  fireEvent.change(screen.getByLabelText('关键要求 / 验收标准'), { target: { value: '杆长 115cm，独立包装' } });
  fireEvent.change(screen.getByLabelText('产品属性'), { target: { value: '新产品' } });
  fireEvent.click(screen.getByRole('button', { name: '保存要求' }));
  fireEvent.click(screen.getByRole('button', { name: '编辑报价' }));
  fireEvent.change(screen.getByLabelText('供应商商品链接'), { target: { value: 'https://example.com/brush' } });
  fireEvent.click(screen.getByRole('button', { name: '保存报价' }));
  view.unmount();
  render(<ProcurementWorkspace section="quote" />);
  fireEvent.click(screen.getByRole('button', { name: '打开项目' }));
  expect(screen.getByText('可提供加长规格，样品已沟通')).toBeTruthy();
  expect(screen.getByText('关键要求：杆长 115cm，独立包装')).toBeTruthy();
  expect(screen.getByRole('link', { name: '供应商商品 ↗' }).getAttribute('href')).toBe('https://example.com/brush');
  expect(loadProcurementRecords()[0].quoteOffers).toHaveLength(1);
  expect(screen.getByRole('button', { name: '录入报价' })).toBeTruthy();
});

it('requires a selection reason and a decision for every SKU before finalizing', () => {
  saveProcurementRecords([{ ...newProcurementRecord('quote'), title: '两产品采购', productName: '产品', lineItems: [{ id: 'a', productName: '产品 A' }, { id: 'b', productName: '产品 B' }], supplierCandidates: [{ id: 's', name: '供应商', source: 'new', status: 'candidate' }], quoteOffers: [{ id: 'o', lineItemId: 'a', supplierCandidateId: 's', unitPrice: '10' }] }]);
  render(<ProcurementWorkspace section="quote" />);
  fireEvent.click(screen.getByRole('button', { name: '打开项目' }));
  const comparison = screen.getByRole('region', { name: '产品 A对比' });
  expect(within(within(comparison).getByRole('table')).queryByText(/最终选用/)).toBeNull();
  fireEvent.click(within(comparison).getByRole('button', { name: '确定选用' }));
  fireEvent.change(screen.getByLabelText('最终选用供应商'), { target: { value: 's' } });
  fireEvent.click(screen.getByRole('button', { name: '保存选用' }));
  expect(screen.getByRole('alert').textContent).toContain('选用原因');
  fireEvent.change(screen.getByLabelText('选用原因 *'), { target: { value: '交期满足需求' } });
  fireEvent.click(screen.getByRole('button', { name: '保存选用' }));
  expect(within(comparison).getByText('最终选用：供应商')).toBeTruthy();
  expect(within(comparison).getByText('交期满足需求')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '形成当前比价结果' }));
  expect(screen.getByRole('alert').textContent).toContain('每个 SKU');
  expect(loadProcurementRecords()[0].status).not.toBe('completed');
});
it('opens a read-only procurement dialog before editing and persists changes', () => {
  saveProcurementRecords([{ ...newProcurementRecord('request'), title: '白板贴补货', productName: '白板贴' }]);
  render(<ProcurementWorkspace section="request" />);
  fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
  const detail = screen.getByRole('dialog');
  expect(within(detail).queryByRole('textbox')).toBeNull();
  fireEvent.click(within(detail).getByRole('button', { name: '编辑' }));
  fireEvent.change(screen.getByLabelText('需求标题'), { target: { value: '白板贴补货第二版' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(screen.getAllByText('白板贴补货第二版').length).toBeGreaterThan(0);
});
it('closes the active window when changing procurement sections', () => {
  const view = render(<ProcurementWorkspace section="request" />);
  fireEvent.click(screen.getByRole('button', { name: '新建需求' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  view.rerender(<ProcurementWorkspace section="task" />);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('shows inquiry projects as a list first and opens details only after selecting a project', async () => {
  const task = { ...newProcurementRecord('task'), id: 'task-1', title: '已发起的采购任务', productName: '白板贴' };
  const notStartedTask = { ...newProcurementRecord('task'), id: 'task-2', title: '尚未发起询价的任务', productName: '马克笔' };
  const quote = { ...newProcurementRecord('quote'), id: 'quote-1', title: '白板贴询价项目', productName: '白板贴', sourceId: task.id };
  saveProcurementRecords([quote, task, notStartedTask]);

  render(<ProcurementWorkspace section="quote" />);

  expect(screen.getByRole('heading', { name: '询价项目' })).toBeTruthy();
  expect(screen.getByText('已发起的采购任务 · 询价项目')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '本次采购明细' })).toBeNull();
  expect(screen.queryByText('尚未发起询价的任务')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: '打开项目' }));
  expect(await screen.findByRole('heading', { name: '本次采购明细' })).toBeTruthy();
});
