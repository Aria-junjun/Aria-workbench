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
  knowledge_action: "知识应用"
};

const reviewOutcomeLabels: Record<string, string> = {
  success: "成功",
  partial: "部分达成",
  failure: "失败",
  cancelled: "取消"
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
