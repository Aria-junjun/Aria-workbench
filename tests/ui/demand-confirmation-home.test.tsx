import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("需求确认文档列表", () => {
  it("提供可恢复的归档操作", () => {
    const source = readFileSync(
      "src/components/workbench/demand-exploration/exploration-home.tsx",
      "utf8",
    );

    expect(source).toContain("删除文档");
    expect(source).toContain("已归档文档");
    expect(source).toContain("恢复文档");
    expect(source).toContain("saveDemandConfirmationDocument");
  });
});
