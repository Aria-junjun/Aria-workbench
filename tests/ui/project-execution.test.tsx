import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("project execution UI", () => {
  it("exposes an independent ledger and five-step execution workspace", () => {
    const home = readFileSync("src/components/workbench/project-execution/project-execution-home.tsx", "utf8");
    const workspace = readFileSync("src/components/workbench/project-execution/project-execution-workspace.tsx", "utf8");
    const domain = readFileSync("src/features/workbench/project-execution.ts", "utf8");
    expect(home).toContain("项目推进");
    expect(workspace).toContain("PROJECT_EXECUTION_STEP_LABELS");
    expect(domain).toContain("项目定义");
    expect(domain).toContain("干系人分析");
    expect(domain).toContain("风险与复盘");
    expect(domain).toContain("sourceDecompositionProjectId");
  });
});
