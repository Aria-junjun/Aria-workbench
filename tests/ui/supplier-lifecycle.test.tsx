// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SupplierLifecycleWorkspace } from '@/components/workbench/supplier-lifecycle-workspace';
import { SupplierCostExecutionGuide, SupplierCostImprovements } from '@/components/workbench/supplier-cost-improvements';
import { loadLocalWorkbenchData, normalizeWorkbenchData, mergeSuppliers } from '@/features/workbench/local-store';
import { saveLifecycleRecord } from '@/features/workbench/supplier-lifecycle-store';
import { setWorkbenchSnapshot } from '@/features/workbench/workbench-store';
import { commitLifecycleRecord, emptyLifecycleRecord } from '@/features/workbench/supplier-lifecycle';
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: null }) }));
  localStorage.clear(); push.mockReset();
  const data = normalizeWorkbenchData({});
  localStorage.setItem('personal-commercial-workbench', JSON.stringify(data));
  setWorkbenchSnapshot(data);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('creates minimal draft, persists it, navigates to read-only detail', () => {
  render(<SupplierLifecycleWorkspace section="sourcing" mode="new" />);
  fireEvent.change(screen.getByLabelText('事项名称 *'), { target: { value: '白板寻源' } });
  fireEvent.change(screen.getByLabelText('产品／SKU范围 *'), { target: { value: '白板贴17个SKU' } });
  fireEvent.click(screen.getByRole('button', { name: '保存并查看' }));
  expect(loadLocalWorkbenchData().supplierLifecycleRecords?.[0].title).toBe('白板寻源');
  expect(push).toHaveBeenCalledWith(expect.stringMatching(/supplier-lifecycle\/sourcing\/.+\?saved=1/));
});
it('default detail is read-only and opens the shared edit dialog', () => {
  const record = commitLifecycleRecord([], { ...emptyLifecycleRecord('admission'), title: '测样', productScope: '白板贴' });
  setWorkbenchSnapshot(normalizeWorkbenchData({ supplierLifecycleRecords: [record] }));
  render(<SupplierLifecycleWorkspace section="admission" mode="detail" recordId={record.id} />);
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  expect(screen.getByLabelText('准入核验名称 *')).toBeTruthy();
  expect(screen.getByLabelText('验证标准')).toBeTruthy();
});
it('shows empty overview without invented spend or fake suppliers', () => {
  render(<SupplierLifecycleWorkspace mode="overview" />);
  expect(screen.getByText('供应商管理决策总览')).toBeTruthy();
  expect(screen.getByRole('region', { name: '供给保障' }).textContent).toContain('供给集中度未采集');
  expect(screen.getAllByText('未采集').length).toBeGreaterThan(0);
  expect(screen.queryByText('¥0.00')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /交付履约/ }));
  fireEvent.click(screen.getByRole('button', { name: '代发周期' }));
  expect(screen.getByText('代发经营监控')).toBeTruthy();
});
it('keeps the director overview results-only with compact metric explanations', () => {
  render(<SupplierLifecycleWorkspace mode="overview" />);
  expect(screen.queryByText('待补数据 · 按来源办理')).toBeNull();
  expect(screen.queryByRole('link', { name: '补录采购履约订单' })).toBeNull();
  expect(screen.getByLabelText('入仓未交数量口径说明')).toBeTruthy();
  expect(screen.getByLabelText('年度已实现净降本口径说明')).toBeTruthy();
});
it('routes quality evidence to the fulfillment execution page and keeps missing coverage explicit', () => {
  render(<SupplierLifecycleWorkspace mode="overview" />);
  expect(screen.getByRole('tab', { name: /质量与综合成本/ }).textContent).toContain('未采集');
  fireEvent.click(screen.getByRole('tab', { name: /质量与综合成本/ }));
  expect(screen.getByRole('link', { name: /进入采购履约/ }).getAttribute('href')).toBe('/procurement/fulfillment');
});
it('provides an operator entry from an empty responsibility queue', () => {
  render(<SupplierLifecycleWorkspace mode="overview" />);
  fireEvent.click(screen.getByRole('tab', { name: /责任闭环/ }));
  expect(screen.getByRole('link', { name: /登记跟进事项/ }).getAttribute('href')).toBe('/supplier-lifecycle/performance/new');
});
it('explains the savings formula and required evidence where the operator creates a cost project', () => {
  render(<><SupplierCostExecutionGuide /><SupplierCostImprovements create /></>);
  expect(screen.getByText(/已实现净降本 =/)).toBeTruthy();
  expect(screen.getByText(/缺少可比基准凭证时不要创建项目/)).toBeTruthy();
});
it('organizes management overview into five switchable decision themes instead of stacking all panels', () => {
  render(<SupplierLifecycleWorkspace mode="overview" />);
  for (const name of ['供给保障', '交付履约', '质量与综合成本', '成本改善', '责任闭环']) {
    expect(screen.getByRole('tab', { name: new RegExp(name) })).toBeTruthy();
  }
  expect(screen.getByRole('region', { name: '供给保障' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: '交付履约' })).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /交付履约/ }));
  expect(screen.getByRole('region', { name: '交付履约' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: '供给保障' })).toBeNull();
  expect(screen.getByText(/仅当同一 SKU 的承诺到货日和实际到货日均已采集，才判断准时/)).toBeTruthy();
});
it('renders the global decision signals as a two-row navigation matrix', () => {
  render(<SupplierLifecycleWorkspace mode="overview" />);
  const matrix = screen.getByRole('table', { name: '管理决策信号' });
  expect(screen.getAllByRole('row', { name: /./ }).length).toBe(2);
  expect(matrix.querySelectorAll('th').length).toBe(5);
  fireEvent.click(screen.getByRole('button', { name: /单一来源/ }));
  expect(screen.getByRole('region', { name: '供给保障' })).toBeTruthy();
});
it('keeps dropship operating risk separate from cross-business responsibility follow-up', () => {
  const data = normalizeWorkbenchData({ supplierBusinessRecords: [{id:'period-1',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'全店代发',status:'completed',title:'代发周期',owner:'',attachmentIds:[],revision:1,createdAt:'',updatedAt:'',fields:{periodStart:'2026-09-14',periodEnd:'2026-09-20',platform:'1688',paidOrders:'560',gmv:'1200',pickup48Rate:'90',paymentToSignHours:'50',refundRate:'12',rejectReturnRate:'0',response3mRate:'60'}}] });
  setWorkbenchSnapshot(data);
  render(<SupplierLifecycleWorkspace mode="overview" />);
  fireEvent.click(screen.getByRole('tab', { name: /交付履约/ }));
  expect(screen.queryByText('代发经营监控')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '代发周期' }));
  expect(screen.getByText('代发经营监控')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: /责任闭环/ }));
  expect(screen.queryByText('代发经营监控')).toBeNull();
});
it('shows procurement facts but never claims on-time arrival without a supplier promise date', () => {
  const record = {
    id:'po-view',section:'fulfillment',title:'入仓采购单',productName:'毛毡板',priority:'中',status:'pending',createdAt:'2026-09-01',
    lineItems:[{id:'line-view',productName:'毛毡板',sku:'SKU-1',specification:'60×90',unit:'张',quantity:'10'}],
    fulfillment:{mode:'warehouse',orderNo:'PO-VIEW',orderDate:'2026-09-01',owner:'采购甲',settlement:'月结',settlementTerms:'',sourcePlatform:'',originalOrderNo:'',importBatch:'',destination:'',lines:[{lineId:'line-view',supplierId:'a',supplierName:'甲厂',quantity:10}],events:[
      {id:'ship-view',kind:'shipment',date:'2026-09-03',operator:'甲厂',lineId:'line-view',quantity:8,note:'',recordedAt:''},
      {id:'receipt-view',kind:'receipt',date:'2026-09-11',operator:'仓库',lineId:'line-view',quantity:6,rejectedQuantity:1,note:'部分拒收',recordedAt:''},
    ]},
  };
  localStorage.setItem('procurement-workbench-v1', JSON.stringify([record]));
  setWorkbenchSnapshot(normalizeWorkbenchData({ suppliers:[{id:'a',name:'甲厂',categories:[],riskTags:[],createdAt:''}] }));
  render(<SupplierLifecycleWorkspace mode="overview" />);
  fireEvent.click(screen.getByRole('tab', { name: /交付履约/ }));
  const table = screen.getByRole('table', { name:'交付履约' });
  expect(table.textContent).toContain('PO-VIEW');
  expect(table.textContent).toContain('未交 4');
  expect(table.textContent).toContain('10 天');
  expect(table.textContent).toContain('承诺到货未采集');
  expect(table.textContent).not.toContain('准时率');
});
it('states that a scoring scheme is not an imported native performance result', () => {
  render(<SupplierLifecycleWorkspace mode="overview" />);
  fireEvent.click(screen.getByRole('tab', { name: /交付履约/ }));
  expect(screen.getByText('聚水潭原生绩效结果')).toBeTruthy();
  expect(screen.getByText(/目前只有评分方案配置，尚未导入评分结果/)).toBeTruthy();
  expect(screen.getByText(/不代表供应商无风险/)).toBeTruthy();
  expect(screen.queryByText('0 分')).toBeNull();
});
it('shows imported native scores and actual metrics without blending inbound and dropship', () => {
  const data = normalizeWorkbenchData({
    suppliers: [{id:'a',name:'供应商甲',shortName:'甲',categories:[],riskTags:[],createdAt:''}],
    supplierNativePerformanceSnapshots: [
      {id:'native-in',supplierId:'a',businessMode:'inbound',periodStart:'2026-09-01',periodEnd:'2026-09-30',schemeName:'入仓方案',schemeVersion:'v2',totalScore:82,grade:'良好',metrics:{onTimeDeliveryRateQuantity:91,purchaseReturnRate:2},riskLabels:[],sourceSystem:'jushuitan',sourceRecordKey:'source-in',importBatchId:'batch-in',sourceFileName:'评分结果.xlsx',importedAt:'2026-09-29T00:00:00.000Z'},
      {id:'native-drop',supplierId:'a',businessMode:'dropship',periodStart:'2026-09-01',periodEnd:'2026-09-30',schemeName:'代发方案',totalScore:0,metrics:{},riskLabels:[],sourceSystem:'jushuitan',sourceRecordKey:'source-drop',importBatchId:'batch-drop',importedAt:'2026-09-29T00:00:00.000Z'},
    ],
  });
  setWorkbenchSnapshot(data);
  render(<SupplierLifecycleWorkspace mode="overview" />);
  fireEvent.click(screen.getByRole('tab', { name: /交付履约/ }));
  const table = screen.getByRole('table', {name:'聚水潭原生绩效结果'});
  expect(table.textContent).toContain('入仓');
  expect(table.textContent).not.toContain('代发');
  expect(table.textContent).toContain('甲');
  expect(table.textContent).toContain('82');
  expect(table.textContent).toContain('0');
  expect(table.textContent).toContain('91%');
  expect(table.textContent).toContain('采购退货率 2');
  expect(table.textContent).toContain('评分结果.xlsx');
  fireEvent.click(screen.getByRole('button', { name: '代发周期' }));
  const dropshipTable = screen.getByRole('table', {name:'聚水潭原生绩效结果'});
  expect(dropshipTable.textContent).toContain('代发');
  expect(dropshipTable.textContent).not.toContain('入仓');
  expect(dropshipTable.textContent).toContain('未采集');
});
it('shows supply concentration from inbound snapshots without presenting settlement fields as director KPIs', () => {
  const data = normalizeWorkbenchData({ suppliers: [{id:'a',name:'入仓供应商甲',categories:[],riskTags:[],createdAt:''}], monthlyInboundSnapshots: [{id:'inbound-1',skuMasterId:'sku-1',period:'2026-09',supplierId:'a',receivedQuantity:100,settlementUnitPrice:3,settlementAmount:300,availableStock:20,inTransitQuantity:10,sourceFileName:'入仓对账.xlsx',sourceSheetName:'九月',importedAt:''}] });
  setWorkbenchSnapshot(data);
  render(<SupplierLifecycleWorkspace mode="overview" />);
  const table = screen.getByRole('table', {name:'供给保障'});
  expect(table.textContent).toContain('入仓供应商甲');
  expect(table.textContent).toContain('单一来源暴露');
  expect(table.textContent).toContain('100.0%');
  expect(table.textContent).toContain('0 家已登记 / 0 家已验证');
  expect(screen.queryByText('¥3.00')).toBeNull();
  expect(screen.getByRole('link', { name: '查看来源' }).getAttribute('href')).toBe('/supplier-records?kind=purchase&snapshotIds=inbound-1');
});
it('shows actual supply concentration separately from a merely registered backup supplier', () => {
  const data = normalizeWorkbenchData({
    suppliers: [{id:'a',name:'实际供应商',shortName:'主供A',categories:[],riskTags:[],createdAt:''},{id:'b',name:'备选供应商',shortName:'备选B',categories:[],riskTags:[],createdAt:''}],
    monthlyInboundSnapshots: [{id:'inbound-1',skuMasterId:'sku-1',productFamilyKey:'毛毡板',period:'2026-09',supplierId:'a',receivedQuantity:100,settlementAmount:300,sourceFileName:'入仓.xlsx',sourceSheetName:'九月',importedAt:''}],
    productSupplierAssignments: [{id:'backup-1',productFamilyKey:'毛毡板',supplierId:'b',role:'backup',effectiveFrom:'2026-08',status:'active',source:'manual'}],
  });
  setWorkbenchSnapshot(data);
  render(<SupplierLifecycleWorkspace mode="overview" />);
  const table = screen.getByRole('table', {name:'供给保障'});
  expect(table.textContent).toContain('100.0%');
  expect(table.textContent).toContain('主供A');
  expect(table.textContent).toContain('1 家已登记 / 0 家已验证');
});
it('shows only escalated lifecycle items in the director action queue', () => {
  const urgent = commitLifecycleRecord([], { ...emptyLifecycleRecord('performance'), title:'异常跟进', productScope:'产品甲', supplierIds:['a'], status:'decision', priority:'high', owner:'采购负责人', dueDate:'2026-09-30', nextAction:'核实供应商整改', sourceRecordIds:['source-1'] });
  const routine = commitLifecycleRecord([], { ...emptyLifecycleRecord('sourcing'), title:'日常寻源', productScope:'产品乙', status:'active', priority:'normal' });
  const data = normalizeWorkbenchData({ suppliers:[{id:'a',name:'供应商甲',categories:[],riskTags:[],createdAt:''}], supplierLifecycleRecords:[urgent,routine] });
  setWorkbenchSnapshot(data);
  render(<SupplierLifecycleWorkspace mode="overview" />);
  fireEvent.click(screen.getByRole('tab', { name: /责任闭环/ }));
  const table = screen.getByRole('table', {name:'本期需跟进'});
  expect(table.textContent).toContain('异常跟进');
  expect(table.textContent).toContain('采购负责人');
  expect(table.textContent).toContain('核实供应商整改');
  expect(table.textContent).toContain('查看依据');
  expect(table.textContent).not.toContain('日常寻源');
});
it('shows latest dropship decisions and keeps low samples out of the formal risk queue', () => {
  const data = normalizeWorkbenchData({ suppliers:[{id:'a',name:'高量风险商家',categories:[],riskTags:[],createdAt:''},{id:'b',name:'低样本商家',categories:[],riskTags:[],createdAt:''}], supplierBusinessRecords:[
    {id:'p1',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'全店代发',status:'completed',title:'周期',owner:'',attachmentIds:[],revision:1,createdAt:'',updatedAt:'',fields:{periodStart:'2026-09-14',periodEnd:'2026-09-20',platform:'1688',paidOrders:'560',gmv:'1200',pickup48Rate:'90',paymentToSignHours:'50',refundRate:'12',rejectReturnRate:'0',response3mRate:'60'}},
    {id:'p2',kind:'dropship_period',supplierIds:['b'],offerIds:[],productScope:'全店代发',status:'completed',title:'周期',owner:'',attachmentIds:[],revision:1,createdAt:'',updatedAt:'',fields:{periodStart:'2026-09-14',periodEnd:'2026-09-20',platform:'1688',paidOrders:'2',gmv:'20',pickup48Rate:'80',paymentToSignHours:'50',refundRate:'20',rejectReturnRate:'0',response3mRate:'90'}},
  ], pendingDropshipSuppliers:[{id:'pending',sourceName:'待建档商家',platform:'1688',periodStart:'2026-09-14',periodEnd:'2026-09-20',paidOrders:30,gmv:300,filingBand:'eligible',sourceFileName:'a.xlsx',createdAt:''}] });
  setWorkbenchSnapshot(data);
  render(<SupplierLifecycleWorkspace mode="overview" />);
  fireEvent.click(screen.getByRole('tab', { name: /交付履约/ }));
  fireEvent.click(screen.getByRole('button', { name: '代发周期' }));
  expect(screen.getByText('代发经营监控')).toBeTruthy();
  expect(screen.getAllByText(/2026-09-14 至 2026-09-20/).length).toBeGreaterThan(0);
  expect(screen.getAllByText('高量风险商家').length).toBeGreaterThan(0);
  expect(screen.getByRole('link',{name:/核对高量风险商家原始记录/}).getAttribute('href')).toContain('recordId=p1');
  expect(screen.getByRole('link',{name:/为高量风险商家提出处理建议/}).getAttribute('href')).toContain('sourceRecordId=p1');
  expect(screen.getByRole('link',{name:/为高量风险商家提出处理建议/}).getAttribute('href')).toContain('businessMode=dropship');
  expect(screen.getAllByText(/高量高风险/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/退款率 12%/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/3分钟响应率 60%/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/日均 80 单/).length).toBeGreaterThan(0);
  expect(screen.queryByText('低样本商家')).toBeNull();
  expect(screen.getByRole('link',{name:/处理 1 条待建档/})).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: /责任闭环/ }));
  expect(screen.queryByText('代发经营监控')).toBeNull();
  expect(screen.getByText(/暂无符合关注规则且有来源依据的跟进事项/)).toBeTruthy();
});

