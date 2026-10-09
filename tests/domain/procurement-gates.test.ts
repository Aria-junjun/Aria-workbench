import { expect, it } from 'vitest';
import { newProcurementRecord } from '../../src/features/workbench/procurement';
import { transitionRequirements } from '../../src/features/workbench/procurement-gates';

it('空任务不能发起询价，并明确列出缺失项', () => {
  const task = { ...newProcurementRecord('task'), title: '新品寻源', requester: '运营甲', owner: '采购乙', lineItems: [{ id: 'l1', productName: '收纳盒' }] };
  const missing = transitionRequirements([task], task, 'quote');
  expect(missing).toEqual(expect.arrayContaining(['服务平台', '运营对接人', '验收人', '项目交付期限', '交付要求 / 验收标准', '第1行数量', '第1行单位', '第1行期望到货日期', '第1行采购依据（规格、要求或参考链接至少填写一项）']));
});

it('信息完整后允许流转，子任务读取根项目管理信息', () => {
  const root = { ...newProcurementRecord('request'), title: '新品寻源', requester: '运营甲', management: { platform: '抖音', operator: '运营甲', reviewer: '主管丙', deadline: '2026-10-01', criteria: '提供三家有效报价' } };
  const task = { ...newProcurementRecord('task'), sourceId: root.id, title: root.title, requester: root.requester, owner: '采购乙', lineItems: [{ id: 'l1', productName: '收纳盒', quantity: '100', unit: '个', expectedDate: '2026-10-10', requirements: 'PP材质，带盖' }] };
  expect(transitionRequirements([root, task], task, 'quote')).toEqual(expect.arrayContaining(['寻源渠道', '目标有效报价数', '计划提交询价方案日期', '寻源重点 / 分工说明']));
  const ready = { ...task, taskExecution: { channels: '1688、线下工厂', targetQuoteCount: '3', plannedQuoteDate: '2026-09-28', strategy: '先工厂后贸易商' } };
  expect(transitionRequirements([root, ready], ready, 'quote')).toEqual([]);
  expect(transitionRequirements([root, task], root, 'submit')).toEqual(expect.arrayContaining(['第1行产品名称', '第1行数量']));
});
