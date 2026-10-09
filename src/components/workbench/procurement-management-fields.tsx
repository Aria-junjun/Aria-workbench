import React from 'react';
import type { ProjectManagement } from '@/features/workbench/procurement-management';
import { businessInput } from './business-record-dialog';

export function ProcurementManagementFields({ value, onChange }: { value: ProjectManagement; onChange: (value: ProjectManagement) => void }) {
  const fields: Array<[keyof ProjectManagement, string]> = [['projectName', '项目名称'], ['team', '项目组'], ['platform', '服务平台'], ['operator', '运营对接人'], ['reviewer', '验收人'], ['deadline', '项目交付期限']];
  return <div className="grid gap-4 text-sm sm:grid-cols-2">{fields.map(([key, label]) => <label key={key}>{label}<input className={businessInput} type={key === 'deadline' ? 'date' : 'text'} value={value[key] || ''} onChange={e => onChange({ ...value, [key]: e.target.value })} /></label>)}<label className="sm:col-span-2">交付要求 / 验收标准<textarea rows={3} className={businessInput} value={value.criteria || ''} onChange={e => onChange({ ...value, criteria: e.target.value })} /></label><label>阻塞原因<input className={businessInput} value={value.blockedReason || ''} onChange={e => onChange({ ...value, blockedReason: e.target.value })} placeholder="没有阻塞可留空；解除后清空" /></label><label>等待谁处理<input className={businessInput} value={value.waitingFor || ''} onChange={e => onChange({ ...value, waitingFor: e.target.value })} /></label></div>;
}
