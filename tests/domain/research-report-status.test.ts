import { describe, expect, it } from "vitest";
import { calculateResearchReportStatus } from "@/features/workbench/research-report-status";

describe("研究报告统一状态", () => {
  it("待审核优先于其他状态", () => {
    expect(calculateResearchReportStatus({ pendingDraftCount: 2, needsVerificationCount: 1, conflictCount: 1, informationGapCount: 1 })).toEqual({ key: "pending_review", label: "有待审核" });
  });

  it("无待审核但有冲突时标记为有冲突", () => {
    expect(calculateResearchReportStatus({ pendingDraftCount: 0, needsVerificationCount: 0, conflictCount: 1, informationGapCount: 0 })).toEqual({ key: "conflict", label: "有冲突" });
  });

  it("没有阻塞项时才允许输出", () => {
    expect(calculateResearchReportStatus({ pendingDraftCount: 0, needsVerificationCount: 0, conflictCount: 0, informationGapCount: 0 })).toEqual({ key: "ready", label: "可输出" });
  });
});
