import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("industry insight report", () => {
  it("renders evidence gaps and limitations instead of an automatic score", () => {
    const report = readFileSync("src/components/workbench/industry-insight/insight-report.tsx", "utf8");
    expect(report).toContain("报告仍有信息缺口");
    expect(report).toContain("限制说明");
  });
});
