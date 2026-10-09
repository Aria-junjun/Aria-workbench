import { normalizeLineItems, procurementSourceChain, type ProcurementRecord } from './procurement';

export type ProcurementTransition = 'submit' | 'accept' | 'quote';

export function transitionRequirements(records: ProcurementRecord[], record: ProcurementRecord, transition: ProcurementTransition) {
  const missing: string[] = [];
  const management = procurementSourceChain(records, record)[0]?.management || record.management || {};
  if (!record.title.trim()) missing.push('需求 / 任务名称');
  if (!record.requester?.trim()) missing.push('提出人');
  if ((transition === 'accept' || transition === 'quote') && !record.owner?.trim()) missing.push('负责人');
  if (!management.platform?.trim()) missing.push('服务平台');
  if (!management.operator?.trim()) missing.push('运营对接人');
  if (!management.reviewer?.trim()) missing.push('验收人');
  if (!management.deadline?.trim()) missing.push('项目交付期限');
  if (!management.criteria?.trim()) missing.push('交付要求 / 验收标准');
  normalizeLineItems(record).forEach((line, index) => {
    const prefix = `第${index + 1}行`;
    if (!line.productName.trim()) missing.push(`${prefix}产品名称`);
    if (!line.quantity?.trim()) missing.push(`${prefix}数量`);
    if (!line.unit?.trim()) missing.push(`${prefix}单位`);
    if (!line.expectedDate?.trim()) missing.push(`${prefix}期望到货日期`);
    if (transition === 'quote' && !line.specification?.trim() && !line.requirements?.trim() && !line.referenceUrl?.trim()) missing.push(`${prefix}采购依据（规格、要求或参考链接至少填写一项）`);
  });
  if (transition === 'quote') {
    if (!record.taskExecution?.channels?.trim()) missing.push('寻源渠道');
    if (!record.taskExecution?.targetQuoteCount?.trim()) missing.push('目标有效报价数');
    if (!record.taskExecution?.plannedQuoteDate?.trim()) missing.push('计划提交询价方案日期');
    if (!record.taskExecution?.strategy?.trim()) missing.push('寻源重点 / 分工说明');
  }
  return missing;
}
