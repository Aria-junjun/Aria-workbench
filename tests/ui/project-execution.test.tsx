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
    expect(domain).toContain("项目相关方");
    expect(domain).toContain("风险与复盘");
    expect(domain).toContain("sourceDecompositionProjectId");
    expect(workspace).toContain("本项目负责事项");
    expect(workspace).toContain("需要确认的事项");
    expect(workspace).toContain("影响力");
    expect(workspace).toContain("项目范围不是产品全部范围");
    expect(workspace).toContain("擦除后不能明显看到上一次书写痕迹");
    expect(workspace).toContain("决策人");
    expect(workspace).toContain("项目相关方");
    expect(workspace).toContain("信息获取方式");
    expect(workspace).toContain("需要确认的事项");
    expect(workspace).toContain("单人主导");
  });
});
