// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SupplierProfileWorkspace } from '@/components/workbench/supplier-profile-workspace';
import { normalizeWorkbenchData } from '@/features/workbench/local-store';
import { setWorkbenchSnapshot } from '@/features/workbench/workbench-store';
import { newBusinessRecord } from '@/features/workbench/supplier-business';
import { deriveSupplierBusinessModes } from '@/features/workbench/dropship-decision-loop';
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <a {...props}>{children}</a> }));
beforeEach(() => {
  localStorage.clear();
  const data = normalizeWorkbenchData({ suppliers: [{ id:'a',name:'供应商甲',contactName:'张先生',categories:[],riskTags:[],createdAt:'' }, { id:'b',name:'供应商乙',categories:[],riskTags:[],createdAt:'' }], supplierBusinessRecords: [{ ...newBusinessRecord('sample','a'), id:'sample-a',title:'甲厂白板样',productScope:'白板' },{ ...newBusinessRecord('sample','b'),id:'sample-b',title:'乙厂白板样',productScope:'白板' }] });
  setWorkbenchSnapshot(data); localStorage.setItem('personal-commercial-workbench',JSON.stringify(data));
});
afterEach(cleanup);
it('provides seven business-specific tabs and scopes sample records to this supplier', () => {
  render(<SupplierProfileWorkspace supplierId="a" onEdit={vi.fn()} />);
  for (const name of ['综合概况','基础与资质','产品与报价','送样与准入','合作约定','履约与改善','暂停与退出']) expect(screen.getByRole('button',{name})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'基础与资质'}));
  expect(screen.getByText('张先生')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'送样与准入'}));
  expect(screen.getByRole('link',{name:/查看寄样业务记录/}).getAttribute('href')).toContain('supplierId=a');
  expect(screen.queryByText('乙厂白板样')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'暂停与退出'}));
  fireEvent.click(screen.getByRole('button',{name:'新增暂停与退出'}));
  expect(screen.getByLabelText('替代与过渡安排')).toBeTruthy();
  expect(screen.queryByLabelText('验证标准')).toBeNull();
});

it('links from supplier profile to scoped source records instead of embedding transaction tables', () => {
  const data = normalizeWorkbenchData({ suppliers: [{ id: 'a', name: '供应商甲', categories: [], riskTags: [], createdAt: '' }], supplierBusinessRecords: [{ ...newBusinessRecord('dropship_period', 'a'), id: 'period-a', title: '代发周期', productScope: '商品甲', fields: { paidOrders: '30' } }] });
  setWorkbenchSnapshot(data);
  render(<SupplierProfileWorkspace supplierId="a" onEdit={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '履约与改善' }));
  expect(screen.getByRole('link', { name: /查看代发业务记录/ }).getAttribute('href')).toBe('/supplier-records?supplierId=a&kind=dropship_period');
  expect(screen.queryByRole('button', { name: '代发周期' })).toBeNull();
});

it('does not present a multi-SKU offer as one supplier-wide unit price', () => {
  const data = normalizeWorkbenchData({ suppliers: [{ id: 'a', name: '供应商甲', categories: [], riskTags: [], createdAt: '' }], offers: [{ id: 'offer-a', supplierId: 'a', name: '白板贴报价单', quotedPrice: '¥3', skus: [{ id: 'sku-a', specName: '小号', unitPrice: 3 }, { id: 'sku-b', specName: '大号', unitPrice: 5 }], createdAt: '' }] });
  setWorkbenchSnapshot(data);
  render(<SupplierProfileWorkspace supplierId="a" onEdit={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '产品与报价' }));
  expect(screen.getByText('2 个 SKU')).toBeTruthy();
  expect(screen.getByText('查看各 SKU 价格')).toBeTruthy();
  expect(screen.queryByText('¥3')).toBeNull();
});

