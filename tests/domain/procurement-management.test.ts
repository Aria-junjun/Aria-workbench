import { expect, it } from 'vitest';
import { newProcurementRecord, createQuoteProject, acceptProcurementRequest } from '../../src/features/workbench/procurement';
import { managementProjects, updateProjectManagement } from '../../src/features/workbench/procurement-management';

it('按来源合并项目，报价完成不意味着项目结案', () => {
  const root = { ...newProcurementRecord('request'), title: '找货A', owner: '甲' };
  let records = acceptProcurementRequest([root], root.id);
  records = createQuoteProject(records, records.find(item => item.section === 'task')!.id);
  records = records.map(item => item.section === 'quote' ? { ...item, status: 'completed' as const } : item);
  records = updateProjectManagement(records, records[0].id, { team: '一组', deadline: '2026-09-20', blockedReason: '待运营确认', waitingFor: '运营乙' });
  const projects = managementProjects(records, '2026-09-22');
  expect(projects).toHaveLength(1);
  expect(projects[0]).toMatchObject({ id: root.id, overdue: true, closed: false, owners: ['甲'], management: { team: '一组' } });
  expect(records.find(item => item.id === root.id)?.title).toBe('找货A');
  expect(records.find(item => item.section === 'quote')?.status).toBe('completed');
});

it('同名项目不合并，旧字段保持不变，清空信息生效', () => {
  const a = { ...newProcurementRecord('task'), title: '同名', quantity: '100' };
  const b = { ...newProcurementRecord('task'), title: '同名' };
  const records = updateProjectManagement([a, b], a.id, { team: '一组', deadline: '' });
  const projects = managementProjects(records, '2026-09-22');
  expect(projects).toHaveLength(2);
  expect(projects.every(item => !item.overdue)).toBe(true);
  expect(records[0].quantity).toBe('100');
  expect(records[1]).toBe(b);
  expect(() => updateProjectManagement(records, 'missing', {})).toThrow();
});

it('已完成履约不算超期，取消的分支不掩盖尚未完成的其他分支', () => {
  const root = newProcurementRecord('task');
  const a = { ...newProcurementRecord('fulfillment'), sourceId: root.id, fulfillmentStage: '已完成' as const };
  const records = updateProjectManagement([root, a], root.id, { deadline: '2026-09-01' });
  expect(managementProjects(records, '2026-09-22')[0]).toMatchObject({ closed: true, overdue: false });
  const b = { ...newProcurementRecord('quote'), sourceId: root.id };
  expect(managementProjects([...records, b], '2026-09-22')[0].closed).toBe(false);
});
