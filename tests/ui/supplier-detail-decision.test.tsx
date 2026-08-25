import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("supplier detail decision loop UI contract", () => {
  it("shows evidence and persisted decision actions", () => {
    const source = fs.readFileSync(path.join(root, "src/app/suppliers/[supplierId]/page.tsx"), "utf8");

    expect(source).toContain("供应商决策闭环");
    expect(source).toContain("本周期实际入仓");
    expect(source).toContain("产品质量信号");
    expect(source).toContain("记录决策");
    expect(source).toContain("completeSupplierDecisionRecord");
    expect(source).toContain("supplierDecisionRecords");
  });
});