it('derives and presents dropship and inbound cooperation on one supplier master', () => {
  const data = normalizeWorkbenchData({
    suppliers: [{ id:'a',name:'混合供应商',categories:[],riskTags:[],createdAt:'' }],
    supplierBusinessRecords: [
      { id:'period-a',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'代发商品',status:'completed',title:'第38周代发',owner:'',fields:{paidOrders:'80',gmv:'800'},attachmentIds:[],revision:1,createdAt:'',updatedAt:'' },
      { id:'purchase-a',kind:'purchase',supplierIds:['a'],offerIds:[],productScope:'入仓商品',status:'completed',title:'PO-入仓',owner:'',fields:{fulfillmentMode:'warehouse',orderNo:'PO-1'},attachmentIds:[],revision:1,createdAt:'',updatedAt:'' },
    ],
  });
  expect(deriveSupplierBusinessModes(data, 'a')).toEqual(['dropship','inbound']);
  setWorkbenchSnapshot(data);
  render(<SupplierProfileWorkspace supplierId="a" onEdit={vi.fn()} />);
  expect(screen.getByText('代发')).toBeTruthy();
  expect(screen.getByText('入仓')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'履约与改善'}));
  expect(screen.getByText('代发履约历史入口')).toBeTruthy();
  expect(screen.getByText('入仓履约历史入口')).toBeTruthy();
  expect(screen.getByRole('link',{name:/查看代发业务记录/})).toBeTruthy();
  expect(screen.getByRole('link',{name:/查看入仓业务记录/})).toBeTruthy();
});

it('derives inbound mode from an existing procurement fulfillment line', () => {
  const data = normalizeWorkbenchData({ suppliers: [{ id:'a',name:'入仓供应商',categories:[],riskTags:[],createdAt:'' }] });
  localStorage.setItem('procurement-workbench-v1', JSON.stringify([{id:'f1',section:'fulfillment',title:'入仓履约',productName:'商品',priority:'中',status:'pending',createdAt:'',fulfillment:{mode:'warehouse',orderNo:'PO-3',orderDate:'2026-09-23',owner:'采购',settlement:'现结',settlementTerms:'',sourcePlatform:'1688',originalOrderNo:'',importBatch:'',destination:'仓库',lines:[{lineId:'l1',supplierId:'a',supplierName:'入仓供应商',quantity:10}],events:[]}}]));
  expect(deriveSupplierBusinessModes(data, 'a')).toEqual(['inbound']);
});

it('derives inbound profile mode from a supplier-linked monthly receipt snapshot', () => {
  const data = normalizeWorkbenchData({ suppliers: [{ id: 'a', name: '入仓供应商', categories: [], riskTags: [], createdAt: '' }], monthlyInboundSnapshots: [{ id: 'receipt-a', skuMasterId: 'sku-a', period: '2026-09', supplierId: 'a', sourceFileName: '对账.xlsx', sourceSheetName: '九月', importedAt: '' }] });
  expect(deriveSupplierBusinessModes(data, 'a')).toEqual(['inbound']);
});
it('uses a unique supplier name for legacy inbound snapshots but not an ambiguous name', () => {
  const base = { id: 'receipt-a', skuMasterId: 'sku-a', period: '2026-09', supplierName: '聚赢', sourceFileName: '对账.xlsx', sourceSheetName: '九月', importedAt: '' };
  const supplier = { id: 'a', name: '聚赢', categories: [], riskTags: [], createdAt: '' };
  expect(deriveSupplierBusinessModes(normalizeWorkbenchData({ suppliers: [supplier], monthlyInboundSnapshots: [base] }), 'a')).toEqual(['inbound']);
  expect(deriveSupplierBusinessModes(normalizeWorkbenchData({ suppliers: [supplier, { ...supplier, id: 'b' }], monthlyInboundSnapshots: [base] }), 'a')).toEqual([]);
});

