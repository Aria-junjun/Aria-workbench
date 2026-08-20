const supplierTypeLabels: Record<string, string> = {
  factory: "工厂",
  trader: "贸易商",
  unknown: "尚未判断"
};

const priorityLabels: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低"
};

const taskTypeLabels: Record<string, string> = {
  confirm_quote: "确认报价",
  follow_sample: "跟进样品",
  confirm_moq: "确认起订量",
  confirm_lead_time: "确认交期",
  supplement_product_knowledge: "补充产品知识",
  review_supplier: "复盘供应商",
  follow_up: "继续跟进",
  knowledge_action: "知识应用",
  product_stage: "产品阶段推进"
};

const reviewOutcomeLabels: Record<string, string> = {
  success: "成功",
  partial: "部分达成",
  failure: "失败",
  cancelled: "取消"
};

const lifecycleStageLabels: Record<string, { label: string; tone: string }> = {
  signal:        { label: "信号池",        tone: "bg-slate-100 text-slate-700 ring-slate-200" },
  validated:     { label: "已验证·GO",     tone: "bg-action-soft text-action ring-action/20" },
  defined:       { label: "产品定义完成",   tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  supply_locked: { label: "供应锁定",       tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  listing:       { label: "上架测试中",     tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  evaluating:    { label: "评估决策",       tone: "bg-orange-50 text-orange-700 ring-orange-200" },
  archived:      { label: "归档·成功闭环",  tone: "bg-muted text-muted ring-line" },
  discontinued:  { label: "已淘汰",         tone: "bg-rose-50 text-rose-700 ring-rose-200" }
};

const signalStatusLabels: Record<string, { label: string; tone: string }> = {
  active:   { label: "待评估·活跃信号", tone: "bg-action-soft text-action ring-action/20" },
  dormant:  { label: "休眠·暂不做",     tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  rejected: { label: "已淘汰·排除",     tone: "bg-rose-50 text-rose-700 ring-rose-200" }
};

const dormantReasonLabels: Record<string, string> = {
  "供应商不成熟": "缺少成熟供应商",
  "采购成本过高": "成本/报价过高",
  "季节不适配":   "当前季节不匹配",
  "资金不足":     "资金/预算不足",
  "产能受限":     "产能/供应链受限",
  "竞争太激烈":   "红海中风险高",
  "其他":         "其他原因"
};

export function labelSupplierType(value?: string) {
  return value ? supplierTypeLabels[value] ?? value : "未记录";
}

export function labelPriority(value?: string) {
  return value ? priorityLabels[value] ?? value : "未记录";
}

export function labelTaskType(value?: string) {
  return value ? taskTypeLabels[value] ?? value : "未记录";
}

export function labelReviewOutcome(value?: string) {
  return value ? reviewOutcomeLabels[value] ?? value : "未复盘";
}

export function labelLifecycleStage(stage?: string) {
  if (!stage) return { label: "未标注阶段", tone: "bg-muted text-muted ring-line" };
  return lifecycleStageLabels[stage] ?? { label: stage, tone: "bg-muted text-muted ring-line" };
}

export function labelSignalStatus(status?: string) {
  if (!status) return { label: "未设置", tone: "bg-muted text-muted ring-line" };
  return signalStatusLabels[status] ?? { label: status, tone: "bg-muted text-muted ring-line" };
}

export function labelDormantReason(reason?: string) {
  if (!reason) return "未说明原因";
  return dormantReasonLabels[reason] ?? reason;
}

export const LIFECYCLE_STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "signal",        label: "信号池" },
  { value: "validated",     label: "已验证·决定做" },
  { value: "defined",       label: "产品定义完成" },
  { value: "supply_locked", label: "供应锁定" },
  { value: "listing",       label: "上架测试中" },
  { value: "evaluating",    label: "评估决策" },
  { value: "archived",      label: "归档·成功闭环" },
  { value: "discontinued",  label: "已淘汰·停止" }
];

export const SIGNAL_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "active",   label: "活跃·待评估" },
  { value: "dormant",  label: "休眠·暂不做" },
  { value: "rejected", label: "已排除·不做" }
];

export const DORMANT_REASON_OPTIONS: { value: string; label: string }[] = [
  "供应商不成熟", "采购成本过高", "季节不适配",
  "资金不足", "产能受限", "竞争太激烈", "其他"
].map((v) => ({ value: v, label: dormantReasonLabels[v] ?? v }));
