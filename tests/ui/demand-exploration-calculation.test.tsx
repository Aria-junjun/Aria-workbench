import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseKanoResponseText } from "@/features/workbench/demand-exploration";

describe("KANO 对照表、回答统计和计算", () => {
  it("parses pasted response rows and preserves invalid rows", () => {
    expect(parseKanoResponseText("like\tdislike\nmust\tdislike\nwrong\tvalue")).toEqual({
      responses: [
        { functional: "like", dysfunctional: "dislike" },
        { functional: "must", dysfunctional: "dislike" }
      ],
      invalidRows: ["wrong\tvalue"]
    });
  });

  it("keeps the matrix and formula explanation visible in separate surfaces", () => {
    const matrix = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/demand-exploration/kano-matrix.tsx"), "utf8");
    const calculation = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/demand-exploration/calculation-breakdown.tsx"), "utf8");
    expect(matrix).toContain("A");
    expect(matrix).toContain("R");
    expect(matrix).toContain("Q");
    expect(calculation).toContain("SI / Better");
    expect(calculation).toContain("DSI / Worse");
    expect(calculation).toContain("有效样本");
  });
});