it('lets a business owner attach a period source to a performance recommendation', () => {
  const data = normalizeWorkbenchData({ suppliers: [{id:'a',name:'供应商甲',categories:[],riskTags:[],createdAt:''}], supplierBusinessRecords: [{id:'period-1',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'商品甲',status:'completed',title:'九月代发周期',owner:'',fields:{paidOrders:'40'},attachmentIds:[],revision:1,createdAt:'',updatedAt:''}] });
  setWorkbenchSnapshot(data);
  render(<SupplierLifecycleWorkspace section="performance" mode="new" supplierId="a" businessMode="dropship" />);
  expect(screen.getByLabelText('关联原始记录：九月代发周期')).toBeTruthy();
});
it('preselects the triggering dropship period when a risk recommendation is opened', () => {
  const data = normalizeWorkbenchData({ suppliers: [{id:'a',name:'供应商甲',categories:[],riskTags:[],createdAt:''}], supplierBusinessRecords: [{id:'period-risk',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'商品甲',status:'completed',title:'九月代发周期',owner:'',fields:{periodStart:'2026-09-14',periodEnd:'2026-09-20',paidOrders:'560',gmv:'1200',pickup48Rate:'90'},attachmentIds:[],revision:1,createdAt:'',updatedAt:''}] });
  setWorkbenchSnapshot(data);
  render(<SupplierLifecycleWorkspace section="performance" mode="new" supplierId="a" businessMode="dropship" sourceRecordId="period-risk" riskReason="48小时揽收率 90%" />);
  expect((screen.getByLabelText('关联原始记录：九月代发周期') as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText('异常与改善名称 *') as HTMLInputElement).value).toContain('九月代发周期');
  expect((screen.getByLabelText('订单 / 质量 / 售后原始依据') as HTMLTextAreaElement).value).toContain('48小时揽收率 90%');
});

