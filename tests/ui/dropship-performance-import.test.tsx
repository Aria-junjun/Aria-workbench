// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DropshipPerformanceImportDialog } from '@/components/workbench/dropship-performance-import-dialog';
import { loadLocalWorkbenchData, normalizeWorkbenchData } from '@/features/workbench/local-store';
import { setWorkbenchSnapshot } from '@/features/workbench/workbench-store';

const sheets: Record<string, unknown[][]> = {
  商家服务: [['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率','3分钟响应率'],['1','供应商甲','120单/¥1000','99%','30H','2%','0%','90%'],['2','甲方店铺','40单/¥500','98%','40H','3%','0%','80%'],['3','供应商乙店铺','30单/¥300','97%','45H','4%','0%','70%'],['4','新商家','10单/¥50','90%','80H','12%','0%','50%']],
  商品服务: [['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','商品甲','80单/¥600','98%','35H','3%','0%']],
  商家售后: [['排行','商家名','售后量','售后率','售后拒绝量','售后拒绝率','平均退款时长（秒）','支付订单量'],['1','供应商甲','3','2.5%','0','0%','1','120']],
};

vi.mock('xlsx', () => ({
  read: () => ({ SheetNames:Object.keys(sheets), Sheets:Object.fromEntries(Object.keys(sheets).map(name => [name,{ name }])) }),
  utils: { sheet_to_json: (sheet: { name:string }) => sheets[sheet.name] },
}));

