import { expect, it } from 'vitest';
import { newBusinessRecord, validateBusinessRecord, comparisonRows, businessKind, inspectionChecks } from '@/features/workbench/supplier-business';

it('keeps sample and inspection as distinct linked records', () => {
  const sample = newBusinessRecord('sample', 'a'); sample.id = 'sample1'; sample.productScope = '白板'; sample.fields.specification = 'V1';
  const inspection = newBusinessRecord('inspection', 'b'); inspection.productScope = '白板'; inspection.fields.sampleId = sample.id;
  expect(() => validateBusinessRecord(inspection, [sample])).toThrow(/供应商/);
  inspection.supplierIds = ['a'];
  expect(() => validateBusinessRecord(inspection, [sample])).not.toThrow();
  expect(businessKind(sample)).toBe('sample');
});
it('requires standards, actual results and evidence for completed inspections', () => {
  const sample = newBusinessRecord('sample', 'a'); sample.id = 's'; sample.productScope = '白板'; sample.fields.specification = 'V1'; sample.fields.stage = 'received';
  const record = newBusinessRecord('inspection', 'a'); record.productScope = '白板'; record.fields.sampleId = 's'; record.fields.stage = 'complete'; record.status = 'completed';
  expect(() => validateBusinessRecord(record, [sample])).toThrow();
  record.fields.date = '2026-09-21'; record.owner = '检验员';
  record.fields.checks = JSON.stringify([{ name: '擦除', method: '水笔24小时后擦除', standard: '无可见残留', actual: '有残留', verdict: 'fail' }]);
  record.fields.evidenceNote = '现场检验记录 20260921';
  expect(() => validateBusinessRecord(record, [sample])).not.toThrow();
  expect(inspectionChecks(record)[0].verdict).toBe('fail');
});
it('does not convert missing numbers to zero or rank incomparable records', () => {
  const a = newBusinessRecord('sample', 'a'); a.id = 'a';
  const b = newBusinessRecord('sample', 'b'); b.id = 'b'; b.fields.quantity = '2';
  const rows = comparisonRows([a, b]);
  expect(rows.find(r => r.label === '数量')?.values).toEqual(['未填写', '2']);
});
it('rejects invalid quantities and reversed shipping dates', () => {
  const r = newBusinessRecord('sample', 'a'); r.productScope = '白板'; r.fields.quantity = '-1';
  expect(() => validateBusinessRecord(r, [])).toThrow(/数量/);
  r.fields.quantity = '1'; r.fields.sentDate = '2026-09-22'; r.fields.receivedDate = '2026-09-21';
  expect(() => validateBusinessRecord(r, [])).toThrow(/日期/);
});

it('does not complete an inspection with undecided test items or a non-sample source', () => {
  const sample = { ...newBusinessRecord('sample','a'), id:'s', productScope:'白板' };
  const record = { ...newBusinessRecord('inspection','a'), productScope:'白板', status:'completed' as const, fields:{ sampleId:'s',date:'2026-09-21',evidenceNote:'原始测试照片',checks:JSON.stringify([{name:'擦除',method:'擦拭',standard:'无残留',actual:'待确认',verdict:'pending'}]) } };
  expect(() => validateBusinessRecord(record,[sample])).toThrow();
  record.status = 'completed';
  record.fields.checks = JSON.stringify([{name:'擦除',method:'擦拭',standard:'无残留',actual:'有残留',verdict:'fail'}]);
  expect(() => validateBusinessRecord(record,[{...sample,kind:'purchase'}])).toThrow();
});
