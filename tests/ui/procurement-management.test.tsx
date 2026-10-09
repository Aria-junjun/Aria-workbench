// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProcurementOverview } from '@/components/workbench/procurement-overview';
import { newProcurementRecord, loadProcurementRecords, saveProcurementRecords } from '@/features/workbench/procurement';
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <a {...props}>{children}</a> }));
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it('在现有总览补充管理信息，刷新保留，人员视图可追溯项目', () => {
  saveProcurementRecords([{ ...newProcurementRecord('task'), title: '原项目', owner: '执行甲' }]);
  const view = render(<ProcurementOverview />);
  fireEvent.click(screen.getByRole('button', { name: '管理信息' }));
  fireEvent.change(screen.getByLabelText('项目组'), { target: { value: '家清组' } });
  fireEvent.change(screen.getByLabelText('运营对接人'), { target: { value: '运营乙' } });
  fireEvent.change(screen.getByLabelText('阻塞原因'), { target: { value: '等待规格确认' } });
  fireEvent.click(screen.getByRole('button', { name: '保存管理信息' }));
  expect(screen.getByRole('status').textContent).toContain('已保存');
  expect(loadProcurementRecords()[0].management?.team).toBe('家清组');
  expect(loadProcurementRecords()[0].title).toBe('原项目');
  view.unmount(); render(<ProcurementOverview />);
  expect(screen.getAllByText('家清组').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: '执行人台账' }));
  expect(screen.getByRole('button', { name: '查看执行甲的项目' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '查看执行甲的项目' }));
  expect((screen.getByRole('combobox', { name: '执行人' }) as HTMLSelectElement).value).toBe('执行甲');
});

it('保存失败保留输入，不提示成功、不污染已保存数据', () => {
  saveProcurementRecords([{ ...newProcurementRecord('task'), title: '原项目' }]);
  render(<ProcurementOverview />);
  fireEvent.click(screen.getByRole('button', { name: '管理信息' }));
  fireEvent.change(screen.getByLabelText('项目组'), { target: { value: '未保存组' } });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('存储空间不足'); });
  fireEvent.click(screen.getByRole('button', { name: '保存管理信息' }));
  expect(screen.getByRole('alert').textContent).toContain('存储空间不足');
  expect((screen.getByLabelText('项目组') as HTMLInputElement).value).toBe('未保存组');
  expect(loadProcurementRecords()[0].management).toBeUndefined();
});