const openAndUpload = async () => {
  render(<DropshipPerformanceImportDialog onClose={vi.fn()} />);
  const file = new File(['xlsx'], '代发供应商履约表.xlsx', {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  Object.defineProperty(file,'arrayBuffer',{value:async()=>new ArrayBuffer(8)});
  fireEvent.change(screen.getByLabelText('选择履约文件'),{target:{files:[file]}});
  await screen.findByText('工作簿读取结果');
};

beforeEach(() => {
  localStorage.clear();
  const data = normalizeWorkbenchData({
    suppliers:[{id:'a',name:'供应商甲',categories:[],riskTags:[],createdAt:''},{id:'b',name:'供应商乙',categories:[],riskTags:[],createdAt:''},{id:'c',name:'供应商丙',categories:[],riskTags:[],createdAt:''}],
    supplierAliasMappings:[{id:'alias-c',platform:'1688',sourceName:'甲方店铺',normalizedSourceName:'甲方店铺',supplierId:'c',confirmedAt:'2026-09-23T08:00:00.000Z'}],
  });
  setWorkbenchSnapshot(data); localStorage.setItem('personal-commercial-workbench',JSON.stringify(data));
});
afterEach(cleanup);

it('guides one workbook through supplier and product routing before showing final write counts', async () => {
  await openAndUpload();
  expect(screen.getByText('商家服务 Sheet')).toBeTruthy();
  expect(screen.getByText('4 行')).toBeTruthy();
  expect(screen.getByText('商品服务 Sheet')).toBeTruthy();
  expect(screen.getAllByText('1 行')).toHaveLength(2);
  expect(screen.getByText('商家售后 Sheet')).toBeTruthy();
  expect(screen.getByText('有效记录')).toBeTruthy();
  expect(screen.getByText('5 条')).toBeTruthy();

  fireEvent.click(screen.getByRole('button',{name:'下一步：供应商归位'}));
  expect(within(screen.getByTestId('supplier-row-供应商甲')).getByText('自动匹配')).toBeTruthy();
  expect(within(screen.getByTestId('supplier-row-甲方店铺')).getByText('历史别名')).toBeTruthy();
  expect(within(screen.getByTestId('supplier-row-供应商乙店铺')).getByText('建议匹配')).toBeTruthy();
  expect(within(screen.getByTestId('supplier-row-新商家')).getByText('待处理')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('供应商乙店铺归属档案'),{target:{value:'b'}});
  fireEvent.click(screen.getByRole('button',{name:'下一步：商品归位'}));
  fireEvent.click(screen.getByLabelText('选择商品甲'));
  fireEvent.click(screen.getByRole('button',{name:'下一步：导入确认'}));
  expect(screen.getByRole('alert').textContent).toContain('商品“商品甲”未选择供应商');
  fireEvent.change(screen.getByLabelText('商品甲供应商'),{target:{value:'a'}});
  fireEvent.change(screen.getByLabelText('商品甲业务模式'),{target:{value:'inbound'}});
  fireEvent.click(screen.getByRole('button',{name:'下一步：导入确认'}));

  expect(screen.getByText('最终写入预览')).toBeTruthy();
  expect(screen.getByText('正式周期记录')).toBeTruthy();
  expect(screen.getByText('正式周期记录').parentElement?.querySelector('p:last-child')?.textContent).toBe('3 条');
  expect(screen.getByText('待建档供应商')).toBeTruthy();
  expect(screen.getByText('保存别名')).toBeTruthy();
  expect(screen.getByText('路由商品')).toBeTruthy();
  expect(screen.getByText('未解决项目')).toBeTruthy();
  expect(screen.getByRole('button',{name:'确认导入'}).hasAttribute('disabled')).toBe(false);
});

it('keeps successful re-import idempotent and reports the saved result', async () => {
  await openAndUpload();
  fireEvent.click(screen.getByRole('button',{name:'下一步：供应商归位'}));
  fireEvent.change(screen.getByLabelText('供应商乙店铺归属档案'),{target:{value:'b'}});
  fireEvent.click(screen.getByRole('button',{name:'下一步：商品归位'}));
  fireEvent.click(screen.getByRole('button',{name:'下一步：导入确认'}));
  fireEvent.click(screen.getByRole('button',{name:'确认导入'}));
  await screen.findByText(/导入完成/);
  const once = loadLocalWorkbenchData();
  cleanup();
  await openAndUpload();
  fireEvent.click(screen.getByRole('button',{name:'下一步：供应商归位'}));
  fireEvent.change(screen.getByLabelText('供应商乙店铺归属档案'),{target:{value:'b'}});
  fireEvent.click(screen.getByRole('button',{name:'下一步：商品归位'}));
  fireEvent.click(screen.getByRole('button',{name:'下一步：导入确认'}));
  fireEvent.click(screen.getByRole('button',{name:'确认导入'}));
  await screen.findByText(/导入完成/);
  const twice = loadLocalWorkbenchData();
  expect(twice.supplierBusinessRecords).toEqual(once.supplierBusinessRecords);
  expect(twice.pendingDropshipSuppliers).toEqual(once.pendingDropshipSuppliers);
});

it('previews the same deduplicated counts that persistence saves when source rows share one supplier', async () => {
  await openAndUpload();
  fireEvent.click(screen.getByRole('button',{name:'下一步：供应商归位'}));
  fireEvent.change(screen.getByLabelText('供应商乙店铺归属档案'),{target:{value:'b'}});
  fireEvent.change(screen.getByLabelText('新商家归属档案'),{target:{value:'b'}});
  fireEvent.click(screen.getByRole('button',{name:'下一步：商品归位'}));
  fireEvent.click(screen.getByRole('button',{name:'下一步：导入确认'}));

  const expected = { formal:3, pending:0, aliases:4, products:0, unresolved:0 };
  const countFor = (label:string) => screen.getByText(label).parentElement?.querySelector('p:last-child')?.textContent;
  expect(countFor('正式周期记录')).toBe(`${expected.formal} 条`);
  expect(countFor('待建档供应商')).toBe(`${expected.pending} 条`);
  expect(countFor('保存别名')).toBe(`${expected.aliases} 条`);
  expect(countFor('路由商品')).toBe(`${expected.products} 条`);
  expect(countFor('未解决项目')).toBe(`${expected.unresolved} 条`);

  fireEvent.click(screen.getByRole('button',{name:'确认导入'}));
  await screen.findByText(/导入完成/);
  const saved = loadLocalWorkbenchData();
  expect(saved.supplierBusinessRecords?.filter(record=>record.kind==='dropship_period')).toHaveLength(expected.formal);
  expect(saved.pendingDropshipSuppliers).toHaveLength(expected.pending);
  expect(saved.supplierAliasMappings).toHaveLength(expected.aliases);
  expect(saved.dropshipProductRoutings).toHaveLength(expected.products);
});

it('keeps the modal stable and blocks review when supplier routing has a blocking conflict', async () => {
  const conflicted = loadLocalWorkbenchData();
  conflicted.supplierAliasMappings = [...(conflicted.supplierAliasMappings ?? []),{id:'alias-conflict',platform:'1688',sourceName:'甲方店铺',normalizedSourceName:'甲方店铺',supplierId:'b',confirmedAt:'2026-09-23T09:00:00.000Z'}];
  setWorkbenchSnapshot(conflicted);
  localStorage.setItem('personal-commercial-workbench',JSON.stringify(conflicted));
  const before = localStorage.getItem('personal-commercial-workbench');

  await openAndUpload();
  fireEvent.click(screen.getByRole('button',{name:'下一步：供应商归位'}));

  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('别名冲突：甲方店铺');
  expect(screen.queryByText('最终写入预览')).toBeNull();
  expect(screen.getByRole('button',{name:'下一步：商品归位'}).hasAttribute('disabled')).toBe(true);
  expect(localStorage.getItem('personal-commercial-workbench')).toBe(before);
});
