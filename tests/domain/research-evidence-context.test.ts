import { describe, expect, it } from "vitest";
import { buildReferencedEvidenceContext } from "@/features/workbench/research-evidence-context";
import type { LocalWorkbenchData } from "@/features/workbench/local-store";

describe("研究任务包引用上下文", () => {
  it("只注入当前项目已确认的引用副本", () => {
    const data = {
      evidenceReferences: [
        { id: "confirmed", targetModule: "demand-exploration", targetProjectId: "demand-1", sourceModule: "industry-insight", sourceProjectId: "industry-1", sourceProjectTitle: "白板贴行业洞察", sourceFieldPath: "purpose.decisionQuestion", sourceFieldLabel: "决策问题", snapshot: "确认留痕原因", status: "confirmed", referencedAt: "2026-09-18" },
        { id: "draft", targetModule: "demand-exploration", targetProjectId: "demand-1", sourceModule: "industry-insight", sourceProjectId: "industry-1", sourceProjectTitle: "白板贴行业洞察", sourceFieldPath: "purpose.expectedAction", sourceFieldLabel: "预期行动", snapshot: "不要注入", status: "edited", referencedAt: "2026-09-18" },
        { id: "other", targetModule: "competitor-analysis", targetProjectId: "competitor-1", sourceModule: "industry-insight", sourceProjectId: "industry-1", sourceProjectTitle: "白板贴行业洞察", sourceFieldPath: "purpose.decisionQuestion", sourceFieldLabel: "决策问题", snapshot: "不要注入", status: "confirmed", referencedAt: "2026-09-18" },
      ],
    } as LocalWorkbenchData;

    const context = buildReferencedEvidenceContext(data, "demand-exploration", "demand-1");
    expect(context).toContain("确认留痕原因");
    expect(context).not.toContain("不要注入");
    expect(context).toContain("不得把上游推断改写成事实");
  });
});
