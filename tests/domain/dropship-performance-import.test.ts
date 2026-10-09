import { describe, expect, it, vi } from 'vitest';
import { applyDropshipImport, archiveSupplierProductRelationship, buildDropshipImportPreview, parseDropshipWorkbook } from '@/features/workbench/dropship-performance-import';
import { normalizeWorkbenchData } from '@/features/workbench/local-store';

const meta = { periodStart: '2026-09-04', periodEnd: '2026-09-18', platform: '1688', fileName: '代发供应商履约表.xlsx' };

describe('dropship performance workbook import', () => {
  it('preserves every non-empty source column alongside mapped metrics', () => {
    const parsed = parseDropshipWorkbook([{ name:'商家', rows:[
      ['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率','店铺层级','发货备注'],
      ['1','供应商甲','10单/¥100','100%','30H','1%','0%','金牌','当天发货'],
    ] }], meta);
    expect(parsed.merchants[0].rawFields).toMatchObject({ '排名':'1', '商家':'供应商甲', '店铺层级':'金牌', '发货备注':'当天发货' });
  });
  it('writes supplier and product short names during import and reuses them on later previews', () => {
    const parsed = parseDropshipWorkbook([{ name:'商家', rows:[['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','供应商甲','10单/¥100','100%','30H','1%','0%']] }, { name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','毛毡板','10单/¥100','100%','30H','1%','0%']] }], meta);
    const supplier = { id:'supplier-a', name:'供应商甲', categories:[], riskTags:[], createdAt:'' };
    const preview = buildDropshipImportPreview(parsed, [supplier], []);
    const next = applyDropshipImport(normalizeWorkbenchData({ suppliers:[supplier] }), preview, { suppliers:{'供应商甲':'supplier-a'}, supplierShortNames:{'供应商甲':'甲厂'}, products:{'毛毡板':{selected:true,supplierId:'supplier-a',businessMode:'dropship'}}, productShortNames:{'毛毡板':'毛毡'} });
    expect(next.suppliers[0].shortName).toBe('甲厂');
    expect(next.dropshipProductPeriods?.[0].shortName).toBe('毛毡');
  });
  it('supports saving product routing separately from supplier performance records', () => {
    const parsed = parseDropshipWorkbook([{ name:'商家', rows:[['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','供应商甲','10单/¥100','100%','30H','1%','0%']] }, { name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','毛毡板','10单/¥100','100%','30H','1%','0%']] }], meta);
    const supplier = { id:'supplier-a', name:'供应商甲', categories:[], riskTags:[], createdAt:'' };
    const preview = buildDropshipImportPreview(parsed, [supplier], []);
    const next = applyDropshipImport(normalizeWorkbenchData({ suppliers:[supplier] }), preview, { suppliers:{'供应商甲':'supplier-a'}, products:{'毛毡板':{selected:true,supplierId:'supplier-a',businessMode:'dropship'}} }, { mode:'product' });
    expect(next.dropshipProductPeriods).toHaveLength(1);
    expect(next.supplierBusinessRecords).toEqual([]);
  });
  it('uses a saved alias to merge merchant and after-sales rows', () => {
    const parsed = parseDropshipWorkbook([
      { name:'商家', rows:[['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','江苏新丰之星膜材料有限公司','40单/¥555.5','100%','53.4H','14.3%','0%']] },
      { name:'售后', rows:[['排行','商家名','售后量','售后率','支付订单量'],['1','新丰之星装饰材料','3','11.54%','26']] },
    ], meta);
    const supplier = { id:'jiangsu', name:'江苏新丰之星膜材料有限公司', categories:[], riskTags:[], createdAt:'' };
    const alias = { id:'alias-xinfeng', platform:'1688', sourceName:'新丰之星装饰材料', normalizedSourceName:'新丰之星装饰材料', supplierId:'jiangsu', confirmedAt:'2026-09-23T08:00:00.000Z' };

    const preview = buildDropshipImportPreview(parsed, [supplier], [], [alias], []);

    expect(preview.suppliers).toHaveLength(1);
    expect(preview.suppliers[0]).toMatchObject({ supplierId:'jiangsu', routingStatus:'alias' });
    expect(preview.suppliers[0].merchant?.paidOrders).toBe(40);
    expect(preview.suppliers[0].afterSales?.afterSalesCount).toBe(3);
  });

  it('reports source, effective, matched, pending and unrouted product counts', () => {
    const parsed = parseDropshipWorkbook([
      { name:'商家', rows:[['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','已建档供应商','30单/¥300','100%','30H','1%','0%'],['2','待建档供应商','20单/¥200','99%','40H','2%','0%']] },
      { name:'售后', rows:[['排行','商家名','售后量','售后率','支付订单量'],['1','已建档供应商','1','1%','30']] },
      { name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','已归位商品','10单/¥100','100%','30H','1%','0%'],['2','未归位商品','5单/¥50','100%','30H','1%','0%']] },
    ], meta);
    const supplier = { id:'formal', name:'已建档供应商', categories:[], riskTags:[], createdAt:'' };
    const routing = { id:'route-1', platform:'1688', productName:'已归位商品', normalizedProductName:'已归位商品', supplierId:'formal', businessMode:'dropship' as const, confirmedAt:'2026-09-23T08:00:00.000Z' };

    const preview = buildDropshipImportPreview(parsed, [supplier], [], [], [routing]);

    expect(preview.counts).toEqual({ sourceRows:5, effectiveRecords:4, matchedSuppliers:1, pendingSuppliers:1, unroutedProducts:1 });
  });

  it('routes a product to one supplier as dropship', () => {
    const parsed = parseDropshipWorkbook([{ name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','商品甲','10单/¥100','100%','30H','1%','0%']] }], meta);
    const supplier = { id:'supplier-a', name:'供应商甲', categories:[], riskTags:[], createdAt:'' };
    const data = normalizeWorkbenchData({ suppliers:[supplier] });
    const preview = buildDropshipImportPreview(parsed, data.suppliers, [], [], []);
    const decision = { products:{ 商品甲:{ supplierId:'supplier-a', businessMode:'dropship' as const } }, suppliers:{} };

    const next = applyDropshipImport(data, preview, decision);

    expect(next.dropshipProductPeriods?.[0]).toMatchObject({ supplierId:'supplier-a', businessMode:'dropship' });
    expect(next.dropshipProductRoutings).toHaveLength(1);
    expect(next.dropshipProductRoutings?.[0]).toMatchObject({ productName:'商品甲', supplierId:'supplier-a', businessMode:'dropship' });
  });

  it('preserves the same product for different supplier and business-mode relationships', () => {
    const parsed = parseDropshipWorkbook([{ name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','共用商品','10单/¥100','100%','30H','1%','0%']] }], meta);
    const suppliers = [
      { id:'supplier-a', name:'供应商甲', categories:[], riskTags:[], createdAt:'' },
      { id:'supplier-b', name:'供应商乙', categories:[], riskTags:[], createdAt:'' },
    ];
    const data = normalizeWorkbenchData({ suppliers });
    const preview = buildDropshipImportPreview(parsed, suppliers, [], [], []);

    const once = applyDropshipImport(data, preview, { suppliers:{}, products:{ 共用商品:{ supplierId:'supplier-a', businessMode:'dropship' } } });
    const twice = applyDropshipImport(once, preview, { suppliers:{}, products:{ 共用商品:{ supplierId:'supplier-b', businessMode:'inbound' } } });

    expect(twice.dropshipProductPeriods).toHaveLength(2);
    expect(twice.dropshipProductPeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({ supplierId:'supplier-a', businessMode:'dropship' }),
      expect.objectContaining({ supplierId:'supplier-b', businessMode:'inbound' }),
    ]));
    expect(twice.dropshipProductRoutings).toHaveLength(2);
  });

  it('upgrades a legacy product-period key in place for the same supplier relationship', () => {
    const parsed = parseDropshipWorkbook([{ name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','历史商品','12单/¥120','100%','30H','1%','0%']] }], meta);
    const supplier = { id:'supplier-a', name:'供应商甲', categories:[], riskTags:[], createdAt:'' };
    const legacyKey = '1688|2026-09-04|2026-09-18|历史商品';
    const data = normalizeWorkbenchData({
      suppliers:[supplier],
      dropshipProductPeriods:[{ id:legacyKey, businessKey:legacyKey, supplierId:'supplier-a', businessMode:'dropship', productName:'历史商品', paidOrders:10, sourceSheetName:'商品', sourceRowNumber:2, ...meta, importedAt:'' }],
    });
    const preview = buildDropshipImportPreview(parsed, data.suppliers, [], [], []);

    const next = applyDropshipImport(data, preview, { suppliers:{}, products:{ 历史商品:{ supplierId:'supplier-a', businessMode:'dropship' } } });

    expect(next.dropshipProductPeriods).toHaveLength(1);
    expect(next.dropshipProductPeriods?.[0]).toMatchObject({ paidOrders:12, supplierId:'supplier-a', businessMode:'dropship' });
    expect(next.dropshipProductPeriods?.[0].businessKey).not.toBe(legacyKey);
  });

  it('ignores stale saved mappings and rejects forged supplier decisions atomically', () => {
    const parsed = parseDropshipWorkbook([
      { name:'商家', rows:[['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','历史简称','10单/¥100','100%','30H','1%','0%']] },
      { name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','历史商品','10单/¥100','100%','30H','1%','0%']] },
    ], meta);
    const data = normalizeWorkbenchData({
      suppliers:[{ id:'active', name:'现有供应商', categories:[], riskTags:[], createdAt:'' }],
      supplierAliasMappings:[{ id:'alias', platform:'1688', sourceName:'历史简称', normalizedSourceName:'历史简称', supplierId:'deleted', confirmedAt:'' }],
      dropshipProductRoutings:[{ id:'route', platform:'1688', productName:'历史商品', normalizedProductName:'历史商品', supplierId:'deleted', businessMode:'dropship', confirmedAt:'' }],
    });
    const preview = buildDropshipImportPreview(parsed, data.suppliers, [], data.supplierAliasMappings, data.dropshipProductRoutings);

    expect(preview.suppliers[0].supplierId).toBeUndefined();
    expect(preview.products[0].supplierId).toBeUndefined();
    expect(() => applyDropshipImport(data, preview, {
      suppliers:{ 历史简称:'forged' },
      products:{ 历史商品:{ selected:true, supplierId:'forged', businessMode:'dropship' } },
    })).toThrow(/供应商档案不存在/);
    expect(data.supplierBusinessRecords).toEqual([]);
    expect(data.dropshipProductPeriods).toEqual([]);
  });

  it('blocks conflicting aliases and unrouted selected products', () => {
    const parsed = parseDropshipWorkbook([
      { name:'商家', rows:[['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','共同简称','10单/¥100','100%','30H','1%','0%']] },
      { name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','商品甲','10单/¥100','100%','30H','1%','0%']] },
    ], meta);
    const suppliers = [{ id:'a', name:'甲', categories:[], riskTags:[], createdAt:'' }, { id:'b', name:'乙', categories:[], riskTags:[], createdAt:'' }];
    const aliases = [
      { id:'one', platform:'1688', sourceName:'共同简称', normalizedSourceName:'共同简称', supplierId:'a', confirmedAt:'2026-09-23T08:00:00.000Z' },
      { id:'two', platform:'1688', sourceName:'共同简称', normalizedSourceName:'共同简称', supplierId:'b', confirmedAt:'2026-09-23T09:00:00.000Z' },
    ];
    const preview = buildDropshipImportPreview(parsed, suppliers, [], aliases, []);
    const data = normalizeWorkbenchData({ suppliers, supplierAliasMappings:aliases });

    expect(preview.blockingIssues.some(issue => issue.includes('别名冲突'))).toBe(true);
    expect(() => applyDropshipImport(data, preview, { suppliers:{}, products:{ 商品甲:{ selected:true, businessMode:'dropship' } } })).toThrow(/未选择供应商/);
  });

  it('re-imports the same period without duplicate records or mappings', () => {
    const parsed = parseDropshipWorkbook([
      { name:'商家', rows:[['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','供应商简称','10单/¥100','100%','30H','1%','0%']] },
      { name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','商品甲','10单/¥100','100%','30H','1%','0%']] },
    ], meta);
    const supplier = { id:'a', name:'供应商甲', categories:[], riskTags:[], createdAt:'' };
    const data = normalizeWorkbenchData({ suppliers:[supplier] });
    const preview = buildDropshipImportPreview(parsed, data.suppliers, [], [], []);
    const decisions = { suppliers:{ 供应商简称:'a' }, products:{ 商品甲:{ supplierId:'a', businessMode:'dropship' as const } } };

    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T08:00:00.000Z'));
    const once = applyDropshipImport(data, preview, decisions);
    vi.setSystemTime(new Date('2026-09-23T09:00:00.000Z'));
    const twice = applyDropshipImport(once, buildDropshipImportPreview(parsed, once.suppliers, once.supplierBusinessRecords ?? [], once.supplierAliasMappings, once.dropshipProductRoutings), decisions);
    vi.useRealTimers();

    expect(twice.supplierBusinessRecords?.filter(record => record.kind === 'dropship_period')).toHaveLength(1);
    expect(twice.dropshipProductPeriods).toHaveLength(1);
    expect(twice.supplierAliasMappings).toHaveLength(1);
    expect(twice.dropshipProductRoutings).toHaveLength(1);
    expect(twice.supplierBusinessRecords).toEqual(once.supplierBusinessRecords);
    expect(twice.dropshipProductPeriods).toEqual(once.dropshipProductPeriods);
    expect(twice.supplierAliasMappings).toEqual(once.supplierAliasMappings);
    expect(twice.dropshipProductRoutings).toEqual(once.dropshipProductRoutings);
  });

  it('preserves the complete snapshot when multiple source names normalize to one unchanged alias', () => {
    const parsed = parseDropshipWorkbook([
      { name:'商家', rows:[
        ['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],
        ['1','供应商甲有限公司','10单/¥100','100%','30H','1%','0%'],
        ['2','供应商甲','20单/¥200','100%','30H','1%','0%'],
      ] },
    ], meta);
    const supplier = { id:'a', name:'供应商甲有限公司', categories:[], riskTags:[], createdAt:'' };
    const alias = { id:'alias-a', platform:'1688', sourceName:'供应商甲', normalizedSourceName:'供应商甲', supplierId:'a', confirmedAt:'2026-09-23T08:00:00.000Z' };
    const data = normalizeWorkbenchData({ suppliers:[supplier], supplierAliasMappings:[alias] });
    const decisions = { suppliers:{}, products:{} };

    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T09:00:00.000Z'));
    const once = applyDropshipImport(data, buildDropshipImportPreview(parsed, data.suppliers, [], data.supplierAliasMappings, []), decisions);
    vi.setSystemTime(new Date('2026-09-23T10:00:00.000Z'));
    const twice = applyDropshipImport(once, buildDropshipImportPreview(parsed, once.suppliers, once.supplierBusinessRecords ?? [], once.supplierAliasMappings, []), decisions);
    vi.useRealTimers();

    expect(twice).toEqual(once);
    expect(twice.supplierAliasMappings?.[0].confirmedAt).toBe('2026-09-23T08:00:00.000Z');
  });

  it('aggregates every source row resolved to one supplier and retains every row reference', () => {
    const parsed = parseDropshipWorkbook([
      { name:'商家', rows:[
        ['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],
        ['1','供应商甲','10单/¥100','90%','20H','2%','0%'],
        ['2','甲方店铺','30单/¥600','100%','40H','4%','0%'],
      ] },
      { name:'售后', rows:[
        ['排行','商家名','售后量','售后率','支付订单量'],
        ['1','供应商甲','1','10%','10'],
        ['2','甲方店铺','3','10%','30'],
      ] },
    ], meta);
    const supplier = { id:'a', name:'供应商甲', categories:[], riskTags:[], createdAt:'' };
    const alias = { id:'alias-a', platform:'1688', sourceName:'甲方店铺', normalizedSourceName:'甲方店铺', supplierId:'a', confirmedAt:'2026-09-23T08:00:00.000Z' };
    const data = normalizeWorkbenchData({ suppliers:[supplier], supplierAliasMappings:[alias] });

    const preview = buildDropshipImportPreview(parsed, data.suppliers, [], data.supplierAliasMappings, []);
    const next = applyDropshipImport(data, preview, { suppliers:{}, products:{} });
    const record = next.supplierBusinessRecords?.[0];
    const references = JSON.parse(record?.fields.sourceReferences || '[]');

    expect(record?.fields).toMatchObject({ paidOrders:'40', gmv:'700', pickup48Rate:'97.5', paymentToSignHours:'35', refundRate:'3.5', afterSalesCount:'4', afterSalesRate:'10' });
    expect(references).toEqual([
      { fileName:meta.fileName, sheetName:'商家', rowNumber:2, sourceType:'merchant' },
      { fileName:meta.fileName, sheetName:'商家', rowNumber:3, sourceType:'merchant' },
      { fileName:meta.fileName, sheetName:'售后', rowNumber:2, sourceType:'afterSales' },
      { fileName:meta.fileName, sheetName:'售后', rowNumber:3, sourceType:'afterSales' },
    ]);
  });

  it('does not persist an explicitly unselected or unrouted product', () => {
    const parsed = parseDropshipWorkbook([{ name:'商品', rows:[['排名','商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','取消商品','10单/¥100','100%','30H','1%','0%'],['2','未归位商品','5单/¥50','100%','30H','1%','0%']] }], meta);
    const supplier = { id:'a', name:'供应商甲', categories:[], riskTags:[], createdAt:'' };
    const data = normalizeWorkbenchData({ suppliers:[supplier] });
    const preview = buildDropshipImportPreview(parsed, data.suppliers, [], [], []);

    const next = applyDropshipImport(data, preview, { suppliers:{}, products:{ 取消商品:{ selected:false, supplierId:'a', businessMode:'dropship' } } });

    expect(next.dropshipProductPeriods).toEqual([]);
    expect(next.dropshipProductRoutings).toEqual([]);
  });
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

  it('keeps blank and unparseable numeric cells unknown while preserving recorded zero', () => {
    const result = parseDropshipWorkbook([
      { name:'商家服务', rows:[
        ['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],
        ['1','空白供应商','', '', '', '', ''],
        ['2','异常供应商','不是数字', '无', '无', '无', '无'],
        ['3','零值供应商','0单/¥0', 0, 0, 0, 0],
      ] },
      { name:'售后服务', rows:[
        ['排行','商家名','售后量','售后率','售后拒绝量','售后拒绝率','平均退款时长（秒）','支付订单量'],
        ['1','空白售后','','','','','',''],
        ['2','零值售后',0,0,0,0,0,0],
      ] },
    ], meta);

    expect(result.merchants[0]).toMatchObject({ supplierName:'空白供应商', paidOrders:undefined, gmv:undefined, pickup48Rate:undefined });
    expect(result.merchants[1]).toMatchObject({ supplierName:'异常供应商', paidOrders:undefined, gmv:undefined, pickup48Rate:undefined });
    expect(result.merchants[2]).toMatchObject({ supplierName:'零值供应商', paidOrders:0, gmv:0, pickup48Rate:0 });
    expect(result.afterSales[0]).toMatchObject({ supplierName:'空白售后', afterSalesCount:undefined, afterSalesRejectCount:undefined, paidOrders:undefined });
    expect(result.afterSales[1]).toMatchObject({ supplierName:'零值售后', afterSalesCount:0, afterSalesRejectCount:0, paidOrders:0 });

    const preview = buildDropshipImportPreview(result, [], []);
    expect(preview.suppliers.find(row => row.sourceName === '空白供应商')?.filingBand).toBe('unknown');
    expect(preview.suppliers.find(row => row.sourceName === '零值供应商')?.filingBand).toBe('insufficient');
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

  it('does not assign or persist unrouted product rows and replaces an existing period record by business key', () => {
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
    expect(next.dropshipProductPeriods).toHaveLength(0);
  });

  it('persists file, sheet and row provenance for formal and pending records across replacement', () => {
    const parsed = parseDropshipWorkbook([
      { name:'商家服务', rows:[['排名','商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'],['1','正式供应商','100单/¥800','99%','30H','2%','0%'],['2','待建档供应商','30单/¥200','98%','40H','3%','0%']] },
      { name:'售后服务', rows:[['排行','商家名','售后量','售后率','支付订单量'],['1','正式供应商','2','2%','100']] },
    ], meta);
    const data = normalizeWorkbenchData({ suppliers:[{ id:'formal', name:'正式供应商', categories:[], riskTags:[], createdAt:'' }] });
    const preview = buildDropshipImportPreview(parsed, data.suppliers, []);
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T08:00:00.000Z'));
    const once = applyDropshipImport(data, preview, {});
    vi.setSystemTime(new Date('2026-09-23T09:00:00.000Z'));
    const twice = applyDropshipImport(once, preview, {});
    vi.useRealTimers();
    const record = twice.supplierBusinessRecords?.find(item => item.supplierIds.includes('formal'));
    const references = JSON.parse(record?.fields.sourceReferences || '[]');

    expect(references).toEqual(expect.arrayContaining([
      { fileName:meta.fileName, sheetName:'商家服务', rowNumber:2, sourceType:'merchant' },
      { fileName:meta.fileName, sheetName:'售后服务', rowNumber:2, sourceType:'afterSales' },
    ]));
    expect(record?.revision).toBe(1);
    expect(twice.pendingDropshipSuppliers).toEqual(once.pendingDropshipSuppliers);
    expect(twice.pendingDropshipSuppliers?.find(item => item.sourceName === '待建档供应商')?.sourceReferences).toEqual([
      { fileName:meta.fileName, sheetName:'商家服务', rowNumber:3, sourceType:'merchant' },
    ]);
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
