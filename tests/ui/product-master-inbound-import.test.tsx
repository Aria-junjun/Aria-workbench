import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("product master monthly inbound import contract", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "src/app/product-master/page.tsx"), "utf8");
  const preview = fs.readFileSync(path.join(process.cwd(), "src/components/workbench/supplier-inbound-import-preview.tsx"), "utf8");

  it("exposes a separate inbound import entry and only saves from confirmation", () => {
    expect(page).toContain("导入月度实际入仓表");
    expect(page).toContain("parseSupplierInboundRows");
    expect(page).toContain("saveInboundImport");
    expect(preview).toContain("确认保存");
    expect(preview).toContain("暂不关联");
  });

  it("requires a supplier choice when the statement has no supplier name", () => {
    expect(preview).toContain("请选择供应商");
    expect(preview).toContain("!supplierFromFile && !supplierId");
  });
});
