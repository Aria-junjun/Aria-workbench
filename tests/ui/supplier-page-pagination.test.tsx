import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("supplier page pagination contract", () => {
  it("provides bounded pagination for the supplier evaluation list", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/suppliers/page.tsx"), "utf8");

    expect(source).toContain("SUPPLIER_PAGE_SIZE = 10");
    expect(source).toContain("setSupplierPage");
    expect(source).toContain("paginatedSuppliers");
    expect(source).toContain("上一页");
    expect(source).toContain("下一页");
    expect(source).toContain("第 {activeSupplierPage} / {supplierPageCount} 页");
  });
});
