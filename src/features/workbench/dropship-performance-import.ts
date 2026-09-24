import type { LocalSupplier, LocalWorkbenchData } from './local-store';
import type { SupplierBusinessRecord } from './supplier-business';

export type DropshipImportMeta = { periodStart: string; periodEnd: string; platform: string; fileName: string };
export type SupplierBusinessMode = 'dropship' | 'inbound';
export type SupplierAliasMapping = {
  id: string;
  platform: string;
  sourceName: string;
  normalizedSourceName: string;
  supplierId: string;
  confirmedAt: string;
};
export type DropshipProductRouting = {
  id: string;
  platform: string;
  productName: string;
  normalizedProductName: string;
  supplierId: string;
  businessMode: SupplierBusinessMode;
  confirmedAt: string;
};
export type WorkbookSheet = { name: string; rows: unknown[][] };
export type DropshipImportIssue = { sheetName: string; rowNumber?: number; severity: 'warning' | 'error'; message: string };
type Source = { sourceSheetName: string; sourceRowNumber: number };
export type ImportSourceReference = { fileName: string; sheetName: string; rowNumber: number; sourceType: 'merchant' | 'afterSales' };
export type DropshipMerchantRow = Source & {
  supplierName: string; paidOrders?: number; gmv?: number; pickup48Rate?: number; paymentToSignHours?: number;
  paymentToSignChangeHours?: number; refundRate?: number; rejectReturnRate?: number; response3mRate?: number;
};
export type DropshipProductRow = Source & {
  productName: string; paidOrders?: number; gmv?: number; pickup48Rate?: number; paymentToSignHours?: number;
  paymentToSignChangeHours?: number; refundRate?: number; rejectReturnRate?: number;
};
export type DropshipAfterSalesRow = Source & {
  supplierName: string; afterSalesCount?: number; afterSalesRate?: number; afterSalesRejectCount?: number;
  afterSalesRejectRate?: number; averageRefundSeconds?: number; paidOrders?: number; lighthouseAfterSales?: number;
  lighthouseQuality?: number; lighthouseService?: number;
};
export type ParsedDropshipWorkbook = DropshipImportMeta & {
  merchants: DropshipMerchantRow[]; products: DropshipProductRow[]; afterSales: DropshipAfterSalesRow[]; issues: DropshipImportIssue[];
};
export type FilingBand = 'unknown' | 'insufficient' | 'eligible' | 'priority';
export type SupplierImportPreviewRow = {
  sourceName: string; merchant?: DropshipMerchantRow; afterSales?: DropshipAfterSalesRow;
  merchantRows?: DropshipMerchantRow[]; afterSalesRows?: DropshipAfterSalesRow[];
  matchStatus: 'exact' | 'suggested' | 'unmatched'; routingStatus: 'exact' | 'alias' | 'suggested' | 'unmatched'; supplierId?: string; suggestedSupplierId?: string;
  filingBand: FilingBand; businessKey?: string; willReplace: boolean;
};
export type PendingDropshipSupplier = {
  id: string; sourceName: string; platform: string; periodStart: string; periodEnd: string;
  paidOrders?: number; gmv?: number; filingBand: FilingBand; sourceFileName: string; sourceReferences?: ImportSourceReference[]; createdAt: string;
  status?: 'active' | 'observing' | 'resolved' | 'archived'; handledAt?: string; linkedSupplierId?: string;
  pickup48Rate?: number; paymentToSignHours?: number; refundRate?: number; rejectReturnRate?: number; response3mRate?: number;
  afterSalesCount?: number; afterSalesRate?: number; afterSalesRejectCount?: number; afterSalesRejectRate?: number; averageRefundSeconds?: number;
  lighthouseAfterSales?: number; lighthouseQuality?: number; lighthouseScore?: number;
};
export type DropshipProductPeriod = DropshipProductRow & DropshipImportMeta & { id: string; businessKey: string; supplierId?: string; businessMode?: SupplierBusinessMode; importedAt: string };
export type DropshipRoutingDecision = {
  suppliers: Record<string, string>;
  products: Record<string, { selected?: boolean; supplierId?: string; businessMode: SupplierBusinessMode }>;
};
export type DropshipImportPreview = ParsedDropshipWorkbook & {
  suppliers: SupplierImportPreviewRow[];
  products: Array<DropshipProductRow & { supplierId?: string; businessMode: SupplierBusinessMode }>;
  counts: { sourceRows: number; effectiveRecords: number; matchedSuppliers: number; pendingSuppliers: number; unroutedProducts: number };
  blockingIssues: string[];
};

