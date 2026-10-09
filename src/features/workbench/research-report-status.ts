export type ResearchReportStatusKey = "pending_review" | "conflict" | "needs_verification" | "information_gap" | "ready";
export type ResearchReportStatus = { key: ResearchReportStatusKey; label: string };

export function calculateResearchReportStatus(input: {
  pendingDraftCount: number;
  needsVerificationCount: number;
  conflictCount: number;
  informationGapCount: number;
}): ResearchReportStatus {
  if (input.pendingDraftCount > 0) return { key: "pending_review", label: "有待审核" };
  if (input.conflictCount > 0) return { key: "conflict", label: "有冲突" };
  if (input.needsVerificationCount > 0) return { key: "needs_verification", label: "有待验证" };
  if (input.informationGapCount > 0) return { key: "information_gap", label: "有信息缺口" };
  return { key: "ready", label: "可输出" };
}
