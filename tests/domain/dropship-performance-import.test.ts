import { describe, expect, it } from 'vitest';
import { applyDropshipImport, archiveSupplierProductRelationship, buildDropshipImportPreview, parseDropshipWorkbook } from '@/features/workbench/dropship-performance-import';
import { normalizeWorkbenchData } from '@/features/workbench/local-store';

const meta = { periodStart: '2026-09-04', periodEnd: '2026-09-18', platform: '1688', fileName: '代发供应商履约表.xlsx' };

describe('dropship performance workbook import', () => {
  it('recognizes merchant, product and after-sales sheets and merges annotation rows', () => {
    const result = parseDropshipWorkbook([
      { name: '任意商家页', rows: [
        ['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率','3分钟响应率'],
        ['1','供应商甲','12单/¥345.6','99.8%','50.8H','2.4%','4.8%','85.5%'],
        [null,null,null,null,'↑31H',null,null,null],
      ] },
      { name: '任意商品页', rows: [
        ['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],
        ['1','商品甲','8单/¥88','100%','40H','1%','0%'],
      ] },
      { name: '任意售后页', rows: [
        ['排行','商家名','售后量','售后率','售后拒绝量','售后拒绝率','平均退款时长（秒）','支付订单量','灯塔分_售后（5分制）','灯塔分_品质（5分制）','灯塔分_综合服务（5分制）'],
        ['1','供应商甲','3','2.41%','0','0%','1.5','124','4.67','4','4.35'],
      ] },
    ], meta);

    expect(result.merchants).toHaveLength(1);
    expect(result.products).toHaveLength(1);
    expect(result.afterSales).toHaveLength(1);
    expect(result.merchants[0]).toMatchObject({ supplierName: '供应商甲', paidOrders: 12, gmv: 345.6, pickup48Rate: 99.8, paymentToSignHours: 50.8, paymentToSignChangeHours: 31 });
    expect(result.products[0]).toMatchObject({ productName: '商品甲', paidOrders: 8, gmv: 88 });
    expect(result.afterSales[0]).toMatchObject({ supplierName: '供应商甲', afterSalesCount: 3, paidOrders: 124, lighthouseAfterSales: 4.67 });
    expect(result.issues).toEqual([]);
  });

  it('reports a sheet with a recognizable subject but missing required columns', () => {
    const result = parseDropshipWorkbook([{ name: '坏表', rows: [['排名','商家','主单/GMV'],['1','供应商甲','1单/¥10']] }], meta);
    expect(result.issues.some(issue => issue.severity === 'error' && issue.message.includes('缺少列'))).toBe(true);
  });

  it('converts Excel percentage fractions and time fractions without losing blank or zero values', () => {
    const result = parseDropshipWorkbook([
      { name:'商家', rows:[
        ['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率','3分钟响应率'],
        ['1','江苏新丰之星膜材料有限公司','40单/¥555.5',1,'53.4H',0.143,0,0],
      ] },
      { name:'售后', rows:[
        ['排行','商家名','售后量','售后率','售后拒绝量','售后拒绝率','平均退款时长（秒）','支付订单量','灯塔分_售后（5分制）','灯塔分_品质（5分制）','灯塔分_综合服务（5分制）'],
        ['1','新丰之星装饰材料',3,0.1154,0,0,0.0177141203703703,26,4,3.33,3.9],
      ] },
    ], meta);
    expect(result.merchants[0]).toMatchObject({ pickup48Rate:100, refundRate:14.3, rejectReturnRate:0, response3mRate:0 });
    expect(result.afterSales[0]).toMatchObject({ afterSalesRate:11.54, afterSalesRejectRate:0, averageRefundSeconds:1530 });
  });

  it('merges manually mapped merchant and after-sales aliases into one idempotent period record', () => {
    const parsed = parseDropshipWorkbook([
      { name:'商家', rows:[['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率','3分钟响应率'],['1','江苏新丰之星膜材料有限公司','40单/¥555.5',1,'53.4H',0.143,0,0]] },
      { name:'售后', rows:[['排行','商家名','售后量','售后率','售后拒绝量','售后拒绝率','平均退款时长（秒）','支付订单量','灯塔分_售后（5分制）','灯塔分_品质（5分制）','灯塔分_综合服务（5分制）'],['1','新丰之星装饰材料',3,0.1154,0,0,0.0177141203703703,26,4,3.33,3.9]] },
    ], meta);
    const supplier = { id:'jiangsu', name:'江苏新丰之星膜材料有限公司', categories:[], riskTags:[], createdAt:'' };
    const data = normalizeWorkbenchData({ suppliers:[supplier] });
    const preview = buildDropshipImportPreview(parsed,data.suppliers,[]);
    const once = applyDropshipImport(data,preview,{'新丰之星装饰材料':'jiangsu'});
    const twice = applyDropshipImport(once,preview,{'新丰之星装饰材料':'jiangsu'});
    const periods = twice.supplierBusinessRecords!.filter(record => record.kind === 'dropship_period');
    expect(periods).toHaveLength(1);
    expect(periods[0].fields).toMatchObject({ paidOrders:'40', gmv:'555.5', pickup48Rate:'100', refundRate:'14.3', afterSalesCount:'3', afterSalesRate:'11.54', averageRefundSeconds:'1530', lighthouseAfterSales:'4', lighthouseQuality:'3.33', lighthouseScore:'3.9' });
  });

  it('matches exact suppliers, suggests similar names and applies filing thresholds', () => {
    const parsed = parseDropshipWorkbook([{ name: '商家', rows: [
      ['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率','3分钟响应率'],
      ['1','供应商甲有限公司','120单/¥1000','99%','30H','2%','0%','90%'],
      ['2','供应商乙旗舰店','20单/¥200','98%','40H','3%','0%','80%'],
      ['3','供应商丙','19单/¥50','97%','50H','4%','0%','70%'],
    ] }], meta);
    const suppliers = [
      { id:'a', name:'供应商甲有限公司', categories:[], riskTags:[], createdAt:'' },
      { id:'b', name:'供应商乙', categories:[], riskTags:[], createdAt:'' },
    ];
    const preview = buildDropshipImportPreview(parsed, suppliers, []);
    expect(preview.suppliers[0]).toMatchObject({ matchStatus:'exact', supplierId:'a', filingBand:'priority' });
    expect(preview.suppliers[1]).toMatchObject({ matchStatus:'suggested', suggestedSupplierId:'b', filingBand:'eligible' });
    expect(preview.suppliers[2]).toMatchObject({ matchStatus:'unmatched', filingBand:'insufficient' });
  });

  it('does not assign product rows and replaces an existing period record by business key', () => {
    const parsed = parseDropshipWorkbook([
      { name:'商家', rows:[['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','供应商甲','100单/¥800','99%','30H','2%','0%']] },
      { name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','商品甲','80单/¥600','98%','35H','3%','0%']] },
    ], meta);
    const supplier = { id:'a', name:'供应商甲', categories:[], riskTags:[], createdAt:'' };
    const existing = { id:'old', kind:'dropship_period' as const, supplierIds:['a'], offerIds:[], productScope:'全店代发', status:'completed' as const, title:'旧周期', owner:'', fields:{ sourceKey:'1688|2026-09-04|2026-09-18|a', paidOrders:'1' }, attachmentIds:[], revision:1, createdAt:'', updatedAt:'' };
    const data = normalizeWorkbenchData({ suppliers:[supplier], supplierBusinessRecords:[existing] });
    const preview = buildDropshipImportPreview(parsed, data.suppliers, data.supplierBusinessRecords ?? []);
    expect(preview.products[0].supplierId).toBeUndefined();
    expect(preview.suppliers[0].willReplace).toBe(true);
    const next = applyDropshipImport(data, preview, {});
    const periodRecords = next.supplierBusinessRecords!.filter(record => record.kind === 'dropship_period');
    expect(periodRecords).toHaveLength(1);
    expect(periodRecords[0].fields.paidOrders).toBe('100');
    expect(next.dropshipProductPeriods).toHaveLength(1);
  });

  it('ends a delisted product relationship and archives an otherwise inactive supplier without deleting history', () => {
    const data = normalizeWorkbenchData({
      suppliers:[{id:'a',name:'供应商甲',categories:[],riskTags:[],createdAt:''}],
      productSupplierAssignments:[{id:'rel',productFamilyKey:'p',supplierId:'a',role:'primary',effectiveFrom:'2026-01-01',status:'active',source:'manual'}],
      supplierBusinessRecords:[{id:'history',kind:'dropship_period',supplierIds:['a'],offerIds:[],productScope:'商品甲',status:'completed',title:'历史履约',owner:'',fields:{},attachmentIds:[],revision:1,createdAt:'',updatedAt:''}],
    });
    const next = archiveSupplierProductRelationship(data,'rel','2026-09-18');
    expect(next.productSupplierAssignments?.[0]).toMatchObject({status:'ended',effectiveTo:'2026-09-18'});
    expect(next.suppliers[0].archivedAt).toBeTruthy();
    expect(next.supplierBusinessRecords?.map(record=>record.id)).toContain('history');
  });
});
