'use client';
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { applyDropshipImport, buildDropshipImportPreview, parseDropshipWorkbook, type DropshipImportMode, type DropshipImportPreview, type DropshipProductRow, type DropshipRoutingDecision, type SupplierBusinessMode } from '@/features/workbench/dropship-performance-import';
import { loadLocalWorkbenchData, saveLocalWorkbenchData } from '@/features/workbench/local-store';
import { BusinessRecordDialog, BusinessSection, businessInput, businessPrimary, businessSecondary } from './business-record-dialog';
import { procurementTable } from './procurement-line-details';

type Props = { onClose: () => void; onImported?: () => void; mode?: DropshipImportMode };
type Step = 'upload' | 'supplier' | 'product' | 'review';
type RoutedProduct = DropshipProductRow & { supplierId?: string; businessMode: SupplierBusinessMode };
const bandNames = { unknown:'数据待补', insufficient:'样本不足', eligible:'建议建档', priority:'重点候选' } as const;
const routingNames = { exact:'自动匹配', alias:'历史别名', suggested:'建议匹配', unmatched:'待处理' } as const;
const normalizeRoutingKey = (name:string) => name.toLowerCase().replace(/[\s（）()]/g,'').replace(/(旗舰店|有限公司|有限责任公司|个体工商户)$/g,'');
const structuralMessages = (preview:DropshipImportPreview) => [
  ...preview.blockingIssues,
  ...preview.issues.filter(issue=>issue.severity==='error').map(issue=>`${issue.sheetName}${issue.rowNumber?` 第${issue.rowNumber}行`:''}：${issue.message}`),
];

function buildReviewCounts(preview:DropshipImportPreview,decisions:DropshipRoutingDecision) {
  const supplierIds = new Set(preview.suppliers.map(row=>row.supplierId || decisions.suppliers[row.sourceName]).filter((value):value is string=>Boolean(value)));
  const pendingKeys = new Set(preview.suppliers.filter(row=>!(row.supplierId || decisions.suppliers[row.sourceName])).map(row=>[preview.platform,preview.periodStart,preview.periodEnd,normalizeRoutingKey(row.sourceName)].join('|')));
  const aliasKeys = new Set(preview.suppliers.flatMap(row=>row.supplierId || decisions.suppliers[row.sourceName] ? [...(row.merchantRows ?? []).map(item=>item.supplierName),...(row.afterSalesRows ?? []).map(item=>item.supplierName)].map(name=>`${preview.platform}|${normalizeRoutingKey(name)}`) : []));
  const routedProductKeys = new Set((preview.products as RoutedProduct[]).filter(row=>decisions.products[row.productName]?.selected && decisions.products[row.productName]?.supplierId).map(row=>`${preview.platform}|${normalizeRoutingKey(row.productName)}`));
  const unroutedProductKeys = new Set((preview.products as RoutedProduct[]).filter(row=>decisions.products[row.productName]?.selected && !decisions.products[row.productName]?.supplierId).map(row=>`${preview.platform}|${normalizeRoutingKey(row.productName)}`));
  return { formal:supplierIds.size, pending:pendingKeys.size, aliases:aliasKeys.size, routed:routedProductKeys.size, unresolved:pendingKeys.size+unroutedProductKeys.size+structuralMessages(preview).length };
}

export function DropshipPerformanceImportDialog({ onClose, onImported, mode = 'full' }: Props) {
  const [periodStart,setPeriodStart] = useState('2026-09-04');
  const [periodEnd,setPeriodEnd] = useState('2026-09-18');
  const [platform,setPlatform] = useState('1688');
  const [step,setStep] = useState<Step>('upload');
  const [preview,setPreview] = useState<DropshipImportPreview | null>(null);
  const [decisions,setDecisions] = useState<DropshipRoutingDecision>({suppliers:{},products:{}});
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const data = loadLocalWorkbenchData();
  const suppliers = data.suppliers;

  const parseFile = async (file?: File) => {
    if (!file) return;
    setError(''); setSuccess('');
    if (!periodStart || !periodEnd || periodStart > periodEnd) { setError('请填写有效的统计周期'); return; }
    if (!platform.trim()) { setError('请填写平台或店铺'); return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      const parsed = parseDropshipWorkbook(workbook.SheetNames.map(name => ({ name, rows:XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:null,raw:false}) as unknown[][] })), { periodStart,periodEnd,platform:platform.trim(),fileName:file.name });
      const next = buildDropshipImportPreview(parsed,data.suppliers,data.supplierBusinessRecords ?? [],data.supplierAliasMappings ?? [],data.dropshipProductRoutings ?? []);
      setDecisions({
        suppliers:Object.fromEntries(next.suppliers.filter(row=>row.supplierId).map(row=>[row.sourceName,row.supplierId!])),
        supplierShortNames:Object.fromEntries(next.suppliers.map(row=>[row.sourceName, data.suppliers.find(item=>item.id === row.supplierId)?.shortName ?? ''])),
        products:Object.fromEntries((next.products as RoutedProduct[]).map(row=>[row.productName,{selected:Boolean(row.supplierId),supplierId:row.supplierId,businessMode:row.businessMode}])),
        productShortNames:Object.fromEntries((next.products as RoutedProduct[]).map(row=>[row.productName, data.dropshipProductPeriods?.find(item=>item.productName === row.productName)?.shortName ?? data.skuMasters?.find(item=>item.productName === row.productName)?.shortName ?? '']))
      });
      setPreview(next); setStep('upload');
      const blocks = structuralMessages(next);
      if (blocks.length) setError(blocks.join('；'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '文件解析失败'); }
  };

  const goToReview = () => {
    if (!preview) return;
    const blocks = structuralMessages(preview);
    if (blocks.length) { setError(blocks.join('；')); return; }
    const invalid = preview.products.find(row=>decisions.products[row.productName]?.selected && !decisions.products[row.productName]?.supplierId);
    if (invalid) { setError(`商品“${invalid.productName}”未选择供应商`); return; }
    setError(''); setStep('review');
  };
  const confirm = () => {
    if (!preview || error || preview.issues.some(issue=>issue.severity==='error') || preview.blockingIssues.length) return;
    const matched = preview.suppliers.filter(row=>row.supplierId || decisions.suppliers[row.sourceName]).length;
    saveLocalWorkbenchData(applyDropshipImport(loadLocalWorkbenchData(),preview,decisions,{ mode }));
    onImported?.();
    if (mode === 'product') {
      const routed = preview.products.filter(row => decisions.products[row.productName]?.selected && decisions.products[row.productName]?.supplierId).length;
      setSuccess(`产品归属已保存：${routed} 条产品关系已写入。`);
    } else setSuccess(`履约数据已保存：${matched} 条进入周期履约，${preview.suppliers.length-matched} 条进入待建档区。`);
  };
  const resetPreview = () => { setPreview(null); setStep('upload'); setError(''); setSuccess(''); };
  const flow: Step[] = mode === 'product' ? ['upload','product','review'] : mode === 'performance' ? ['upload','supplier','review'] : ['upload','supplier','product','review'];
  const stepIndex = flow.indexOf(step);
  const footer = <>
    {stepIndex > 0 && <button type="button" className={businessSecondary} onClick={()=>setStep(flow[stepIndex - 1])}>上一步</button>}
    <button type="button" className={businessSecondary} onClick={onClose}>关闭</button>
    {preview && step==='upload' && <button type="button" className={businessPrimary} onClick={()=>setStep(flow[1])}>{mode === 'product' ? '下一步：商品归位' : '下一步：供应商归位'}</button>}
    {step==='supplier' && <button type="button" className={businessPrimary} disabled={Boolean(preview && structuralMessages(preview).length)} onClick={()=>setStep(mode === 'performance' ? 'review' : 'product')}>{mode === 'performance' ? '下一步：导入确认' : '下一步：商品归位'}</button>}
    {step==='product' && <button type="button" className={businessPrimary} onClick={goToReview}>下一步：导入确认</button>}
    {step==='review' && <button type="button" className={businessPrimary} disabled={!preview || Boolean(error) || Boolean(success)} onClick={confirm}>确认导入</button>}
  </>;

  return <BusinessRecordDialog title={mode === 'product' ? '导入产品归属' : mode === 'performance' ? '导入周期履约数据' : '批量导入周期履约'} onClose={onClose} footer={footer}>
    <StepBar step={step} mode={mode} />
    {step==='upload' && <>
      <BusinessSection title="上传与统计口径"><div className="grid gap-5 sm:grid-cols-3">
        <label className="text-sm">统计开始日期<input aria-label="统计开始日期" className={businessInput} type="date" value={periodStart} onChange={event=>{setPeriodStart(event.target.value);resetPreview();}} /></label>
        <label className="text-sm">统计结束日期<input aria-label="统计结束日期" className={businessInput} type="date" value={periodEnd} onChange={event=>{setPeriodEnd(event.target.value);resetPreview();}} /></label>
        <label className="text-sm">平台 / 店铺<input aria-label="平台 / 店铺" className={businessInput} value={platform} onChange={event=>{setPlatform(event.target.value);resetPreview();}} /></label>
      </div><label className="mt-4 inline-flex cursor-pointer items-center rounded-md border border-line px-4 py-2 text-sm text-action">选择履约文件<input aria-label="选择履约文件" accept=".xlsx,.xls,.csv" className="hidden" type="file" onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';void parseFile(file);}} /></label></BusinessSection>
      {preview && <BusinessSection title="工作簿读取结果"><div className="grid border border-line sm:grid-cols-4"><Metric label="商家服务 Sheet" value={`${preview.merchants.length} 行`} /><Metric label="商品服务 Sheet" value={`${preview.products.length} 行`} /><Metric label="商家售后 Sheet" value={`${preview.afterSales.length} 行`} /><Metric label="有效记录" value={`${preview.counts.effectiveRecords} 条`} /></div></BusinessSection>}
    </>}
    {preview && step==='supplier' && <BusinessSection title="供应商归位"><div className="overflow-x-auto"><table className={`${procurementTable} min-w-[980px]`}><thead><tr>{['来源商家','供应商简称','订单 / GMV','样本层级','识别结果','归属档案'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{preview.suppliers.map(row=><tr data-testid={`supplier-row-${row.sourceName}`} key={row.sourceName}><td>{row.sourceName}</td><td><input aria-label={`${row.sourceName}供应商简称`} className={businessInput} value={decisions.supplierShortNames?.[row.sourceName] ?? ''} placeholder="填写简称" onChange={event=>setDecisions(old=>({...old,supplierShortNames:{...old.supplierShortNames,[row.sourceName]:event.target.value}}))} /></td><td>{row.merchant?.paidOrders ?? row.afterSales?.paidOrders ?? '未采集'}单 / ¥{row.merchant?.gmv ?? '未采集'}</td><td>{bandNames[row.filingBand]}</td><td>{routingNames[row.routingStatus]}{row.willReplace?' · 覆盖同周期':''}</td><td><select aria-label={`${row.sourceName}归属档案`} className={businessInput} value={decisions.suppliers[row.sourceName] ?? ''} onChange={event=>setDecisions(old=>({...old,suppliers:{...old.suppliers,[row.sourceName]:event.target.value}}))}><option value="">进入待建档区</option>{suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.shortName ? `${supplier.shortName} · ` : ''}{supplier.name}{row.suggestedSupplierId===supplier.id?'（建议）':''}</option>)}</select></td></tr>)}</tbody></table></div></BusinessSection>}
    {preview && step==='product' && <BusinessSection title="商品归位"><div className="overflow-x-auto"><table className={`${procurementTable} min-w-[980px]`}><thead><tr>{['纳入','商品全称','产品简称','订单 / GMV','供应商','业务模式'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{(preview.products as RoutedProduct[]).map(row=>{const decision=decisions.products[row.productName] ?? {selected:false,businessMode:row.businessMode}; return <tr key={row.productName}><td><input aria-label={`选择${row.productName}`} type="checkbox" checked={Boolean(decision.selected)} onChange={event=>setDecisions(old=>({...old,products:{...old.products,[row.productName]:{...decision,selected:event.target.checked}}}))} /></td><td>{row.productName}</td><td><input aria-label={`${row.productName}产品简称`} className={businessInput} value={decisions.productShortNames?.[row.productName] ?? ''} placeholder="填写简称" onChange={event=>setDecisions(old=>({...old,productShortNames:{...old.productShortNames,[row.productName]:event.target.value}}))} /></td><td>{row.paidOrders ?? '未采集'}单 / ¥{row.gmv ?? '未采集'}</td><td><select aria-label={`${row.productName}供应商`} className={businessInput} value={decision.supplierId ?? ''} onChange={event=>setDecisions(old=>({...old,products:{...old.products,[row.productName]:{...decision,supplierId:event.target.value || undefined}}}))}><option value="">请选择供应商</option>{suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.shortName ? `${supplier.shortName} · ` : ''}{supplier.name}</option>)}</select></td><td><select aria-label={`${row.productName}业务模式`} className={businessInput} value={decision.businessMode} onChange={event=>setDecisions(old=>({...old,products:{...old.products,[row.productName]:{...decision,businessMode:event.target.value as 'dropship'|'inbound'}}}))}><option value="dropship">一件代发</option><option value="inbound">入仓采购</option></select></td></tr>;})}</tbody></table></div></BusinessSection>}
    {preview && step==='review' && <Review preview={preview} decisions={decisions} />}
    {preview?.issues.length ? <BusinessSection title="解析提示"><ul className="space-y-2 text-sm">{preview.issues.map((issue,index)=><li className={issue.severity==='error'?'text-red-600':'text-muted'} key={index}>{issue.sheetName}{issue.rowNumber?` 第${issue.rowNumber}行`:''}：{issue.message}</li>)}</ul></BusinessSection> : null}
    {error && <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {success && <p className="border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</p>}
  </BusinessRecordDialog>;
}

function Review({preview,decisions}:{preview:DropshipImportPreview;decisions:DropshipRoutingDecision}) {
  const {formal,pending,aliases,routed,unresolved}=buildReviewCounts(preview,decisions);
  return <BusinessSection title="最终写入预览"><div className="grid border border-line sm:grid-cols-5"><Metric label="正式周期记录" value={`${formal} 条`} /><Metric label="待建档供应商" value={`${pending} 条`} /><Metric label="保存别名" value={`${aliases} 条`} /><Metric label="路由商品" value={`${routed} 条`} /><Metric label="未解决项目" value={`${unresolved} 条`} /></div></BusinessSection>;
}
function StepBar({step,mode}:{step:Step;mode:DropshipImportMode}) { const steps:[Step,string][]=[['upload','1 上传与识别'],...(mode !== 'product' ? [['supplier','2 供应商归位'] as [Step,string]] : []),...(mode !== 'performance' ? [['product','2 商品归位'] as [Step,string]] : []),['review',mode === 'full' ? '4 确认写入' : '3 确认写入']]; return <ol className="mb-4 grid grid-cols-2 overflow-hidden rounded-md border border-line text-sm sm:grid-cols-4">{steps.map(([key,label])=><li className={`border-r border-line px-3 py-2 last:border-r-0 ${step===key?'bg-action-soft font-medium text-action':'text-muted'}`} key={key}>{label}</li>)}</ol>; }
function Metric({label,value}:{label:string;value:string}) { return <div className="border-b border-line p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }
