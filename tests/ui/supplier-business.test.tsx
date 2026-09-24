// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SupplierBusinessLedger } from '@/components/workbench/supplier-business-ledger';
import { normalizeWorkbenchData, loadLocalWorkbenchData } from '@/features/workbench/local-store';
import * as localStore from '@/features/workbench/local-store';
import { setWorkbenchSnapshot } from '@/features/workbench/workbench-store';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <a {...props}>{children}</a> }));

beforeEach(() => {
  localStorage.clear();
  const data = normalizeWorkbenchData({ suppliers: [{ id: 'a', name: '供应商A', categories: [], riskTags: [], createdAt: '' }, { id: 'b', name: '供应商B', categories: [], riskTags: [], createdAt: '' }] });
  setWorkbenchSnapshot(data); localStorage.setItem('personal-commercial-workbench', JSON.stringify(data));
});
afterEach(cleanup);

it('opens the dropship queue from the management overview link', () => {
  window.history.pushState({},'', '/supplier-records?kind=dropship_period#pending-dropship');
  render(<SupplierBusinessLedger />);
  expect(screen.getByRole('button',{name:'代发周期履约'}).className).toContain('font-semibold');
  window.history.pushState({},'', '/');
});

it('creates a completed inspection from a saved sample and reopens its actual test results', () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true,data:null})}));
  const data = normalizeWorkbenchData({ suppliers:[{id:'a',name:'供应商A',categories:[],riskTags:[],createdAt:''}],supplierBusinessRecords:[{id:'sample',kind:'sample',supplierIds:['a'],offerIds:[],productScope:'白板贴',status:'completed',title:'测试样品V1',owner:'',fields:{specification:'V1'},attachmentIds:[],revision:1,createdAt:'',updatedAt:''}] });
  setWorkbenchSnapshot(data); localStorage.setItem('personal-commercial-workbench',JSON.stringify(data));
  const view = render(<SupplierBusinessLedger />);
  fireEvent.click(screen.getByRole('button',{name:'测试样品V1'}));
  fireEvent.click(screen.getByRole('button',{name:'基于此样品核样'}));
  expect((screen.getByLabelText('产品范围 / SKU') as HTMLInputElement).value).toBe('白板贴');
  fireEvent.change(screen.getByLabelText('标题'),{target:{value:'擦除检验'}});
  fireEvent.change(screen.getByLabelText('核样日期'),{target:{value:'2026-09-21'}});
  fireEvent.click(screen.getByRole('button',{name:'添加检验项目'}));
  for (const [label,value] of [['检验项目1','擦除'],['核样方法1','水笔书写24小时'],['合格标准1','无残留'],['实测结果1','有残留']]) fireEvent.change(screen.getByLabelText(label),{target:{value}});
  fireEvent.change(screen.getByLabelText('判定1'),{target:{value:'fail'}});
  fireEvent.change(screen.getByLabelText('依据 / 备注'),{target:{value:'试验照片20260921'}});
  fireEvent.change(screen.getByLabelText('状态'),{target:{value:'completed'}});
  fireEvent.click(screen.getByRole('button',{name:'保存记录'}));
  expect(screen.queryByRole('alert')).toBeNull();
  const saved = loadLocalWorkbenchData().supplierBusinessRecords!.find(r=>r.kind === 'inspection')!;
  expect(saved.fields.sampleId).toBe('sample');
  expect(saved.status).toBe('completed');
  view.unmount(); setWorkbenchSnapshot(loadLocalWorkbenchData());
  render(<SupplierBusinessLedger />);
  fireEvent.click(screen.getByRole('button',{name:'核样记录'}));
  fireEvent.click(screen.getByRole('button',{name:'擦除检验'}));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByText('试验照片20260921')).toBeTruthy();
  expect(screen.getByText('未通过')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('shows a single cross-supplier sample table and temporary comparison', () => {
  const data = normalizeWorkbenchData({ suppliers: [{ id: 'a', name: '供应商A', categories: [], riskTags: [], createdAt: '' }, { id: 'b', name: '供应商B', categories: [], riskTags: [], createdAt: '' }], supplierBusinessRecords: [
    { id: 's1', kind: 'sample', supplierIds: ['a'], offerIds: [], productScope: '白板贴', status: 'completed', title: 'A样', owner: '', fields: { specification: 'V1' }, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
    { id: 's2', kind: 'sample', supplierIds: ['b'], offerIds: [], productScope: '白板贴', status: 'completed', title: 'B样', owner: '', fields: { specification: 'V1' }, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' },
  ] });
  setWorkbenchSnapshot(data);
  render(<SupplierBusinessLedger />);
  fireEvent.click(screen.getByRole('button', { name: '寄样记录' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '选择A样' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '选择B样' }));
  expect(screen.getByText('临时横向对比')).toBeTruthy();
  expect(screen.getByText('只比较本次选中的寄样或核样，不写入历史结论。')).toBeTruthy();
});

it('shows supplier names, links inspections to sample options, and closes editor when switching tabs', () => {
  const data = normalizeWorkbenchData({ suppliers: [{ id: 'a', name: '供应商A', categories: [], riskTags: [], createdAt: '' }], supplierBusinessRecords: [{ id: 's1', kind: 'sample', supplierIds: ['a'], offerIds: [], productScope: '白板贴', status: 'active', title: 'A样', owner: '', fields: {}, attachmentIds: [], revision: 1, createdAt: '', updatedAt: '' }] });
  setWorkbenchSnapshot(data);
  render(<SupplierBusinessLedger />);
  fireEvent.click(screen.getByRole('button', { name: '寄样记录' }));
  expect(screen.getAllByText('供应商A').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: '新增寄样记录' }));
  fireEvent.click(screen.getByRole('button', { name: '核样记录' }));
  expect(screen.queryByText('新增寄样记录')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '新增核样记录' }));
  expect(screen.getByRole('combobox', { name: '关联寄样记录' })).toBeTruthy();
});

