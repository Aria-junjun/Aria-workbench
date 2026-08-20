import { describe, expect, it } from "vitest";
import {
  DecisionCaseSchema,
  latestDecisionCycle,
  mergeActionSources,
  normalizeProblemKey
} from "@/features/workbench/decision-cases";

describe("decision cases", () => {
  it("normalizes cosmetic differences in the same problem", () => {
    expect(normalizeProblemKey(" 是否进入新品？ ")).toBe(normalizeProblemKey("是否进入新品"));
  });

  it("keeps tool contributions separate while merging repeated actions", () => {
    const result = mergeActionSources([
      { toolId: "a", toolName: "市场信号", judgement: "需求待验证", actions: ["小批量测试"] },
      { toolId: "b", toolName: "竞争战略", judgement: "避免直接降价", actions: ["小批量测试"] }
    ]);

    expect(result).toEqual([{ action: "小批量测试", sourceToolIds: ["a", "b"] }]);
  });

  it("selects the latest cycle by cycle number", () => {
    const value = DecisionCaseSchema.parse({
      id: "case-1",
      title: "是否进入新品",
      normalizedProblemKey: "是否进入新品",
      cycles: [
        cycle(1, "周期一"),
        cycle(2, "周期二")
      ],
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z"
    });

    expect(latestDecisionCycle(value)?.title).toBe("周期二");
    expect(value.cycles[1].modelSections).toEqual([]);
  });
});

function cycle(cycleNumber: number, title: string) {
  return {
    id: `cycle-${cycleNumber}`,
    cycleNumber,
    title,
    rawInput: "测试问题",
    toolContributions: [],
    modelSections: [],
    nextActions: [],
    status: "judging",
    version: 1,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  };
}
