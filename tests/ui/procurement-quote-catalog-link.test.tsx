// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProcurementQuoteWorkspace } from '@/components/workbench/procurement-quote-workspace';
import { normalizeWorkbenchData } from '@/features/workbench/local-store';
import { newProcurementRecord } from '@/features/workbench/procurement';
import { setWorkbenchSnapshot } from '@/features/workbench/workbench-store';

vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <a {...props}>{children}</a> }));
afterEach(cleanup);

it('selects a specific catalog SKU and retains the adopted price in the procurement quote', () => {
  setWorkbenchSnapshot(normalizeWorkbenchData({ suppliers: [{id:'supplier-a',name:'供应商甲',categories:[],riskTags:[],createdAt:''}], offers: [{id:'offer-a',supplierId:'supplier-a',name:'双规格报价',skus:[{id:'small',specName:'小号',unitPrice:3},{id:'large',specName:'大号',unitPrice:5}],createdAt:''}] }));
  const quote = { ...newProcurementRecord('quote'), title: '白板贴询价', lineItems: [{id:'line-a',productName:'白板贴'}], supplierCandidates: [{id:'candidate-a',supplierId:'supplier-a',name:'供应商甲',source:'master' as const,status:'candidate' as const}] };
  const onCommit = vi.fn();
  render(<ProcurementQuoteWorkspace records={[quote]} onCommit={onCommit} onView={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'打开项目'}));
  fireEvent.click(screen.getByRole('button',{name:'录入报价'}));
  fireEvent.change(screen.getByLabelText('引用已有报价单的具体 SKU'),{target:{value:'offer-a::large'}});
  fireEvent.click(screen.getByRole('button',{name:'保存报价'}));
  expect(onCommit.mock.calls[0][0][0].quoteOffers[0]).toMatchObject({sourceOfferId:'offer-a',sourceOfferSkuId:'large',productUnitPrice:'5'});
});