it('offers an identified inbound snapshot as evidence without copying its amount', () => {
  const data = normalizeWorkbenchData({ suppliers: [{id:'a',name:'供应商甲',categories:[],riskTags:[],createdAt:''}], monthlyInboundSnapshots: [{id:'inbound-1',skuMasterId:'sku-1',period:'2026-09',supplierId:'a',receivedQuantity:100,settlementAmount:300,sourceFileName:'入仓对账.xlsx',sourceSheetName:'九月',importedAt:''}] });
  setWorkbenchSnapshot(data);
  render(<SupplierLifecycleWorkspace section="performance" mode="new" supplierId="a" businessMode="inbound" />);
  expect(screen.getByLabelText('关联原始记录：2026-09 · 入仓对账.xlsx')).toBeTruthy();
});
it('offers a uniquely matched legacy inbound snapshot as evidence', () => {
  const data = normalizeWorkbenchData({ suppliers: [{id:'a',name:'聚赢',categories:[],riskTags:[],createdAt:''}], monthlyInboundSnapshots: [{id:'inbound-legacy',skuMasterId:'sku-1',period:'2026-09',supplierName:'聚赢',sourceFileName:'历史.xlsx',sourceSheetName:'九月',importedAt:''}] });
  setWorkbenchSnapshot(data);
  render(<SupplierLifecycleWorkspace section="performance" mode="new" supplierId="a" businessMode="inbound" />);
  expect(screen.getByLabelText('关联原始记录：2026-09 · 历史.xlsx')).toBeTruthy();
});
it('asks before following an internal link with unsaved edits', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<SupplierLifecycleWorkspace section="sourcing" mode="new" />);
  fireEvent.change(screen.getByLabelText('事项名称 *'), { target: { value: '未保存' } });
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  screen.getByRole('link', { name: '管理总览' }).dispatchEvent(event);
  expect(confirm).toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(true);
  confirm.mockRestore();
});
it('migrates lifecycle associations when supplier archives are merged', () => {
  const first = commitLifecycleRecord([], { ...emptyLifecycleRecord('sourcing'), title: '事项', productScope: '白板', supplierIds: ['a'], selectedSupplierIds: ['a'] });
  const supplier = { name: '甲', categories: [], riskTags: [], createdAt: '' };
  const data = normalizeWorkbenchData({ suppliers: [{ ...supplier, id: 'a' }, { ...supplier, id: 'b', name: '乙' }], supplierLifecycleRecords: [first] });
  localStorage.setItem('personal-commercial-workbench', JSON.stringify(data));
  mergeSuppliers('b', 'a');
  const changed = loadLocalWorkbenchData().supplierLifecycleRecords![0];
  expect(changed.supplierIds).toEqual(['b']);
  expect(changed.selectedSupplierIds).toEqual(['b']);
  expect(() => saveLifecycleRecord(changed)).not.toThrow();
});
