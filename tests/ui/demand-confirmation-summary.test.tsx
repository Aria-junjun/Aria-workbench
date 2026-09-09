import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("demand confirmation summaries", () => {
  it("renders the feature matrix from demand items", () => {
    const source = readFileSync("src/components/workbench/demand-exploration/demand-attribute-matrix.tsx", "utf8");
    expect(source).toContain("功能板块");
    expect(source).toContain("必备");
    expect(source).toContain("需求项");
    expect(source).toContain("documentId");
  });

  it("keeps quadrant and conclusion document-scoped", () => {
    const quadrant = readFileSync("src/components/workbench/demand-exploration/kano-quadrant.tsx", "utf8");
    const conclusion = readFileSync("src/components/workbench/demand-exploration/document-conclusion.tsx", "utf8");
    expect(quadrant).toContain("documentId");
    expect(quadrant).toContain("暂无可比较需求");
    expect(conclusion).toContain("需求确认结论");
    expect(conclusion).toContain("证据限制");
  });
});
