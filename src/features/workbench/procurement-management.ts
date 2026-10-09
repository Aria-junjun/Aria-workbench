import { procurementSourceChain, type ProcurementRecord } from './procurement';

export type ProjectManagement = {
  projectName?: string; team?: string; platform?: string; operator?: string;
  reviewer?: string; deadline?: string; criteria?: string; blockedReason?: string; waitingFor?: string;
};

export function updateProjectManagement(records: ProcurementRecord[], recordId: string, management: ProjectManagement) {
  const record = records.find(item => item.id === recordId);
  if (!record) throw new Error('记录不存在，请刷新后重试');
  const root = procurementSourceChain(records, record)[0];
  if (management.deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(management.deadline) || !Number.isFinite(Date.parse(management.deadline)))) throw new Error('请填写有效的交付期限');
  return records.map(item => item.id === root.id ? { ...item, management: { ...management } } : item);
}

export function managementProjects(records: ProcurementRecord[], today: string) {
  const groups = new Map<string, ProcurementRecord[]>();
  for (const record of records) {
    const root = procurementSourceChain(records, record)[0];
    groups.set(root.id, [...(groups.get(root.id) || []), record]);
  }
  return [...groups.entries()].map(([id, items]) => {
    const root = items.find(item => item.id === id)!;
    const management = root.management || {};
    const leaves = items.filter(item => !items.some(child => child.sourceId === item.id));
    const closed = leaves.every(item => item.status === 'cancelled' || (item.section === 'fulfillment' && item.fulfillmentStage === '已完成'));
    const current = leaves.filter(item => item.status !== 'cancelled');
    const owners = [...new Set(current.map(item => {
      const owner = [...procurementSourceChain(records, item)].reverse().find(value => value.fulfillment?.owner?.trim() || value.owner?.trim());
      return (owner?.fulfillment?.owner || owner?.owner || '').trim() || '待分配';
    }))];
    return { id, root, items, current, owners, management, closed, name: management.projectName?.trim() || root.title || '未命名项目', overdue: !closed && !!management.deadline && management.deadline < today };
  });
}

export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
