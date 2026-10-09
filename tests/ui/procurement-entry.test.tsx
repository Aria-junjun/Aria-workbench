// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProcurementWorkspace } from '@/components/workbench/procurement-workspace';
import { ProcurementOverview } from '@/components/workbench/procurement-overview';
import { newProcurementRecord, saveProcurementRecords, loadProcurementRecords } from '@/features/workbench/procurement';
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <a {...props}>{children}</a> }));
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it('直接入池保留真实来源，刷新后仍可承接', () => {
  const view = render(<ProcurementWorkspace section="pool" />);
  fireEvent.click(screen.getByRole('button', { name: '直接新建需求' }));
  expect(screen.getByLabelText('项目组')).toBeTruthy();
  expect(screen.getByLabelText('运营对接人')).toBeTruthy();
  expect(screen.getByLabelText('项目交付期限')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('需求标题'), { target: { value: '临时补货' } });
  fireEvent.change(screen.getByLabelText('第1行产品名称'), { target: { value: '刷子' } });
  fireEvent.change(screen.getByLabelText('需求来源 *'), { target: { value: '领导加派' } });
  fireEvent.change(screen.getByLabelText('来源说明 *'), { target: { value: '周会补货安排' } });
  fireEvent.change(screen.getByLabelText('提出人'), { target: { value: '负责人甲' } });
  fireEvent.change(screen.getByLabelText('负责人'), { target: { value: '采购乙' } });
  fireEvent.change(screen.getByLabelText('服务平台'), { target: { value: '抖音' } });
  fireEvent.change(screen.getByLabelText('运营对接人'), { target: { value: '运营甲' } });
  fireEvent.change(screen.getByLabelText('验收人'), { target: { value: '主管丙' } });
  fireEvent.change(screen.getByLabelText('项目交付期限'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('交付要求 / 验收标准'), { target: { value: '提供有效询价方案' } });
  fireEvent.change(screen.getByLabelText('第1行规格型号'), { target: { value: '标准款' } });
  fireEvent.change(screen.getByLabelText('第1行单位'), { target: { value: '个' } });
  fireEvent.change(screen.getByLabelText('第1行数量'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('第1行期望到货'), { target: { value: '2026-10-10' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(loadProcurementRecords()[0].section).toBe('pool');
  view.unmount();
  render(<ProcurementWorkspace section="pool" />);
  fireEvent.click(screen.getByRole('button', { name: '承接为任务' }));
  const records = loadProcurementRecords();
  expect(records.find(item => item.section === 'task')?.sourceNote).toBe('周会补货安排');
  expect(records.some(item => item.section === 'request')).toBe(false);
});

it('履约删除须确认，取消不改数据，确认只删草稿', () => {
  saveProcurementRecords([{ ...newProcurementRecord('fulfillment'), title: '多余草稿' }]);
  render(<ProcurementWorkspace section="fulfillment" />);
  expect(screen.getByRole('combobox', { name: '业务路径' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(loadProcurementRecords()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  expect(loadProcurementRecords()).toHaveLength(0);
  expect(screen.getByRole('status').textContent).toContain('已删除');
});

it('采购总览使用采购入口且项目不重复计数', () => {
  const request = { ...newProcurementRecord('request'), title: '采购A' };
  const task = { ...newProcurementRecord('task'), title: '采购A任务', sourceId: request.id };
  saveProcurementRecords([request, task]);
  render(<ProcurementOverview />);
  expect(screen.getByText('采购项目').parentElement?.textContent).toBe('采购项目1');
  expect(screen.getAllByRole('link').every(link => link.getAttribute('href')?.startsWith('/procurement/'))).toBe(true);
});

it('缺少必填业务信息时阻止任务直接发起询价', () => {
  const task = { ...newProcurementRecord('task'), title: '信息不完整的任务', productName: '刷子', status: 'accepted' as const };
  saveProcurementRecords([task]);
  render(<ProcurementWorkspace section="task" />);
  fireEvent.click(screen.getByRole('button', { name: '发起询价' }));
  expect(screen.getByRole('dialog').textContent).toContain('暂不能发起询价');
  expect(screen.getByText('负责人')).toBeTruthy();
  expect(screen.getByRole('dialog').textContent).toContain('寻源渠道');
  expect(screen.getByRole('dialog').textContent).toContain('目标有效报价数');
  expect(loadProcurementRecords().some(item => item.section === 'quote')).toBe(false);
  expect(screen.getByRole('button', { name: '补充信息' })).toBeTruthy();
});