it('uses dispatch fields for purchase fulfillment and supports opening a saved record', () => {
  const data = normalizeWorkbenchData({ suppliers: [{ id: 'a', name: '供应商A', categories: [], riskTags: [], createdAt: '' }] });
  setWorkbenchSnapshot(data);
  render(<SupplierBusinessLedger />);
  fireEvent.click(screen.getByRole('button', { name: '采购履约' }));
  fireEvent.click(screen.getByRole('button', { name: '新增采购履约' }));
  expect(screen.getByText('采购 / 订单号')).toBeTruthy();
  expect(screen.getByText('预计到货日期')).toBeTruthy();
  expect(screen.getByText('收货地址')).toBeTruthy();
});

it('shows procurement fulfillment as a read-only supplier business record', () => {
  localStorage.setItem('procurement-workbench-v1', JSON.stringify([{ id:'f1', section:'fulfillment', title:'白板贴项目 · 履约', productName:'白板贴', priority:'中', status:'pending', createdAt:'', lineItems:[{id:'l1',productName:'白板贴'}], fulfillment:{mode:'warehouse',orderNo:'PO1',orderDate:'2026-09-20',owner:'采购甲',settlement:'现结',settlementTerms:'',sourcePlatform:'1688',originalOrderNo:'',importBatch:'',destination:'杭州仓',lines:[{lineId:'l1',supplierId:'a',supplierName:'供应商A',quantity:100}],events:[]} }]));
  render(<SupplierBusinessLedger />);
  fireEvent.click(screen.getByRole('button', { name: '采购履约' }));
  expect(screen.getByText('采购履约同步')).toBeTruthy();
  expect(screen.getByText('PO1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
  expect(screen.getByText('来自采购履约，只读')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
});

it('shows weekly dropship performance with sample gates, weighted overview and risks', () => {
  const data = normalizeWorkbenchData({ suppliers: [{ id: 'a', name: '供应商A', categories: [], riskTags: [], createdAt: '' }], supplierBusinessRecords: [{
    id: 'p1', kind: 'dropship_period', supplierIds: ['a'], offerIds: [], productScope: '家居清洁', status: 'completed', title: '第38周履约', owner: '采购甲', attachmentIds: [], revision: 1, createdAt: '', updatedAt: '',
    fields: { periodStart: '2026-09-14', periodEnd: '2026-09-20', platform: '1688', paidOrders: '120', gmv: '25945.9', pickup48Rate: '90', paymentToSignHours: '50.8', refundRate: '12.5', rejectReturnRate: '4.3', response3mRate: '82.9' }
  }] });
  setWorkbenchSnapshot(data);
  render(<SupplierBusinessLedger />);
  fireEvent.click(screen.getByRole('button', { name: '代发周期履约' }));
  expect(screen.getByText('周期订单量')).toBeTruthy();
  expect(screen.getByText('120')).toBeTruthy();
  expect(screen.getByText('可评价')).toBeTruthy();
  expect(screen.getByText('揽收时效异常')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '新增代发周期履约' }));
  expect(screen.getByText('周期开始')).toBeTruthy();
  expect(screen.getByText('支付订单量')).toBeTruthy();
  expect(screen.getByText('3分钟响应率（%）')).toBeTruthy();
});

it('shows complete dropship facts and distinguishes zero from missing values', () => {
  const data = normalizeWorkbenchData({ suppliers:[{id:'a',name:'江苏新丰',categories:[],riskTags:[],createdAt:''}], supplierBusinessRecords:[{
    id:'full',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'全店代发',status:'completed',title:'周期明细',owner:'',attachmentIds:[],revision:1,createdAt:'',updatedAt:'',
    fields:{periodStart:'2026-09-04',periodEnd:'2026-09-18',platform:'1688',paidOrders:'40',gmv:'555.5',pickup48Rate:'100',paymentToSignHours:'53.4',paymentToSignChangeHours:'',refundRate:'14.3',rejectReturnRate:'0',response3mRate:'0',afterSalesCount:'3',afterSalesRate:'11.54',rejectedAfterSalesCount:'0',rejectedAfterSalesRate:'0',averageRefundSeconds:'1530',lighthouseAfterSales:'4',lighthouseQuality:'3.33',lighthouseScore:'3.9',dataSource:'代发供应商履约表.xlsx'}
  }]});
  setWorkbenchSnapshot(data);
  render(<SupplierBusinessLedger />);
  fireEvent.click(screen.getByRole('button',{name:'代发周期履约'}));
  fireEvent.click(screen.getByRole('button',{name:'周期明细'}));
  expect(screen.getByText('支签变化（小时）')).toBeTruthy();
  expect(screen.getByText('售后拒绝率（%）')).toBeTruthy();
  expect(screen.getByText('灯塔综合服务分')).toBeTruthy();
  expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  expect(screen.getAllByText('未采集').length).toBeGreaterThan(0);
});

it('keeps dropship period metrics separate from inbound fulfillment facts', () => {
  const data = normalizeWorkbenchData({ suppliers:[{id:'a',name:'混合供应商',categories:[],riskTags:[],createdAt:''}], supplierBusinessRecords:[
    {id:'period',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'代发商品',status:'completed',title:'代发周报',owner:'',fields:{paidOrders:'30',gmv:'600',pickup48Rate:'98'},attachmentIds:[],revision:1,createdAt:'',updatedAt:''},
    {id:'inbound',kind:'purchase',supplierIds:['a'],offerIds:[],productScope:'入仓商品',status:'completed',title:'入仓采购单',owner:'',fields:{fulfillmentMode:'warehouse',orderNo:'PO-2',receivedQuantity:'100'},attachmentIds:[],revision:1,createdAt:'',updatedAt:''},
  ]});
  setWorkbenchSnapshot(data);
  const view = render(<SupplierBusinessLedger supplierId="a" kinds={['dropship_period']} embedded />);
  expect(screen.getByText('代发周报')).toBeTruthy();
  expect(screen.queryByText('入仓采购单')).toBeNull();
  expect(screen.getByText('周期订单量')).toBeTruthy();
  view.unmount();
  render(<SupplierBusinessLedger supplierId="a" kinds={['purchase']} embedded />);
  expect(screen.getByText('入仓采购单')).toBeTruthy();
  expect(screen.queryByText('周期订单量')).toBeNull();
});

it('turns pending dropship suppliers into an actionable filing queue', () => {
  const data = normalizeWorkbenchData({ suppliers:[{id:'a',name:'正式供应商',categories:[],riskTags:[],createdAt:''}], pendingDropshipSuppliers:[{id:'pending',sourceName:'来源商家',platform:'1688',periodStart:'2026-09-14',periodEnd:'2026-09-20',paidOrders:30,gmv:300,filingBand:'eligible',sourceFileName:'a.xlsx',createdAt:''}] });
  setWorkbenchSnapshot(data); localStorage.setItem('personal-commercial-workbench',JSON.stringify(data));
  render(<SupplierBusinessLedger />);
  fireEvent.click(screen.getByRole('button',{name:'代发周期履约'}));
  expect(screen.getByText('达到观察门槛，建议建档')).toBeTruthy();
  expect(screen.getByLabelText('待建档状态筛选')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('来源商家关联档案'),{target:{value:'a'}});
  fireEvent.click(screen.getByRole('button',{name:'关联来源商家'}));
  expect(loadLocalWorkbenchData().pendingDropshipSuppliers?.[0].status).toBe('resolved');
  expect(loadLocalWorkbenchData().supplierBusinessRecords?.[0].supplierIds).toEqual(['a']);
});

it('lists permanent batch delete actions and previews the selected scope without deleting automatically', () => {
  const data = normalizeWorkbenchData({ suppliers:[{id:'a',name:'供应商A',categories:[],riskTags:[],createdAt:''}], supplierBusinessRecords:[{
    id:'target',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'商品A',status:'completed',title:'目标周期',owner:'',fields:{platform:'1688',periodStart:'2026-09-04',periodEnd:'2026-09-18'},attachmentIds:[],revision:1,createdAt:'',updatedAt:''
  }]});
  setWorkbenchSnapshot(data); localStorage.setItem('personal-commercial-workbench',JSON.stringify(data));
  render(<SupplierBusinessLedger />);
  fireEvent.click(screen.getByRole('button',{name:'代发周期履约'}));
  expect(screen.getByText('导入批次管理')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'删除导入批次 1688 2026-09-04 至 2026-09-18'}));
  expect(screen.getByText('1688 · 2026-09-04 至 2026-09-18')).toBeTruthy();
  expect(screen.getByText('供应商周期履约')).toBeTruthy();
  expect(loadLocalWorkbenchData().supplierBusinessRecords?.map(item=>item.id)).toContain('target');
  expect(screen.getByRole('button',{name:'下载完整JSON备份'})).toBeTruthy();
  const save = vi.spyOn(localStore,'saveLocalWorkbenchData');
  fireEvent.click(screen.getByLabelText('我确认仅删除该导入批次'));
  fireEvent.click(screen.getByRole('button',{name:'确认删除该导入批次'}));
  expect(save).toHaveBeenCalledTimes(1);
  expect(loadLocalWorkbenchData().supplierBusinessRecords?.map(item=>item.id)).not.toContain('target');
  expect(screen.getByText('已删除导入批次：1688 · 2026-09-04 至 2026-09-18')).toBeTruthy();
});
