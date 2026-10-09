import React from 'react';
import type { ProcurementTaskExecution } from '@/features/workbench/procurement';
import { businessInput } from './business-record-dialog';

export function ProcurementTaskExecutionFields({ value, onChange }: { value: ProcurementTaskExecution; onChange: (value: ProcurementTaskExecution) => void }) {
  return <div className="grid gap-4 text-sm sm:grid-cols-2"><label>寻源渠道 *<input className={businessInput} value={value.channels || ''} onChange={e => onChange({ ...value, channels: e.target.value })} placeholder="如1688、线下工厂、历史供应商" /></label><label>目标有效报价数 *<input className={businessInput} type="number" min="1" value={value.targetQuoteCount || ''} onChange={e => onChange({ ...value, targetQuoteCount: e.target.value })} /></label><label>计划提交询价方案日期 *<input className={businessInput} type="date" value={value.plannedQuoteDate || ''} onChange={e => onChange({ ...value, plannedQuoteDate: e.target.value })} /></label><label>寻源重点 / 分工说明 *<input className={businessInput} value={value.strategy || ''} onChange={e => onChange({ ...value, strategy: e.target.value })} placeholder="如工厂优先，重点核实材质与起订量" /></label></div>;
}