it('does not treat a generic active product relation as inbound evidence', () => {
  const data = normalizeWorkbenchData({
    suppliers: [{ id:'a',name:'代发供应商',categories:[],riskTags:[],createdAt:'' }],
    dropshipProductRoutings: [{id:'route-1',platform:'1688',productName:'商品甲',normalizedProductName:'商品甲',supplierId:'a',businessMode:'dropship',confirmedAt:'2026-09-23'}],
    productSupplierAssignments: [{id:'relation-1',productFamilyKey:'商品甲',supplierId:'a',role:'primary',effectiveFrom:'2026-09-23',status:'active',source:'manual'}],
  });
  expect(deriveSupplierBusinessModes(data, 'a')).toEqual(['dropship']);
});

it('does not infer inbound mode from a legacy purchase without an explicit fulfillment mode', () => {
  const data = normalizeWorkbenchData({
    suppliers: [{ id:'a',name:'历史供应商',categories:[],riskTags:[],createdAt:'' }],
    supplierBusinessRecords: [{id:'legacy',kind:'purchase',supplierIds:['a'],offerIds:[],productScope:'历史商品',status:'completed',title:'历史采购',owner:'',fields:{orderNo:'PO-OLD'},attachmentIds:[],revision:1,createdAt:'',updatedAt:''}],
  });
  expect(deriveSupplierBusinessModes(data, 'a')).toEqual([]);
});

it('shows routed product-period facts in the assigned supplier dropship section', () => {
  const data = normalizeWorkbenchData({
    suppliers: [{ id:'a',name:'代发供应商',categories:[],riskTags:[],createdAt:'' }],
    dropshipProductRoutings: [{id:'route',platform:'1688',productName:'透明收纳盒',normalizedProductName:'透明收纳盒',supplierId:'a',businessMode:'dropship',confirmedAt:''}],
    dropshipProductPeriods: [{id:'period',businessKey:'period',supplierId:'a',businessMode:'dropship',productName:'透明收纳盒',paidOrders:18,gmv:360,pickup48Rate:99,refundRate:2,sourceSheetName:'商品服务',sourceRowNumber:2,periodStart:'2026-09-04',periodEnd:'2026-09-18',platform:'1688',fileName:'履约.xlsx',importedAt:''}],
  });
  setWorkbenchSnapshot(data);
  render(<SupplierProfileWorkspace supplierId="a" onEdit={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'履约与改善'}));
  expect(screen.getByRole('link',{name:/查看代发业务记录/})).toBeTruthy();
});

it('hides inbound performance payload for a dropship-only supplier', () => {
  const data = normalizeWorkbenchData({
    suppliers: [{ id:'a',name:'代发供应商',categories:[],riskTags:[],createdAt:'' }],
    supplierBusinessRecords: [{id:'period',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'商品甲',status:'completed',title:'代发周期',owner:'',fields:{paidOrders:'30'},attachmentIds:[],revision:1,createdAt:'',updatedAt:''}],
  });
  setWorkbenchSnapshot(data);
  render(<SupplierProfileWorkspace supplierId="a" onEdit={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'履约与改善'}));
  expect(screen.getByText('代发履约历史入口')).toBeTruthy();
  expect(screen.queryByText('入仓履约历史入口')).toBeNull();
});

it('keeps supplier quality history separate from mode-specific business-period links', () => {
  const data = normalizeWorkbenchData({
    suppliers: [{ id:'a',name:'入仓供应商',categories:[],riskTags:[],createdAt:'' }],
    supplierBusinessRecords: [{id:'purchase',kind:'purchase',supplierIds:['a'],offerIds:[],productScope:'商品乙',status:'completed',title:'入仓采购',owner:'',fields:{fulfillmentMode:'warehouse'},attachmentIds:[],revision:1,createdAt:'',updatedAt:''}],
  });
  setWorkbenchSnapshot(data);
  render(<SupplierProfileWorkspace supplierId="a" onEdit={vi.fn()} performance={<div>质量原始凭证列表</div>} />);
  fireEvent.click(screen.getByRole('button',{name:'履约与改善'}));
  expect(screen.getByText('质量原始凭证列表')).toBeTruthy();
  expect(screen.getByRole('link',{name:/查看入仓业务记录/})).toBeTruthy();
  expect(screen.queryByText('入仓数量成本评分')).toBeNull();
});
