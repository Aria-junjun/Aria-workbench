import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("需求探索结果和四象限", () => {
  it("shows explainable result layers and does not change product status", () => {
    const result = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/demand-exploration/analysis-result.tsx"), "utf8");
    expect(result).toContain("模型结果");
    expect(result).toContain("计算依据");
    expect(result).toContain("可信度限制");
    expect(result).not.toContain("updateLocalItem(\"products\"");
  });

  it("supports the comparison surface and explains the single-demand boundary", () => {
    const quadrant = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/demand-exploration/kano-quadrant.tsx"), "utf8");
    expect(quadrant).toContain("至少需要两个有有效 SI / DSI 的需求项");
    expect(quadrant).toContain("SI / Better");
    expect(quadrant).toContain("DSI / Worse");
  });
});
