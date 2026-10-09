export type SupplierDashboardIssueType = "quality" | "delivery" | "cost" | "relationship" | "data_missing";
export type SupplierWorkbenchJudgment = "normal" | "needs_review" | "waiting_data";
export type SupplierDataStatus = "available" | "partial" | "missing";
export type SupplierBasisStatus = "available" | "abnormal" | "missing";

export type SupplierDashboardSupplier = {
  supplierId: string;
  supplierName: string;
  erpPerformanceScore?: number;
  erpPerformanceGrade?: string;
  erpQualityScore?: number;
  erpDeliveryScore?: number;
  returnRate?: number;
  supplierCausedExtraCost?: number;
  workbenchJudgment: SupplierWorkbenchJudgment;
  dataStatus: SupplierDataStatus;
  basis: { quality: SupplierBasisStatus; delivery: SupplierBasisStatus };
  issue?: SupplierDashboardIssueType;
  recommendedAction: string;
};

export type SupplierDashboardAction = SupplierDashboardSupplier & {
  issueType: SupplierDashboardIssueType;
  action: string;
  severity: number;
};

export type SupplierDashboardViewModel = {
  period: string;
  suppliers: SupplierDashboardSupplier[];
  actionQueue: SupplierDashboardAction[];
  stats: {
    total: number;
    normal: number;
    needsAction: number;
    waitingData: number;
    validScores: number;
  };
};

type DashboardInput = {
  suppliers?: Array<{
    id: string;
    name: string;
    evaluations?: Array<{
      period?: string;
      scores?: { total?: number; grade?: string; quality?: number; delivery?: number };
      rawMetrics?: Record<string, unknown>;
    }>;
  }>;
};

type DashboardSupplier = NonNullable<DashboardInput["suppliers"]>[number];

function latestEvaluation(supplier: DashboardSupplier, period: string) {
  return [...(supplier.evaluations ?? [])]
    .filter((evaluation) => evaluation.period === period)
    .at(-1);
}

export function classifySupplierIssue(evaluation?: {
  rawMetrics?: Record<string, unknown>;
}): { issueType: SupplierDashboardIssueType; severity: number; action: string } | null {
  const metrics = evaluation?.rawMetrics ?? {};
  const returnRate = typeof metrics.returnRate === "number" ? metrics.returnRate : undefined;
  if (returnRate !== undefined && returnRate >= 5) {
    return { issueType: "quality", severity: returnRate, action: "发起质量复核" };
  }
  const onTimeRate = typeof metrics.onTimeDeliveryRate === "number" ? metrics.onTimeDeliveryRate : undefined;
  if (onTimeRate !== undefined && onTimeRate < 95) {
    return { issueType: "delivery", severity: 100 - onTimeRate, action: "查看交付明细" };
  }
  return null;
}

export function buildSupplierDashboard(data: DashboardInput, period: string): SupplierDashboardViewModel {
  const suppliers = (data.suppliers ?? []).map((supplier): SupplierDashboardSupplier => {
    const evaluation = latestEvaluation(supplier, period);
    const issue = classifySupplierIssue(evaluation);
    if (!evaluation) {
      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        workbenchJudgment: "waiting_data",
        dataStatus: "missing",
        basis: { quality: "missing", delivery: "missing" },
        issue: "data_missing",
        recommendedAction: "等待数据",
      };
    }
    const returnRate = typeof evaluation.rawMetrics?.returnRate === "number" ? evaluation.rawMetrics.returnRate : undefined;
    const onTimeDeliveryRate = typeof evaluation.rawMetrics?.onTimeDeliveryRate === "number" ? evaluation.rawMetrics.onTimeDeliveryRate : undefined;
    const basis = {
      quality: returnRate === undefined ? "missing" : returnRate >= 5 ? "abnormal" : "available",
      delivery: onTimeDeliveryRate === undefined ? "missing" : "available",
    } as const;
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      erpPerformanceScore: evaluation.scores?.total,
      erpPerformanceGrade: evaluation.scores?.grade,
      erpQualityScore: evaluation.scores?.quality,
      erpDeliveryScore: evaluation.scores?.delivery,
      returnRate: typeof evaluation.rawMetrics?.returnRate === "number"
        ? evaluation.rawMetrics.returnRate
        : typeof evaluation.rawMetrics?.customerReturnRate === "number"
          ? evaluation.rawMetrics.customerReturnRate
          : undefined,
      supplierCausedExtraCost: typeof evaluation.rawMetrics?.supplierCausedExtraCost === "number"
        ? evaluation.rawMetrics.supplierCausedExtraCost
        : undefined,
      workbenchJudgment: issue ? "needs_review" : "normal",
      dataStatus: basis.quality === "available" && basis.delivery === "available" ? "available" : "partial",
      basis,
      issue: issue?.issueType,
      recommendedAction: issue?.action ?? "保持主供",
    };
  });

  const issueRank: Record<SupplierDashboardIssueType, number> = {
    quality: 1,
    delivery: 2,
    cost: 3,
    relationship: 4,
    data_missing: 5,
  };
  const actionQueue = suppliers
    .filter((supplier) => supplier.workbenchJudgment === "needs_review")
    .map((supplier): SupplierDashboardAction => ({
      ...supplier,
      issueType: supplier.issue ?? "data_missing",
      action: supplier.recommendedAction,
      severity: supplier.issue ? 1 : 0,
    }))
    .sort((left, right) => issueRank[left.issueType] - issueRank[right.issueType] || right.severity - left.severity);

  return {
    period,
    suppliers,
    actionQueue,
    stats: {
      total: suppliers.length,
      normal: suppliers.filter((supplier) => supplier.workbenchJudgment === "normal").length,
      needsAction: suppliers.filter((supplier) => supplier.workbenchJudgment === "needs_review").length,
      waitingData: suppliers.filter((supplier) => supplier.workbenchJudgment === "waiting_data").length,
      validScores: suppliers.filter((supplier) => supplier.erpPerformanceScore !== undefined).length,
    },
  };
}