const text = (value: unknown) => value == null ? '' : String(value).trim();
const number = (value: unknown) => {
  const cleaned = text(value).replace(/[,%¥￥Hh单]/g, '').replace(/,/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const percentage = (value: unknown) => {
  const parsed = number(value);
  if (parsed == null) return undefined;
  const normalized = typeof value === 'string' && value.includes('%') ? parsed : Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return Math.round(normalized * 10000) / 10000;
};
const seconds = (value: unknown) => {
  const parsed = number(value);
  return parsed == null ? undefined : parsed > 0 && parsed < 1 ? Math.round(parsed * 86400) : parsed;
};
const ordersAndGmv = (value: unknown) => {
  const match = text(value).replace(/,/g, '').match(/([\d.]+)\s*单\s*[/／]\s*[¥￥]?\s*([\d.]+)/);
  return { paidOrders: match ? Number(match[1]) : undefined, gmv: match ? Number(match[2]) : undefined };
};
const headers = (row: unknown[] = []) => row.map(text);
const col = (header: string[], name: string) => header.indexOf(name);
const value = (row: unknown[], header: string[], name: string) => row[col(header, name)];
const source = (sheetName: string, rowNumber: number): Source => ({ sourceSheetName: sheetName, sourceRowNumber: rowNumber });
const missing = (header: string[], required: string[]) => required.filter(name => !header.includes(name));

export function parseDropshipWorkbook(sheets: WorkbookSheet[], meta: DropshipImportMeta): ParsedDropshipWorkbook {
  const result: ParsedDropshipWorkbook = { ...meta, merchants: [], products: [], afterSales: [], issues: [] };
  for (const sheet of sheets) {
    const header = headers(sheet.rows[0]);
    const subject = header.includes('商家') ? 'merchant' : header.includes('商品信息') ? 'product' : header.includes('商家名') ? 'afterSales' : '';
    if (!subject) { result.issues.push({ sheetName: sheet.name, severity: 'warning', message: '未识别工作表类型，已跳过' }); continue; }
    const required = subject === 'merchant' ? ['商家','主单/GMV','48H揽收率','支签时长','退款率','拒退率'] : subject === 'product' ? ['商品信息','主单/GMV','48H揽收率','支签时长','退款率','拒退率'] : ['商家名','售后量','售后率','支付订单量'];
    const absent = missing(header, required);
    if (absent.length) { result.issues.push({ sheetName: sheet.name, severity: 'error', message: `缺少列：${absent.join('、')}` }); continue; }
    let previous: DropshipMerchantRow | DropshipProductRow | undefined;
    sheet.rows.slice(1).forEach((row, index) => {
      const rowNumber = index + 2;
      if (!text(row[0]) && previous) {
        const change = text(value(row, header, '支签时长')).match(/([↑↓])\s*([\d.]+)H/i);
        if (change) previous.paymentToSignChangeHours = Number(change[2]) * (change[1] === '↓' ? -1 : 1);
        return;
      }
      if (subject === 'merchant') {
        const supplierName = text(value(row, header, '商家')); if (!supplierName) return;
        const scale = ordersAndGmv(value(row, header, '主单/GMV'));
        previous = { ...source(sheet.name,rowNumber), supplierName, ...scale, pickup48Rate:percentage(value(row,header,'48H揽收率')), paymentToSignHours:number(value(row,header,'支签时长')), refundRate:percentage(value(row,header,'退款率')), rejectReturnRate:percentage(value(row,header,'拒退率')), response3mRate:percentage(value(row,header,'3分钟响应率')) };
        result.merchants.push(previous as DropshipMerchantRow);
      } else if (subject === 'product') {
        const productName = text(value(row, header, '商品信息')); if (!productName) return;
        const scale = ordersAndGmv(value(row, header, '主单/GMV'));
        previous = { ...source(sheet.name,rowNumber), productName, ...scale, pickup48Rate:percentage(value(row,header,'48H揽收率')), paymentToSignHours:number(value(row,header,'支签时长')), refundRate:percentage(value(row,header,'退款率')), rejectReturnRate:percentage(value(row,header,'拒退率')) };
        result.products.push(previous as DropshipProductRow);
      } else {
        const supplierName = text(value(row, header, '商家名')); if (!supplierName) return;
        result.afterSales.push({ ...source(sheet.name,rowNumber), supplierName, afterSalesCount:number(value(row,header,'售后量')), afterSalesRate:percentage(value(row,header,'售后率')), afterSalesRejectCount:number(value(row,header,'售后拒绝量')), afterSalesRejectRate:percentage(value(row,header,'售后拒绝率')), averageRefundSeconds:seconds(value(row,header,'平均退款时长（秒）')), paidOrders:number(value(row,header,'支付订单量')), lighthouseAfterSales:number(value(row,header,'灯塔分_售后（5分制）')), lighthouseQuality:number(value(row,header,'灯塔分_品质（5分制）')), lighthouseService:number(value(row,header,'灯塔分_综合服务（5分制）')) });
      }
    });
  }
  return result;
}

const normalizeName = (name: string) => name.toLowerCase().replace(/[\s（）()]/g, '').replace(/(旗舰店|有限公司|有限责任公司|个体工商户)$/g, '');
const productRelationshipKey = (platform: string, normalizedProductName: string, supplierId: string, businessMode: SupplierBusinessMode) =>
  [platform, normalizedProductName, supplierId, businessMode].join('|');
const band = (orders?: number): FilingBand => orders == null ? 'unknown' : orders >= 100 ? 'priority' : orders >= 20 ? 'eligible' : 'insufficient';
const sourceKey = (meta: DropshipImportMeta, supplierId: string) => [meta.platform,meta.periodStart,meta.periodEnd,supplierId].join('|');
const sum = <T>(rows: T[], read: (row: T) => number | undefined) => {
  const values = rows.map(read).filter((item): item is number => item != null);
  return values.length ? values.reduce((total,item) => total + item, 0) : undefined;
};
const weighted = <T>(rows: T[], read: (row: T) => number | undefined, weight: (row: T) => number | undefined) => {
  const values = rows.map(row => ({ value:read(row), weight:weight(row) })).filter((item): item is { value:number; weight:number | undefined } => item.value != null);
  if (!values.length) return undefined;
  const weightedValues = values.filter(item => item.weight != null && item.weight > 0);
  if (weightedValues.length === values.length) {
    const totalWeight = weightedValues.reduce((total,item) => total + (item.weight ?? 0), 0);
    return Math.round(weightedValues.reduce((total,item) => total + item.value * (item.weight ?? 0), 0) / totalWeight * 10000) / 10000;
  }
  return Math.round(values.reduce((total,item) => total + item.value, 0) / values.length * 10000) / 10000;
};
const aggregateMerchants = (rows: DropshipMerchantRow[]) => rows.length ? {
  ...rows[0],
  paidOrders:sum(rows,row => row.paidOrders), gmv:sum(rows,row => row.gmv),
  pickup48Rate:weighted(rows,row => row.pickup48Rate,row => row.paidOrders),
  paymentToSignHours:weighted(rows,row => row.paymentToSignHours,row => row.paidOrders),
  paymentToSignChangeHours:weighted(rows,row => row.paymentToSignChangeHours,row => row.paidOrders),
  refundRate:weighted(rows,row => row.refundRate,row => row.paidOrders),
  rejectReturnRate:weighted(rows,row => row.rejectReturnRate,row => row.paidOrders),
  response3mRate:weighted(rows,row => row.response3mRate,row => row.paidOrders),
} : undefined;
const aggregateAfterSales = (rows: DropshipAfterSalesRow[]) => rows.length ? {
  ...rows[0],
  afterSalesCount:sum(rows,row => row.afterSalesCount), afterSalesRejectCount:sum(rows,row => row.afterSalesRejectCount), paidOrders:sum(rows,row => row.paidOrders),
  afterSalesRate:weighted(rows,row => row.afterSalesRate,row => row.paidOrders),
  afterSalesRejectRate:weighted(rows,row => row.afterSalesRejectRate,row => row.paidOrders),
  averageRefundSeconds:weighted(rows,row => row.averageRefundSeconds,row => row.afterSalesCount),
  lighthouseAfterSales:weighted(rows,row => row.lighthouseAfterSales,row => row.paidOrders),
  lighthouseQuality:weighted(rows,row => row.lighthouseQuality,row => row.paidOrders),
  lighthouseService:weighted(rows,row => row.lighthouseService,row => row.paidOrders),
} : undefined;

export function buildDropshipImportPreview(
  parsed: ParsedDropshipWorkbook,
  suppliers: LocalSupplier[],
  existingRecords: SupplierBusinessRecord[],
  aliasMappings: SupplierAliasMapping[] = [],
  productRoutings: DropshipProductRouting[] = [],
): DropshipImportPreview {
  const groups = new Map<string, { sourceName: string; merchantRows: DropshipMerchantRow[]; afterSalesRows: DropshipAfterSalesRow[] }>();
  const blockingIssues: string[] = [];
  const supplierIds = new Set(suppliers.map(item => item.id));
  const aliasesFor = (sourceName: string) => aliasMappings.filter(item => item.platform === parsed.platform && item.normalizedSourceName === normalizeName(sourceName) && supplierIds.has(item.supplierId));
  const resolution = (sourceName: string) => {
    const exact = suppliers.find(item => item.name.trim().toLowerCase() === sourceName.trim().toLowerCase());
    if (exact) return { key:`supplier:${exact.id}`, supplierId:exact.id, status:'exact' as const };
    const aliases = aliasesFor(sourceName);
    const targets = [...new Set(aliases.map(item => item.supplierId))];
    if (targets.length > 1) blockingIssues.push(`别名冲突：${sourceName}`);
    if (targets.length === 1) return { key:`supplier:${targets[0]}`, supplierId:targets[0], status:'alias' as const };
    const normalized = normalizeName(sourceName);
    const suggested = suppliers.find(item => normalizeName(item.name) === normalized || normalizeName(item.name).includes(normalized) || normalized.includes(normalizeName(item.name)));
    return { key:`source:${normalized}`, suggestedSupplierId:suggested?.id, status:suggested ? 'suggested' as const : 'unmatched' as const };
  };
  for (const merchant of parsed.merchants) {
    const resolved = resolution(merchant.supplierName);
    const current = groups.get(resolved.key) ?? { sourceName:merchant.supplierName, merchantRows:[], afterSalesRows:[] };
    current.merchantRows.push(merchant); groups.set(resolved.key,current);
  }
  for (const afterSales of parsed.afterSales) {
    const resolved = resolution(afterSales.supplierName); const current = groups.get(resolved.key);
    const group = current ?? { sourceName:afterSales.supplierName, merchantRows:[], afterSalesRows:[] };
    group.afterSalesRows.push(afterSales); groups.set(resolved.key,group);
  }
  const supplierRows = [...groups.values()].map(group => {
    const merchant = aggregateMerchants(group.merchantRows); const afterSales = aggregateAfterSales(group.afterSalesRows);
    const names = [...group.merchantRows.map(row => row.supplierName), ...group.afterSalesRows.map(row => row.supplierName)];
    const resolutions = names.map(resolution);
    const matched = resolutions.find(item => item.status === 'alias') ?? resolutions.find(item => item.supplierId);
    const suggested = resolutions.find(item => item.suggestedSupplierId);
    const matchedId = matched?.supplierId;
    const businessKey = matchedId ? sourceKey(parsed, matchedId) : undefined;
    const paidOrders = merchant?.paidOrders ?? afterSales?.paidOrders;
    const routingStatus = matched?.status ?? suggested?.status ?? 'unmatched';
    const matchStatus = routingStatus === 'alias' ? 'exact' : routingStatus;
    return { ...group, merchant, afterSales, matchStatus, routingStatus, supplierId:matchedId, suggestedSupplierId:suggested?.suggestedSupplierId, filingBand:band(paidOrders), businessKey, willReplace:Boolean(businessKey && existingRecords.some(record => record.kind === 'dropship_period' && record.fields.sourceKey === businessKey)) };
  });
  const products = parsed.products.map(product => {
    const routings = productRoutings.filter(item => item.platform === parsed.platform && item.normalizedProductName === normalizeName(product.productName) && supplierIds.has(item.supplierId));
    const routing = routings.length === 1 ? routings[0] : undefined;
    return { ...product, supplierId:routing?.supplierId, businessMode:routing?.businessMode ?? 'dropship' as const };
  });
  const matchedSuppliers = supplierRows.filter(row => Boolean(row.supplierId)).length;
  return {
    ...parsed,
    suppliers:supplierRows,
    products,
    blockingIssues:[...new Set(blockingIssues)],
    counts:{
      sourceRows:parsed.merchants.length + parsed.afterSales.length + parsed.products.length,
      effectiveRecords:supplierRows.length + products.length,
      matchedSuppliers,
      pendingSuppliers:supplierRows.length - matchedSuppliers,
      unroutedProducts:products.filter(product => !product.supplierId).length,
    },
  };
}

const str = (value: unknown) => value == null ? '' : String(value);
const sourceReferences = (row: SupplierImportPreviewRow, fileName: string): ImportSourceReference[] => [
  ...(row.merchantRows ?? (row.merchant ? [row.merchant] : [])).map(item => ({ fileName, sheetName:item.sourceSheetName, rowNumber:item.sourceRowNumber, sourceType:'merchant' as const })),
  ...(row.afterSalesRows ?? (row.afterSales ? [row.afterSales] : [])).map(item => ({ fileName, sheetName:item.sourceSheetName, rowNumber:item.sourceRowNumber, sourceType:'afterSales' as const })),
].filter((item): item is ImportSourceReference => Boolean(item));
const mergeSourceReferences = (existing: string | undefined, incoming: ImportSourceReference[]) => {
  let previous: ImportSourceReference[] = [];
  try { previous = existing ? JSON.parse(existing) as ImportSourceReference[] : []; } catch { previous = []; }
  const byKey = new Map([...previous, ...incoming].map(item => [`${item.fileName}|${item.sheetName}|${item.rowNumber}|${item.sourceType}`, item]));
  return [...byKey.values()];
};
function importedRecord(row: SupplierImportPreviewRow, supplierId: string, preview: DropshipImportPreview, existing?: SupplierBusinessRecord): SupplierBusinessRecord {
  const now = new Date().toISOString(); const merchant = row.merchant; const afterSales = row.afterSales;
  const references = mergeSourceReferences(existing?.fields.sourceReferences, sourceReferences(row, preview.fileName));
  const candidate = { sourceKey:sourceKey(preview,supplierId), periodStart:preview.periodStart, periodEnd:preview.periodEnd, platform:preview.platform, dataSource:`${preview.fileName}；${[merchant?.sourceSheetName,afterSales?.sourceSheetName].filter(Boolean).join('、')}`, sourceReferences:JSON.stringify(references), paidOrders:str(merchant?.paidOrders ?? existing?.fields.paidOrders ?? afterSales?.paidOrders), gmv:str(merchant?.gmv ?? existing?.fields.gmv), pickup48Rate:str(merchant?.pickup48Rate), paymentToSignHours:str(merchant?.paymentToSignHours), paymentToSignChangeHours:str(merchant?.paymentToSignChangeHours), refundRate:str(merchant?.refundRate), rejectReturnRate:str(merchant?.rejectReturnRate), response3mRate:str(merchant?.response3mRate), afterSalesCount:str(afterSales?.afterSalesCount), afterSalesRate:str(afterSales?.afterSalesRate), rejectedAfterSalesCount:str(afterSales?.afterSalesRejectCount), rejectedAfterSalesRate:str(afterSales?.afterSalesRejectRate), averageRefundSeconds:str(afterSales?.averageRefundSeconds), lighthouseAfterSales:str(afterSales?.lighthouseAfterSales), lighthouseQuality:str(afterSales?.lighthouseQuality), lighthouseScore:str(afterSales?.lighthouseService), evidenceNote:'Excel批量导入' };
  const fields = { ...(existing?.fields ?? {}) };
  for (const [key,value] of Object.entries(candidate)) if (value !== '') fields[key] = value;
  const record: SupplierBusinessRecord = {
    id: existing?.id || crypto.randomUUID(), kind:'dropship_period', supplierIds:[supplierId], offerIds:[], productScope:'全店代发', status:'completed',
    title:`${preview.periodStart} 至 ${preview.periodEnd} · ${preview.platform}`, owner:'', attachmentIds:[], revision:(existing?.revision || 0) + 1, createdAt:existing?.createdAt || now, updatedAt:now,
    fields
  };
  if (existing && JSON.stringify(existing.fields) === JSON.stringify(record.fields) && JSON.stringify(existing.supplierIds) === JSON.stringify(record.supplierIds)) return existing;
  return record;
}

export function applyDropshipImport(data: LocalWorkbenchData, preview: DropshipImportPreview, decisions: DropshipRoutingDecision | Record<string,string>): LocalWorkbenchData {
  const structured = 'suppliers' in decisions || 'products' in decisions;
  const supplierDecisions = structured ? (decisions as DropshipRoutingDecision).suppliers ?? {} : decisions as Record<string,string>;
  const productDecisions = structured ? (decisions as DropshipRoutingDecision).products ?? {} : {};
  const validationIssues = [...preview.blockingIssues];
  const supplierIds = new Set(data.suppliers.map(item => item.id));
  for (const row of preview.suppliers) {
    const supplierId = row.supplierId || supplierDecisions[row.sourceName];
    if (supplierId && !supplierIds.has(supplierId)) validationIssues.push(`供应商“${row.sourceName}”关联的供应商档案不存在`);
  }
  for (const [productName, decision] of Object.entries(productDecisions)) {
    if (decision.selected && !decision.supplierId) validationIssues.push(`商品“${productName}”未选择供应商`);
    if (decision.selected !== false && decision.supplierId && !supplierIds.has(decision.supplierId)) validationIssues.push(`商品“${productName}”关联的供应商档案不存在`);
  }
  for (const row of preview.products) {
    const decision = productDecisions[row.productName];
    if (!decision && row.supplierId && !supplierIds.has(row.supplierId)) validationIssues.push(`商品“${row.productName}”关联的供应商档案不存在`);
  }
  if (validationIssues.length) throw new Error(validationIssues.join('；'));
  const existing = data.supplierBusinessRecords ?? []; const nextRecords = [...existing];
  const pending: PendingDropshipSupplier[] = [...(data.pendingDropshipSuppliers ?? [])];
  const aliasMappings = [...(data.supplierAliasMappings ?? [])];
  for (const row of preview.suppliers) {
    const supplierId = row.supplierId || supplierDecisions[row.sourceName];
    if (supplierId) {
      const key = sourceKey(preview,supplierId); const old = nextRecords.find(record => record.kind === 'dropship_period' && record.fields.sourceKey === key);
      const record = importedRecord(row,supplierId,preview,old);
      const index = old ? nextRecords.indexOf(old) : -1; if (index >= 0) nextRecords[index] = record; else nextRecords.unshift(record);
      for (const sourceName of [row.merchant?.supplierName, row.afterSales?.supplierName].filter((item): item is string => Boolean(item))) {
        const normalizedSourceName = normalizeName(sourceName);
        const mapping: SupplierAliasMapping = { id:`${preview.platform}|${normalizedSourceName}`, platform:preview.platform, sourceName, normalizedSourceName, supplierId, confirmedAt:new Date().toISOString() };
        const mappingIndex = aliasMappings.findIndex(item => item.platform === preview.platform && item.normalizedSourceName === normalizedSourceName);
        if (mappingIndex >= 0) {
          const old = aliasMappings[mappingIndex];
          if (old.supplierId !== supplierId) aliasMappings[mappingIndex] = { ...old, ...mapping, id:old.id };
        } else aliasMappings.push(mapping);
      }
    } else {
      const pendingKey = [preview.platform,preview.periodStart,preview.periodEnd,normalizeName(row.sourceName)].join('|');
      const index = pending.findIndex(value => value.id === pendingKey); const old = index >= 0 ? pending[index] : undefined;
      const item: PendingDropshipSupplier = { id:pendingKey, sourceName:row.sourceName, platform:preview.platform, periodStart:preview.periodStart, periodEnd:preview.periodEnd, paidOrders:row.merchant?.paidOrders ?? row.afterSales?.paidOrders, gmv:row.merchant?.gmv, filingBand:row.filingBand, sourceFileName:preview.fileName, sourceReferences:sourceReferences(row,preview.fileName), createdAt:old?.createdAt ?? new Date().toISOString(), status:'active', pickup48Rate:row.merchant?.pickup48Rate, paymentToSignHours:row.merchant?.paymentToSignHours, refundRate:row.merchant?.refundRate, rejectReturnRate:row.merchant?.rejectReturnRate, response3mRate:row.merchant?.response3mRate, afterSalesCount:row.afterSales?.afterSalesCount, afterSalesRate:row.afterSales?.afterSalesRate, afterSalesRejectCount:row.afterSales?.afterSalesRejectCount, afterSalesRejectRate:row.afterSales?.afterSalesRejectRate, averageRefundSeconds:row.afterSales?.averageRefundSeconds, lighthouseAfterSales:row.afterSales?.lighthouseAfterSales, lighthouseQuality:row.afterSales?.lighthouseQuality, lighthouseScore:row.afterSales?.lighthouseService };
      if (index >= 0) pending[index] = JSON.stringify(old) === JSON.stringify(item) ? old! : item; else pending.unshift(item);
    }
  }
  const products = [...(data.dropshipProductPeriods ?? [])];
  const productRoutings = [...(data.dropshipProductRoutings ?? [])];
  for (const row of preview.products) {
    const decision = productDecisions[row.productName];
    const isRouted = decision ? decision.selected !== false && Boolean(decision.supplierId) : Boolean(row.supplierId);
    if (!isRouted) continue;
    const supplierId = decision?.supplierId ?? row.supplierId;
    const businessMode = decision?.businessMode ?? row.businessMode;
    const normalizedProductName = normalizeName(row.productName);
    const relationshipKey = productRelationshipKey(preview.platform, normalizedProductName, supplierId!, businessMode);
    const businessKey = [preview.periodStart,preview.periodEnd,relationshipKey].join('|');
    const item: DropshipProductPeriod = { ...row, supplierId, businessMode, periodStart:preview.periodStart, periodEnd:preview.periodEnd, platform:preview.platform, fileName:preview.fileName, id:businessKey, businessKey, importedAt:new Date().toISOString() };
    const index = products.findIndex(value => value.businessKey === businessKey || (
      value.platform === preview.platform && value.periodStart === preview.periodStart && value.periodEnd === preview.periodEnd
      && normalizeName(value.productName) === normalizedProductName && value.supplierId === supplierId && value.businessMode === businessMode
    ));
    if (index >= 0) {
      const old = products[index]; const { importedAt:_oldImportedAt, ...oldComparable } = old; const { importedAt:_newImportedAt, ...newComparable } = item;
      if (JSON.stringify(oldComparable) !== JSON.stringify(newComparable)) products[index] = item;
    } else products.unshift(item);
    if (supplierId) {
      const mapping: DropshipProductRouting = { id:relationshipKey, platform:preview.platform, productName:row.productName, normalizedProductName, supplierId, businessMode, confirmedAt:new Date().toISOString() };
      const mappingIndex = productRoutings.findIndex(value => value.platform === preview.platform && value.normalizedProductName === normalizedProductName && value.supplierId === supplierId && value.businessMode === businessMode);
      if (mappingIndex >= 0) {
        const old = productRoutings[mappingIndex];
        if (old.supplierId !== supplierId || old.businessMode !== businessMode || old.productName !== row.productName) productRoutings[mappingIndex] = { ...old, ...mapping, id:old.id };
      } else productRoutings.push(mapping);
    }
  }
  return { ...data, supplierBusinessRecords:nextRecords, pendingDropshipSuppliers:pending, dropshipProductPeriods:products, supplierAliasMappings:aliasMappings, dropshipProductRoutings:productRoutings };
}

export function archiveSupplierProductRelationship(data: LocalWorkbenchData, relationshipId: string, effectiveTo: string): LocalWorkbenchData {
  const relationships = (data.productSupplierAssignments ?? []).map(item => item.id === relationshipId ? { ...item, status:'ended' as const, effectiveTo, reason:item.reason || '产品下架' } : item);
  const ended = relationships.find(item => item.id === relationshipId);
  if (!ended?.supplierId) return { ...data, productSupplierAssignments:relationships };
  const hasActiveRelationship = relationships.some(item => item.supplierId === ended.supplierId && item.status === 'active');
  return { ...data, productSupplierAssignments:relationships, suppliers:data.suppliers.map(supplier => supplier.id === ended.supplierId && !hasActiveRelationship ? { ...supplier, archivedAt:new Date().toISOString() } : supplier) };
}
