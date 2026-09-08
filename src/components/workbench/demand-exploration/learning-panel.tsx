"use client";

import { useState } from "react";

export function LearningPanel() {
  const [open, setOpen] = useState(false);
  return <div className="rounded-xl border border-action/20 bg-action-soft/50 p-4 text-sm text-muted">
    <div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-ink">先理解，再操作</p><p className="mt-1 text-xs leading-5">KANO 判断的是用户对一个具体产品特性的感受，不是直接给产品打分。</p></div><button type="button" onClick={() => setOpen((value) => !value)} className="shrink-0 text-xs font-semibold text-action">{open ? "收起说明" : "查看模型说明"}</button></div>
    {open ? <div className="mt-3 border-t border-action/10 pt-3 text-xs leading-6">你需要围绕同一个特性设计两道问题：提供这个特性时，用户感觉如何；不提供这个特性时，用户感觉如何。系统后面会根据回答组合映射到 A/O/M/I/R/Q。</div> : null}
  </div>;
}
