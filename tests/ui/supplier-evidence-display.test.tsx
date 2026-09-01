import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("supplier evidence display", () => {
  it("does not show a score when an evaluation has no raw evidence", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).toContain("hasEvaluationEvidence");
    expect(source).toContain("未评估");
  });

  it("keeps unassociated offers actionable from the supplier detail", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/[supplierId]/page.tsx"), "utf8");
    expect(source).toContain("去规格关联");
  });

  it("uses the applicable-dimension score breakdown on the supplier overview", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/page.tsx"), "utf8");
    expect(source).toContain("getScoreBreakdown");
    expect(source).toContain("N/A");
    expect(source).toContain("暂无评分");
  });
});
