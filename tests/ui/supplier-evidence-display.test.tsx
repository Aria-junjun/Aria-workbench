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
});
