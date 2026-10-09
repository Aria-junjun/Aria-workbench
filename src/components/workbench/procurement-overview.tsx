'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadProcurementRecords, saveProcurementRecords, procurementSourceChain, type ProcurementRecord } from '@/features/workbench/procurement';
import { ProcurementManagementLedger } from './procurement-management-ledger';
import { fulfillmentProgress } from '@/features/workbench/procurement-fulfillment';
import { procurementTable } from './procurement-line-details';

const stages = [
  { key: 'request', label: '需求申请' }, { key: 'pool', label: '需求池' },
  { key: 'task', label: '采购任务' }, { key: 'quote', label: '询价比价' }, { key: 'fulfillment', label: '采购履约' }
] as const;
const labels: Record<string, string> = { draft: '草稿', pending: '待承接', accepted: '已承接', paused: '已暂缓', sourcing: '寻源中', completed: '已完成', cancelled: '已取消' };

export function ProcurementOverview() {
  const [records, setRecords] = useState<ProcurementRecord[]>([]);
  useEffect(() => { setRecords(loadProcurementRecords()); }, []);
  const active = records.filter(item => item.status !== 'cancelled');
  const leaves = active.filter(item => !active.some(child => child.sourceId === item.id));
  const projectCount = new Set(active.map(item => procurementSourceChain(records, item)[0]?.id || item.id)).size;
  const pending = active.filter(item => (item.section === 'pool' || item.section === 'request') && item.status === 'pending');
  const exceptions = active.filter(item => item.section === 'fulfillment' && fulfillmentProgress(item).stage === '异常待处理');
  return <main className="mx-auto max-w-[1440px] py-5"><header className="border-b border-line pb-5"><p className="text-xs text-action">采购管理 · 进度总览</p><h1 className="mt-1 text-2xl font-semibold">采购总览</h1><p className="mt-2 text-sm text-muted">按来源关联去重看项目，按阶段单据看工作量。数据范围：当前浏览器保存的采购记录。</p></header>
    <nav className="flex flex-wrap gap-6 border-b border-line py-4">{stages.map(stage => <Link className="text-sm text-muted hover:text-action" key={stage.key} href={`/procurement/${stage.key}`}>{stage.label}</Link>)}</nav>
    <section className="grid gap-4 py-6 sm:grid-cols-3">{[['采购项目', projectCount], ['待采购承接', pending.length], ['履约异常', exceptions.length]].map(([label, value]) => <div className="rounded-xl border border-line bg-surface p-5" key={label}><p className="text-sm text-muted">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}</section>
    <ProcurementManagementLedger records={records} onCommit={next => { saveProcurementRecords(next); setRecords(next); }} />
    <h2 className="mb-3 font-semibold">各阶段工作量</h2><div className="overflow-x-auto"><table className={procurementTable}><thead><tr><th>阶段</th><th>记录数</th><th>待处理</th><th>进入板块</th></tr></thead><tbody>{stages.map(stage => {
      const items = active.filter(item => stage.key === 'pool' ? (item.section === 'request' || item.section === 'pool') && item.status !== 'draft' : item.section === stage.key);
      const count = items.filter(item => stage.key === 'pool' ? item.status === 'pending' || item.status === 'paused' : item.section === 'fulfillment' ? item.fulfillmentStage !== '已完成' : item.status !== 'completed' && !active.some(child => child.sourceId === item.id)).length;
      return <tr key={stage.key}><td>{stage.label}</td><td>{items.length}</td><td>{count}</td><td><Link className="text-action" href={`/procurement/${stage.key}`}>查看列表</Link></td></tr>;
    })}</tbody></table></div><p className="mt-2 text-xs text-muted">阶段记录数不能相加作为项目总数；已提交的申请同时出现在需求池。</p>
    <h2 className="mb-3 mt-7 font-semibold">当前执行进度</h2><div className="overflow-x-auto"><table className={`${procurementTable} min-w-[850px]`}><thead><tr><th>来源项目</th><th>当前单据 / 阶段</th><th>负责人</th><th>状态</th><th>下一步</th><th>操作</th></tr></thead><tbody>{leaves.map(item => {
      const chain = procurementSourceChain(records, item);
      const stage = item.section === 'request' && item.status !== 'draft' ? 'pool' : item.section;
      const progress = item.section === 'fulfillment' ? fulfillmentProgress(item) : undefined;
      const owner = [...chain].reverse().find(record => record.fulfillment?.owner || record.owner);
      return <tr key={item.id}><td>{chain[0]?.title || item.title}</td><td><p>{item.title || '未命名'}</p><p className="mt-1 text-xs text-muted">{stages.find(value => value.key === stage)?.label}</p></td><td>{owner?.fulfillment?.owner || owner?.owner || '待分配'}</td><td>{progress?.stage || labels[item.status]}</td><td>{progress?.next || item.nextAction || '待安排'}</td><td><Link className="text-action" href={`/procurement/${stage}`}>进入板块</Link></td></tr>;
    })}{!leaves.length && <tr><td colSpan={6} className="text-center text-muted">暂无采购项目</td></tr>}</tbody></table></div>
  </main>;
}
