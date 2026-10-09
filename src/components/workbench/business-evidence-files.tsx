'use client';
import React, { useState } from 'react';
export function evidenceIds(fields: Record<string,string>): string[] {
  try { const ids: unknown = JSON.parse(fields.evidenceAttachmentIds || '[]'); return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []; } catch { return []; }
}
export function BusinessEvidenceFiles({ fields, onChange, onBusy }: { fields: Record<string,string>; onChange?: (fields: Record<string,string>) => void; onBusy?: (busy: boolean) => void }) {
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  async function upload(file?: File) {
    if (!file || !onChange) return;
    setBusy(true); onBusy?.(true); setError('');
    try { const form = new FormData(); form.set('file',file); const response = await fetch('/api/supplier-attachments',{method:'POST',body:form}); const result = await response.json(); if (!response.ok) throw new Error(result.error || '上传失败'); const id = result.attachment.id; onChange({ evidenceAttachmentIds:JSON.stringify([...evidenceIds(fields),id]), ['attachmentName:' + id]:file.name }); }
    catch (e) { setError(e instanceof Error ? e.message : '上传失败'); }
    finally { setBusy(false); onBusy?.(false); }
  }
  return <div className="mt-5 text-sm">{onChange && <label className="block text-action">上传原始证件 / 协议 / 核验资料<input aria-label="上传原始资料" className="mt-2 block max-w-full text-xs" type="file" disabled={busy} onChange={e => { const file=e.currentTarget.files?.[0]; e.currentTarget.value=''; void upload(file); }} /></label>}{busy && <p className="mt-2 text-muted">正在上传到本机…</p>}{error && <p role="alert" className="mt-2 text-red-600">{error}</p>}<ul className="mt-3 space-y-2">{evidenceIds(fields).map((id,index) => <li key={id}><a className="text-action hover:underline" href={'/api/supplier-attachments/' + encodeURIComponent(id)} target="_blank" rel="noreferrer">{fields['attachmentName:' + id] || '原始附件 ' + (index+1)} ↗</a></li>)}</ul>{onChange && <p className="mt-2 text-xs text-muted">原件保存在本机，保存记录后完成关联；附件上传不等于核验通过。</p>}</div>;
}
