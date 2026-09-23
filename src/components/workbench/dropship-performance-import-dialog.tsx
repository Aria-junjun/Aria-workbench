'use client';
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { applyDropshipImport, buildDropshipImportPreview, parseDropshipWorkbook, type DropshipImportPreview, type DropshipProductRow, type DropshipRoutingDecision, type SupplierBusinessMode } from '@/features/workbench/dropship-performance-import';
import { loadLocalWorkbenchData, saveLocalWorkbenchData } from '@/features/workbench/local-store';
import { BusinessRecordDialog, BusinessSection, businessInput, businessPrimary, businessSecondary } from './business-record-dialog';
import { procurementTable } from './procurement-line-details';

type Props = { onClose: () => void; onImported?: () => void };
type Step = 'upload' | 'supplier' | 'product' | 'review';
type RoutedProduct = DropshipProductRow & { supplierId?: string; businessMode: SupplierBusinessMode };
const bandNames = { unknown:'数据待补', insufficient:'样本不足', eligible:'建议建档', priority:'重点候选' } as const;
const routingNames = { exact:'自动匹配', alias:'历史别名', suggested:'建议匹配', unmatched:'待处理' } as const;

export function DropshipPerformanceImportDialog({ onClose, onImported }: Props) {
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
        products:Object.fromEntries((next.products as RoutedProduct[]).map(row=>[row.productName,{selected:Boolean(row.supplierId),supplierId:row.supplierId,businessMode:row.businessMode}]))
      });
      setPreview(next); setStep('upload');
      if (next.issues.some(issue=>issue.severity==='error') || next.blockingIssues.length) setError('文件存在结构或匹配冲突，请处理后再确认导入。');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '文件解析失败'); }
  };

  const goToReview = () => {
    if (!preview) return;
    const invalid = preview.products.find(row=>decisions.products[row.productName]?.selected && !decisions.products[row.productName]?.supplierId);
    if (invalid) { setError(`商品“${invalid.productName}”未选择供应商`); return; }
    setError(''); setStep('review');
  };
  const confirm = () => {
    if (!preview || error || preview.issues.some(issue=>issue.severity==='error') || preview.blockingIssues.length) return;
    const matched = preview.suppliers.filter(row=>row.supplierId || decisions.suppliers[row.sourceName]).length;
    saveLocalWorkbenchData(applyDropshipImport(loadLocalWorkbenchData(),preview,decisions));
    onImported?.(); setSuccess(`导入完成：${matched} 条进入周期履约，${preview.suppliers.length-matched} 条进入待建档区。`);
  };
  const resetPreview = () => { setPreview(null); setStep('upload'); setError(''); setSuccess(''); };
  const footer = <>
    {step !== 'upload' && <button type="button" className={businessSecondary} onClick={()=>setStep(step==='review'?'product':step==='product'?'supplier':'upload')}>上一步</button>}
    <button type="button" className={businessSecondary} onClick={onClose}>关闭</button>
    {preview && step==='upload' && <button type="button" className={businessPrimary} onClick={()=>setStep('supplier')}>下一步：供应商归位</button>}
    {step==='supplier' && <button type="button" className={businessPrimary} onClick={()=>setStep('product')}>下一步：商品归位</button>}
    {step==='product' && <button type="button" className={businessPrimary} onClick={goToReview}>下一步：导入确认</button>}
    {step==='review' && <button type="button" className={businessPrimary} disabled={!preview || Boolean(error) || Boolean(success)} onClick={confirm}>确认导入</button>}
  </>;

  return <BusinessRecordDialog title="批量导入周期履约" onClose={onClose} footer={footer}>
    <StepBar step={step} />
    {step==='upload' && <>
      <BusinessSection title="上传与统计口径"><div className="grid gap-5 sm:grid-cols-3">
        <label className="text-sm">统计开始日期<input aria-label="统计开始日期" className={businessInput} type="date" value={periodStart} onChange={event=>{setPeriodStart(event.target.value);resetPreview();}} /></label>
        <label className="text-sm">统计结束日期<input aria-label="统计结束日期" className={businessInput} type="date" value={periodEnd} onChange={event=>{setPeriodEnd(event.target.value);resetPreview();}} /></label>
        <label className="text-sm">平台 / 店铺<input aria-label="平台 / 店铺" className={businessInput} value={platform} onChange={event=>{setPlatform(event.target.value);resetPreview();}} /></label>
      </div><label className="mt-4 inline-flex cursor-pointer items-center rounded-md border border-line px-4 py-2 text-sm text-action">选择履约文件<input aria-label="选择履约文件" accept=".xlsx,.xls,.csv" className="hidden" type="file" onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';void parseFile(file);}} /></label></BusinessSection>
      {preview && <BusinessSection title="工作簿读取结果"><div className="grid border border-line sm:grid-cols-4"><Metric label="商家服务 Sheet" value={`${preview.merchants.length} 行`} /><Metric label="商品服务 Sheet" value={`${preview.products.length} 行`} /><Metric label="商家售后 Sheet" value={`${preview.afterSales.length} 行`} /><Metric label="有效记录" value={`${preview.counts.effectiveRecords} 条`} /></div></BusinessSection>}
    </>}
    {preview && step==='supplier' && <BusinessSection title="供应商归位"><div className="overflow-x-auto"><table className={`${procurementTable} min-w-[820px]`}><thead><tr>{['来源商家','订单 / GMV','样本层级','识别结果','归属档案'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{preview.suppliers.map(row=><tr data-testid={`supplier-row-${row.sourceName}`} key={row.sourceName}><td>{row.sourceName}</td><td>{row.merchant?.paidOrders ?? row.afterSales?.paidOrders ?? '未采集'}单 / ¥{row.merchant?.gmv ?? '未采集'}</td><td>{bandNames[row.filingBand]}</td><td>{routingNames[row.routingStatus]}{row.willReplace?' · 覆盖同周期':''}</td><td><select aria-label={`${row.sourceName}归属档案`} className={businessInput} value={decisions.suppliers[row.sourceName] ?? ''} onChange={event=>setDecisions(old=>({...old,suppliers:{...old.suppliers,[row.sourceName]:event.target.value}}))}><option value="">进入待建档区</option>{suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}{row.suggestedSupplierId===supplier.id?'（建议）':''}</option>)}</select></td></tr>)}</tbody></table></div></BusinessSection>}
    {preview && step==='product' && <BusinessSection title="商品归位"><div className="overflow-x-auto"><table className={`${procurementTable} min-w-[820px]`}><thead><tr>{['纳入','商品','订单 / GMV','供应商','业务模式'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{(preview.products as RoutedProduct[]).map(row=>{const decision=decisions.products[row.productName] ?? {selected:false,businessMode:row.businessMode}; return <tr key={row.productName}><td><input aria-label={`选择${row.productName}`} type="checkbox" checked={Boolean(decision.selected)} onChange={event=>setDecisions(old=>({...old,products:{...old.products,[row.productName]:{...decision,selected:event.target.checked}}}))} /></td><td>{row.productName}</td><td>{row.paidOrders ?? '未采集'}单 / ¥{row.gmv ?? '未采集'}</td><td><select aria-label={`${row.productName}供应商`} className={businessInput} value={decision.supplierId ?? ''} onChange={event=>setDecisions(old=>({...old,products:{...old.products,[row.productName]:{...decision,supplierId:event.target.value || undefined}}}))}><option value="">请选择供应商</option>{suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></td><td><select aria-label={`${row.productName}业务模式`} className={businessInput} value={decision.businessMode} onChange={event=>setDecisions(old=>({...old,products:{...old.products,[row.productName]:{...decision,businessMode:event.target.value as 'dropship'|'inbound'}}}))}><option value="dropship">一件代发</option><option value="inbound">入仓采购</option></select></td></tr>;})}</tbody></table></div></BusinessSection>}
    {preview && step==='review' && <Review preview={preview} decisions={decisions} />}
    {preview?.issues.length ? <BusinessSection title="解析提示"><ul className="space-y-2 text-sm">{preview.issues.map((issue,index)=><li className={issue.severity==='error'?'text-red-600':'text-muted'} key={index}>{issue.sheetName}{issue.rowNumber?` 第${issue.rowNumber}行`:''}：{issue.message}</li>)}</ul></BusinessSection> : null}
    {error && <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {success && <p className="border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</p>}
  </BusinessRecordDialog>;
}

function Review({preview,decisions}:{preview:DropshipImportPreview;decisions:DropshipRoutingDecision}) {
  const formal=preview.suppliers.filter(row=>row.supplierId || decisions.suppliers[row.sourceName]).length;
  const pending=preview.suppliers.length-formal;
  const aliases=preview.suppliers.filter(row=>!row.supplierId && Boolean(decisions.suppliers[row.sourceName])).length;
  const routed=preview.products.filter(row=>decisions.products[row.productName]?.selected && decisions.products[row.productName]?.supplierId).length;
  const unresolved=pending+preview.products.filter(row=>decisions.products[row.productName]?.selected && !decisions.products[row.productName]?.supplierId).length+preview.blockingIssues.length;
  return <BusinessSection title="最终写入预览"><div className="grid border border-line sm:grid-cols-5"><Metric label="正式周期记录" value={`${formal} 条`} /><Metric label="待建档供应商" value={`${pending} 条`} /><Metric label="保存别名" value={`${aliases} 条`} /><Metric label="路由商品" value={`${routed} 条`} /><Metric label="未解决项目" value={`${unresolved} 条`} /></div></BusinessSection>;
}
function StepBar({step}:{step:Step}) { const steps:[Step,string][]=[['upload','1 上传与识别'],['supplier','2 供应商归位'],['product','3 商品归位'],['review','4 确认写入']]; return <ol className="mb-4 grid grid-cols-2 overflow-hidden rounded-md border border-line text-sm sm:grid-cols-4">{steps.map(([key,label])=><li className={`border-r border-line px-3 py-2 last:border-r-0 ${step===key?'bg-action-soft font-medium text-action':'text-muted'}`} key={key}>{label}</li>)}</ol>; }
function Metric({label,value}:{label:string;value:string}) { return <div className="border-b border-line p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }
