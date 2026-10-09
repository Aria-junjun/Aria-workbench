import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("industry insight workspace", () => {
  it("keeps the six independent steps and report limitation", () => {
    const nav = readFileSync("src/components/workbench/industry-insight/insight-step-nav.tsx", "utf8");
    const workspace = readFileSync("src/components/workbench/industry-insight/insight-workspace.tsx", "utf8");
    expect(nav).toContain("INDUSTRY_STEP_LABELS");
    expect(workspace).toContain('useState<IndustryStepKey>("purpose")');
    expect(workspace).toContain("保存本步");
    expect(workspace).toContain("保存研究前输入");
    expect(workspace).toContain("已有研究前输入");
    expect(workspace).toContain("修改研究前输入");
    expect(workspace).toContain("Object.values(input).some");
    const report = readFileSync("src/components/workbench/industry-insight/insight-report.tsx", "utf8");
    expect(report).toContain("限制说明");
  });
});
